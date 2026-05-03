"""
SpikeSense Backend API Server
Stateful AI-driven digital wellness backend
"""

from collections import Counter
import threading
import time

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
import os
from dotenv import load_dotenv
import logging

from models import (
    db,
    User,
    UsageLog,
    DailyStats,
    Nudge,
    UserThreshold,
    Streak,
    Badge,
    UserChallenge,
    UserBadge,
    Challenge,
    FocusSession,
)

from focus_enforcement import (
    apply_focus_enforcement_signal,
    apply_threshold_escalation_for_repeated_violations,
    ensure_utc_aware,
    get_active_focus_session,
    increment_focus_violations,
)

from badge_definitions import (
    available_badges_payload,
    db_seed_description,
    serialize_earned_badge_dict,
)
from daily_challenges_engine import build_challenges_response

from nudge_delivery_tier import (
    build_nudge_payload,
    log_delivery_selected,
    select_nudge_delivery_tier,
)

from mode_selector import (
    MODE_PROFILES,
    fallback_balanced_effective_mode,
    resolve_effective_mode_for_user,
)

load_dotenv()

app = Flask(__name__)

# Best-effort guard against back-to-back duplicate session posts (e.g. client retries).
_EVENT_INGEST_DEDUPE_LOCK = threading.Lock()
_EVENT_INGEST_LAST: dict[int, tuple[tuple[str, int], float]] = {}
_EVENT_INGEST_DEDUPE_SEC = 2.0


def _should_skip_quick_duplicate_event(user_id: int, app_name, duration) -> bool:
    try:
        dur_i = int(duration or 0)
    except (TypeError, ValueError):
        dur_i = 0
    key = (str(app_name or "").strip().lower(), dur_i)
    now = time.monotonic()
    with _EVENT_INGEST_DEDUPE_LOCK:
        prev = _EVENT_INGEST_LAST.get(user_id)
        if prev is not None:
            pkey, pt = prev
            if pkey == key and (now - pt) < _EVENT_INGEST_DEDUPE_SEC:
                return True
        _EVENT_INGEST_LAST[user_id] = (key, now)
    return False

# -------------------------------------------------------
# Database Configuration
# -------------------------------------------------------

_default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spikesense_dev.sqlite')

database_url = os.getenv("DATABASE_URL", f"sqlite:///{_default_db}")

if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "dev-secret")

CORS(app, resources={r"/api/*": {"origins": "*"}})

db.init_app(app)

# -------------------------------------------------------
# Logging
# -------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------------------------------------------
# AI Module Initialization
# -------------------------------------------------------

try:
    from ai_module.pattern_detector import PatternDetector, UsageEvent
    from ai_module.nudge_engine import NudgeEngine

    pattern_detector = PatternDetector()
    nudge_engine = NudgeEngine()

    AI_ENABLED = True

except Exception as e:

    pattern_detector = None
    nudge_engine = None

    AI_ENABLED = False

    logger.warning("AI modules disabled: %s", str(e))


# -------------------------------------------------------
# UsageEvent Dataclass
# -------------------------------------------------------

@dataclass(frozen=True)
class UsageEvent:
    user_id: int
    app_name: str
    category: str
    duration: int
    timestamp: datetime


# -------------------------------------------------------
# Database Initialization
# -------------------------------------------------------

with app.app_context():
    db.create_all()
    logger.info("Database initialized")


# -------------------------------------------------------
# Adaptive mode (API payload helper)
# -------------------------------------------------------

def _adaptive_mode_for_response(user: User) -> dict:
    """Shape for GET /mode and stats/daily.adaptive_mode."""
    try:
        eff = resolve_effective_mode_for_user(user)
    except Exception:
        logger.exception("[MODE_SELECTOR] resolve_effective_mode_for_user failed")
        eff = fallback_balanced_effective_mode()
    profile = MODE_PROFILES.get(eff["mode"], MODE_PROFILES["Balanced"])
    manual = bool(eff.get("manual_lock"))
    return {
        "mode": eff["mode"],
        "confidence": eff["confidence"],
        "reason": eff["reason"],
        "auto": eff["auto"],
        "manual_lock": eff.get("manual_lock", False),
        # Additive: distinguishes manual-locked Balanced from inferred Balanced (same `mode` string).
        "mode_source": "manual" if manual else "adaptive",
        "stored_mode_preference": getattr(user, "mode_preference", None),
        "focus_mode_detector": eff["focus_mode_detector"],
        "focus_mode_nudge": eff["focus_mode_nudge"],
        "mode_profile": profile,
        "effective_profile": eff.get("effective_profile"),
        "pattern_profile_multipliers": eff.get("pattern_profile_multipliers"),
        "nudge_cooldown_hours": eff.get("nudge_cooldown_hours"),
        "features": eff.get("features"),
    }


# -------------------------------------------------------
# Threshold Adapter
# -------------------------------------------------------

def _get_user_thresholds_dict(user_id):
    """
    Convert user threshold settings into the normalized values expected
    by the AI PatternDetector and NudgeEngine.
    """

    t = UserThreshold.query.filter_by(user_id=user_id).first()

    # Default thresholds if user has not configured any
    if not t:
        entertainment_minutes = 60
        switch_threshold = 15
        rapid_window = 10
    else:
        entertainment_minutes = t.entertainment_threshold or 0
        switch_threshold = t.switch_threshold or 15
        rapid_window = t.rapid_switching_window or 10

    # Normalize entertainment score (minutes → ratio of 1 hour)
    # Protect against divide-by-zero
    entertainment_cost = entertainment_minutes / 60 if entertainment_minutes > 0 else 0

    return {
        # used by overstimulation scoring
        "overstim_score": switch_threshold,

        # weight for impulsive switching
        "impulsive_weight": rapid_window,

        # normalized entertainment usage cost (0.0 – 1.0+)
        "entertainment_cost": entertainment_cost,
    }


# -------------------------------------------------------
# Streak / Challenge Logic
# -------------------------------------------------------

def _get_or_create_badge_by_name(name: str, description: str):
    """
    Normalized badge lookup/seed.
    Badges are canonical rows in `badges`; users earn them via `user_badges`.
    """
    badge = Badge.query.filter_by(name=name).first()
    if badge:
        return badge

    badge = Badge(name=name, description=description)
    db.session.add(badge)
    db.session.flush()  # ensures badge.id is available within the transaction
    return badge


NUDGE_WINDOW_MINUTES = 10  # aligned with PatternDetector sliding window default


_IGNORED_TOP_PACKAGES_LOWER = {
    "com.anonymous.natively",
    "host.exp.exponent",
    "com.android.launcher",
    "com.android.launcher2",
    "com.android.launcher3",
    "com.google.android.apps.nexuslauncher",
    "com.sec.android.app.launcher",
    "com.miui.home",
    "com.huawei.android.launcher",
    "com.oppo.launcher",
    "com.android.settings",
    "com.google.android.settings.intelligence",
}


def _has_recent_rapid_inapp_nudge(user_id: int, hours: int = 3) -> bool:
    """Throttle repeated rapid-switching style rows so /events does not flood nudges."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    needle = "rapid app switching"
    row = (
        Nudge.query.filter(
            Nudge.user_id == user_id,
            Nudge.dismissed.is_(False),
            Nudge.created_at >= since,
            Nudge.message.ilike(f"%{needle}%"),
        )
        .first()
    )
    return row is not None


def _persist_in_app_rapid_switching_nudge(
    user_id: int, *, pattern: str, enforcement: bool
) -> dict | None:
    """
    Persist a normal Nudge row so GET /nudges returns it when native focus_guard delivery
    is off or the AI engine skipped persistence (cooldown).
    """
    if _has_recent_rapid_inapp_nudge(user_id, hours=3):
        return None
    msg = (
        "Spike noticed rapid app switching. A short reset could help you settle back in."
    )
    expl = (
        "SpikeSense saw several app changes in a short period, which can make it harder to stay focused."
    )
    row = Nudge(
        user_id=user_id,
        type="insight",
        message=msg,
        severity="medium",
        action_label="Take a Break",
        action_type="take_break",
        explanation=expl,
    )
    db.session.add(row)
    db.session.flush()
    logger.info(
        "[NUDGE_INAPP_PERSISTED] user_id=%s nudge_id=%s pattern=%s enforcement=%s",
        user_id,
        row.id,
        pattern,
        enforcement,
    )
    return {
        "id": row.id,
        "type": row.type,
        "message": row.message,
        "severity": row.severity,
        "explanation": expl,
        "action_label": row.action_label,
        "action_type": row.action_type,
        "pattern": pattern or "rapid_switching",
    }


def _ensure_in_app_nudge_after_detection(
    user_id: int,
    enforcement_extras: dict,
    nudge_pattern: str | None,
    triggered_nudge: dict | None,
) -> dict | None:
    """Return triggered_nudge, optionally creating a DB row for in-app cards."""
    if triggered_nudge is not None:
        return triggered_nudge
    enf = bool(enforcement_extras.get("enforcement"))
    pat = (nudge_pattern or "").strip() or ""
    if enf:
        return _persist_in_app_rapid_switching_nudge(
            user_id, pattern=pat or "rapid_switching", enforcement=True
        )
    if pat == "rapid_switching":
        return _persist_in_app_rapid_switching_nudge(
            user_id, pattern="rapid_switching", enforcement=False
        )
    return None


def _events_response_canonical_rapid_switching_payload(
    payload: dict | None,
    *,
    triggered_nudge: dict | None,
    nudge_pattern: str | None,
) -> dict | None:
    """
    Normalize real-time /events payload copy for rapid_switching only (response JSON).
    Does not alter DB rows or tracking.
    """
    if not isinstance(payload, dict):
        return payload
    pat = payload.get("pattern") or nudge_pattern
    if triggered_nudge and isinstance(triggered_nudge, dict):
        if not pat:
            pat = triggered_nudge.get("pattern")
    if str(pat or "").strip() != "rapid_switching":
        return payload
    nid = payload.get("id")
    if nid is None and isinstance(triggered_nudge, dict):
        nid = triggered_nudge.get("id")
    return {
        "id": nid,
        "message": (
            "Spike noticed rapid app switching. "
            "A short reset could help you settle back in."
        ),
        "explanation": (
            "SpikeSense saw several app changes in a short period, "
            "which can make it harder to stay focused."
        ),
        "severity": "medium",
        "pattern": "rapid_switching",
        "action_label": "Take a Break",
        "action_type": "take_break",
    }


def _is_ignored_for_top_apps(package_name: str, app_name: str) -> bool:
    """Mirror frontend untrackable packages; skip system/launcher/self in Top Apps."""
    p = (package_name or "").strip().lower()
    if p and p in _IGNORED_TOP_PACKAGES_LOWER:
        return True
    if p and (".launcher" in p or p.endswith(".launcher3")):
        return True
    a = (app_name or "").strip().lower()
    if a in _IGNORED_TOP_PACKAGES_LOWER:
        return True
    return False


def _normalize_usage_category(raw: str | None) -> str:
    c = (raw or "other").lower().strip()
    if c in ("productivity", "social", "entertainment", "other"):
        return c
    return "other"


def _aggregate_top_apps(user_id: int, target_date, limit: int = 8):
    """
    Aggregate usage_logs for a calendar day (UTC date of created_at) into top apps by duration.
    Groups by package_name when present, else by app display name.
    """
    logs = (
        UsageLog.query.filter(
            UsageLog.user_id == user_id,
            func.date(UsageLog.created_at) == target_date,
        )
        .all()
    )
    buckets: dict = {}

    for log in logs:
        meta = log.event_metadata if isinstance(log.event_metadata, dict) else {}
        pkg = (meta.get("package_name") or "").strip()
        app_name = (log.app_name or "").strip()
        if _is_ignored_for_top_apps(pkg, app_name):
            continue
        if not app_name and not pkg:
            continue
        key = pkg if pkg else f"name:{app_name}"
        if key not in buckets:
            buckets[key] = {
                "total_duration": 0,
                "usage_count": 0,
                "app_name": "",
                "package_name": pkg,
                "cat_weights": Counter(),
            }
        b = buckets[key]
        dur = int(log.duration or 0)
        b["total_duration"] += dur
        b["usage_count"] += 1
        cat = _normalize_usage_category(log.category)
        b["cat_weights"][cat] += dur
        cand = app_name
        if cand:
            looks_like_pkg = cand.startswith("com.") and "." in cand[3:]
            if not b["app_name"]:
                b["app_name"] = cand
            elif looks_like_pkg and not (b["app_name"].startswith("com.") and "." in b["app_name"][3:]):
                pass
            elif not looks_like_pkg and len(cand) > len(b["app_name"]):
                b["app_name"] = cand
            elif not looks_like_pkg and b["app_name"].startswith("com."):
                b["app_name"] = cand
        if pkg:
            b["package_name"] = pkg

    out = []
    for b in buckets.values():
        if b["usage_count"] < 1 or b["total_duration"] < 1:
            continue
        display = (b["app_name"] or "").strip()
        if not display or display.lower() in ("unknown", "null", "undefined"):
            continue
        if display.startswith("com.") and "." in display[3:] and not any(c.isupper() for c in display):
            continue
        cat = b["cat_weights"].most_common(1)[0][0] if b["cat_weights"] else "other"
        out.append(
            {
                "app_name": display,
                "package_name": b["package_name"] or "",
                "category": cat,
                "total_duration": int(b["total_duration"]),
                "usage_count": int(b["usage_count"]),
            }
        )
    out.sort(key=lambda x: -x["total_duration"])
    return out[:limit]


def _get_or_create_daily_stats_for_user(user: User, stats_date) -> DailyStats:
    """
    Return the DailyStats row for (user.id, stats_date), creating it if missing.

    Uses a SAVEPOINT for the insert so a concurrent unique-key race does not
    call session.rollback() on the outer transaction (which would drop a
    flushed UsageLog and leave daily_stats out of sync with usage_logs).
    """
    daily_stats = DailyStats.query.filter_by(user_id=user.id, date=stats_date).first()
    if daily_stats is not None:
        return daily_stats
    try:
        with db.session.begin_nested():
            daily_stats = DailyStats(user_id=user.id, date=stats_date)
            db.session.add(daily_stats)
            db.session.flush()
    except IntegrityError:
        daily_stats = DailyStats.query.filter_by(user_id=user.id, date=stats_date).first()
        if daily_stats is None:
            raise
    return daily_stats


def _rebuild_daily_stats_row_from_logs(user_id: int, target_date) -> DailyStats | None:
    """
    Recompute one day's DailyStats from usage_logs (UTC calendar date of created_at).
    Matches incremental rules in DailyStats.update_from_event for totals and switches.
    """
    logs = (
        UsageLog.query.filter(
            UsageLog.user_id == user_id,
            func.date(UsageLog.created_at) == target_date,
        )
        .order_by(UsageLog.created_at.asc(), UsageLog.id.asc())
        .all()
    )
    if not logs:
        return DailyStats.query.filter_by(user_id=user_id, date=target_date).first()

    total = prod = soc = ent = oth = 0
    last_app: str | None = None
    switches = 0
    last_at = None
    for ev in logs:
        d = int(ev.duration or 0)
        total += d
        cat = (ev.category or "other").lower()
        if cat == "productivity":
            prod += d
        elif cat == "social":
            soc += d
        elif cat == "entertainment":
            ent += d
        else:
            oth += d
        name = ev.app_name or ""
        if last_app is not None and last_app != name:
            switches += 1
        last_app = name
        ts = ev.created_at
        if ts is not None and (last_at is None or ts > last_at):
            last_at = ts

    stats = DailyStats.query.filter_by(user_id=user_id, date=target_date).first()
    if stats is None:
        stats = DailyStats(user_id=user_id, date=target_date)
        db.session.add(stats)

    stats.total_usage_seconds = total
    stats.productivity_seconds = prod
    stats.social_seconds = soc
    stats.entertainment_seconds = ent
    stats.other_seconds = oth
    stats.app_switches = switches
    stats.last_event_at = last_at
    return stats


def _sync_daily_stats_if_behind_usage_logs(
    user_id: int, target_date, stats: DailyStats | None
) -> tuple[DailyStats | None, bool]:
    """
    If usage_logs for target_date are newer or heavier than the daily_stats row,
    rebuild DailyStats from logs so GET /stats/daily cannot stay stale behind logs.
    """
    agg = (
        db.session.query(
            func.max(UsageLog.created_at),
            func.coalesce(func.sum(UsageLog.duration), 0),
        )
        .filter(
            UsageLog.user_id == user_id,
            func.date(UsageLog.created_at) == target_date,
        )
        .one()
    )
    max_at, sum_dur = agg[0], int(agg[1] or 0)
    if max_at is None:
        return stats, False

    needs = False
    if stats is None:
        needs = True
    else:
        if stats.last_event_at is None or max_at > stats.last_event_at:
            needs = True
        elif int(stats.total_usage_seconds or 0) != sum_dur:
            needs = True

    if not needs:
        return stats, False

    logger.info(
        "[DAILY_STATS_RECONCILE] user_id=%s date=%s max_log_at=%s sum_duration=%s "
        "prev_last_event_at=%s prev_total_sec=%s",
        user_id,
        target_date,
        max_at.isoformat() if max_at else None,
        sum_dur,
        stats.last_event_at.isoformat() if stats and stats.last_event_at else None,
        int(stats.total_usage_seconds or 0) if stats else None,
    )
    rebuilt = _rebuild_daily_stats_row_from_logs(user_id, target_date)
    return rebuilt, True


def _compute_daily_focus_score(stats: DailyStats) -> tuple[int, str]:
    """
    Daily focus score (0–100) from aggregated usage, using the same structural
    signals as PatternDetector window metrics:
    - impulsive_switches → daily app_switches (fragmentation proxy)
    - intentional_sessions → 5-minute productivity blocks
    - entertainment_seconds / total_seconds → entertainment share
    """
    impulsive_switches = int(stats.app_switches or 0)
    entertainment_seconds = int(stats.entertainment_seconds or 0)
    total_seconds = max(1, int(stats.total_usage_seconds or 0))
    productivity_seconds = int(stats.productivity_seconds or 0)

    intentional_sessions = min(10, productivity_seconds // 300)

    impulsive_penalty = min(50, impulsive_switches * 5)
    entertainment_ratio = entertainment_seconds / total_seconds
    entertainment_penalty = int(entertainment_ratio * 30)
    intentional_bonus = min(20, intentional_sessions * 2)

    raw = 100 - impulsive_penalty - entertainment_penalty + intentional_bonus
    focus_score = max(0, min(100, int(round(raw))))

    if impulsive_penalty >= entertainment_penalty and impulsive_penalty >= 15:
        reason = "Lots of app switching can make it harder to settle in—nothing wrong with a busy day."
    elif entertainment_penalty > impulsive_penalty and entertainment_penalty >= 10:
        reason = "Entertainment took a large share of screen time today—that’s okay; balance can shift day to day."
    elif intentional_bonus >= 8:
        reason = "You carved out meaningful stretches for productive apps—that supported your score."
    elif focus_score >= 75:
        if productivity_seconds < 300:
            reason = (
                "Your usage stayed relatively calm today—your score reflects lower switching "
                "and balanced screen time so far, not deep work time."
            )
        else:
            reason = "Your usage looked steady today, without too much bouncing around."
    else:
        reason = "Your score reflects switching, entertainment, and productive time—small tweaks add up over time."

    return focus_score, reason


def _serialize_earned_badge(ub: UserBadge, badge_row: Badge) -> dict:
    return serialize_earned_badge_dict(badge_row, ub)


def _try_award_badges_from_daily_challenges(user_id: int, challenges: list) -> None:
    """
    Award badges tied to *completed* daily challenges (see daily_challenges_engine).

    Stay-under challenges remain completed=false during the day — no SWITCH_TAMER /
    LOOP_BREAKER / INSTAGRAM_ESCAPE awards here until a dedicated EOD pass exists.
    """
    if not challenges:
        return
    completed = [c for c in challenges if c.get("completed")]
    keys_done = {c.get("challenge_key") for c in completed}

    if "FOCUS_SESSION_STARTER" in keys_done:
        desc = db_seed_description("DEEP_FOCUS")
        if _award_badge_if_missing(user_id, "DEEP_FOCUS_SESSION", desc[:255]):
            logger.info(
                "[BACKEND][BADGE_AWARDED_FROM_CHALLENGE] challenge=FOCUS_SESSION_STARTER "
                "badge=DEEP_FOCUS_SESSION canonical=DEEP_FOCUS"
            )

    if len(completed) >= 3:
        desc = db_seed_description("RHYTHM_BUILDER")
        if _award_badge_if_missing(user_id, "CHALLENGE_TRIPLE", desc[:255]):
            logger.info(
                "[BACKEND][BADGE_AWARDED_FROM_CHALLENGE] challenge=three_daily_completed "
                "badge=CHALLENGE_TRIPLE canonical=RHYTHM_BUILDER"
            )

    if challenges[0].get("completed"):
        top_key = challenges[0].get("challenge_key") or ""
        desc = db_seed_description("SPIKE_APPROVED")
        if _award_badge_if_missing(user_id, "SPIKE_APPROVED", desc[:255]):
            logger.info(
                "[BACKEND][BADGE_AWARDED_FROM_CHALLENGE] challenge=%s badge=SPIKE_APPROVED",
                top_key,
            )


def _compose_nudge_explanation(pattern: str, metrics: dict, _context: dict) -> str:
    """Rule-based, honest copy for the client."""
    ent_sec = float(metrics.get("entertainment_seconds", 0))
    ent_min = max(0, int(round(ent_sec / 60.0)))

    if pattern == "rapid_switching":
        return (
            "SpikeSense saw several app changes in a short period, which can make it harder to stay focused."
        )
    if pattern == "entertainment_overload":
        return (
            f"Entertainment usage was about {ent_min} minutes in that window—enough to match the entertainment-overload rule."
        )
    return (
        "Your cognitive state changed from recent app usage; this nudge matched the transition rules."
    )


def _fallback_nudge_explanation(n: Nudge) -> str | None:
    """Older rows without `explanation` stored."""
    t = (n.type or "").lower()
    if t in ("insight", "support"):
        return (
            "Based on a recent shift in your tracked focus state and app-switch activity."
        )
    if t == "entertainment_overload":
        return "Based on entertainment-heavy usage in your recent window."
    if t == "app_switching":
        return "Based on frequent app switching compared to your thresholds."
    return None


def _award_badge_if_missing(user_id: int, badge_name: str, badge_description: str) -> bool:
    """
    Award a badge to a user if they haven't earned it yet.
    Returns True if a new UserBadge row was created.
    """
    badge = _get_or_create_badge_by_name(badge_name, badge_description)
    existing = UserBadge.query.filter_by(user_id=user_id, badge_id=badge.id).first()
    if existing:
        return False
    db.session.add(UserBadge(user_id=user_id, badge_id=badge.id))
    return True


def _get_or_create_challenge_by_title(title: str, description: str, metadata: dict | None = None):
    """
    Normalized challenge lookup/seed.
    Challenges are canonical rows in `challenges`; users participate via `user_challenges`.
    """
    challenge = Challenge.query.filter_by(title=title).first()
    if challenge:
        # Merge in missing metadata keys (keep existing values if present)
        if metadata:
            current = challenge.challenge_metadata or {}
            merged = {**metadata, **current}
            if merged != current:
                challenge.challenge_metadata = merged
        return challenge

    challenge = Challenge(title=title, description=description, challenge_metadata=metadata)
    db.session.add(challenge)
    db.session.flush()
    return challenge


def update_streak_and_badges(user_id):

    today = datetime.now(timezone.utc).date()

    streak = Streak.query.filter_by(user_id=user_id).first()

    if not streak:
        streak = Streak(
            user_id=user_id,
            last_active_date=today,
            current_streak=1,
            longest_streak=1,
        )
        db.session.add(streak)

    else:

        if streak.last_active_date == today:
            pass

        elif streak.last_active_date == today - timedelta(days=1):
            streak.current_streak += 1
            if streak.current_streak > (streak.longest_streak or 0):
                streak.longest_streak = streak.current_streak
            streak.last_active_date = today

        else:
            prev_date = streak.last_active_date
            streak.last_active_date = today
            streak.current_streak = 1
            if prev_date is not None and prev_date < today - timedelta(days=1):
                _award_badge_if_missing(
                    user_id=user_id,
                    badge_name="COMEBACK_DAY",
                    badge_description="Comeback",
                )

    if streak.current_streak == 3:
        _award_badge_if_missing(
            user_id=user_id,
            badge_name="FOCUS_STREAK_3",
            badge_description="Locked In",
        )


# Behavior challenges (PatternDetector window metrics; evaluated on each ingest).
BEHAVIOR_CHALLENGES = {
    "STABILITY_WINDOW": {
        "title": "Stay Steady",
        "description": "Keep your app switching calm for a short period",
    },
    "FOCUS_BLOCK": {
        "title": "Deep Focus",
        "description": "Stay on one task long enough to build momentum",
    },
    "ENTERTAINMENT_BALANCE": {
        "title": "Stay Balanced",
        "description": "Keep entertainment from dominating your screen time",
    },
    "RECOVERY": {
        "title": "Reset & Recover",
        "description": "Bounce back into focus after distraction",
    },
    "LOW_IMPULSE": {
        "title": "Be Intentional",
        "description": "Avoid quick, impulsive app switching",
    },
}


def _pick_today_challenge_key(user_id: int, today) -> str:
    keys = list(BEHAVIOR_CHALLENGES.keys())
    h = (user_id * 31 + today.toordinal()) % len(keys)
    return keys[h]


def _get_or_create_behavior_challenge_row(challenge_key: str) -> Challenge:
    """
    One canonical Challenge row per behavior challenge_key (stable id even when copy changes).
    """
    spec = BEHAVIOR_CHALLENGES[challenge_key]
    meta_match = {"challenge_key": challenge_key, "kind": "behavior_v1"}
    for row in Challenge.query.all():
        m = row.challenge_metadata or {}
        if m.get("challenge_key") == challenge_key and m.get("kind") == "behavior_v1":
            if row.title != spec["title"] or row.description != spec["description"]:
                row.title = spec["title"]
                row.description = spec["description"]
            return row
    ch = Challenge(
        title=spec["title"],
        description=spec["description"],
        challenge_metadata=dict(meta_match),
    )
    db.session.add(ch)
    db.session.flush()
    return ch


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _window_has_activity(metrics: dict, min_total_seconds: float = 30.0) -> bool:
    """Avoid completing behavior challenges on an empty / bootstrap window."""
    return float(metrics.get("total_seconds") or 0) >= min_total_seconds


def _evaluate_behavior_challenge(
    key: str,
    metrics: dict,
    event_duration_sec: int,
    previous_state_str: str | None,
    current_state,
) -> tuple[float, bool]:
    """Returns (progress 0..1, completed_this_window)."""
    sr = float(metrics.get("switch_rate") or 0)
    imp = int(metrics.get("impulsive_switches") or 0)
    intentional = int(metrics.get("intentional_sessions") or 0)
    ent = float(metrics.get("entertainment_seconds") or 0)
    total = max(1.0, float(metrics.get("total_seconds") or 1))
    ratio = ent / total

    cur_s = (
        current_state.value.lower()
        if current_state is not None and hasattr(current_state, "value")
        else (str(current_state).lower() if current_state is not None else "")
    )
    prev_s = (previous_state_str or "").lower()

    if key == "STABILITY_WINDOW":
        prog = _clamp01(max(0.0, 1.0 - (sr / 1.5)))
        done = sr <= 0.5 and imp <= 3 and _window_has_activity(metrics, 120.0)
        return prog, done

    if key == "FOCUS_BLOCK":
        dur = max(0, int(event_duration_sec or 0))
        base = min(1.0, float(dur) / 900.0) if intentional >= 1 else 0.0
        prog = _clamp01(base)
        done = intentional >= 1 and dur >= 900
        return prog, done

    if key == "ENTERTAINMENT_BALANCE":
        prog = _clamp01(max(0.0, 1.0 - (ratio / 0.7)))
        done = ratio <= 0.4 and _window_has_activity(metrics)
        return prog, done

    if key == "RECOVERY":
        done = "overstimulated" in prev_s and cur_s == "focused"
        prog = _clamp01(1.0 if done else 0.0)
        return prog, done

    if key == "LOW_IMPULSE":
        prog = _clamp01(max(0.0, 1.0 - (float(imp) / 4.0)))
        done = imp <= 2 and _window_has_activity(metrics)
        return prog, done

    return 0.0, False


def ensure_today_behavior_challenge(user_id: int) -> UserChallenge | None:
    """One behavior challenge per user per day (type rotates deterministically)."""
    today = datetime.now(timezone.utc).date()
    key = _pick_today_challenge_key(user_id, today)
    base = _get_or_create_behavior_challenge_row(key)
    challenge = (
        UserChallenge.query.filter(
            UserChallenge.user_id == user_id,
            UserChallenge.challenge_id == base.id,
            func.date(UserChallenge.started_at) == today,
        )
        .with_for_update()
        .order_by(UserChallenge.started_at.desc())
        .first()
    )
    if not challenge:
        challenge = UserChallenge(
            user_id=user_id,
            challenge_id=base.id,
            progress=0,
        )
        db.session.add(challenge)
    return challenge


def apply_behavior_challenge_update(
    user_id: int,
    previous_state_str: str | None,
    detection: dict | None,
    event_duration_sec: int,
) -> None:
    """Update today's UserChallenge from latest PatternDetector window metrics."""
    uc = ensure_today_behavior_challenge(user_id)
    if not uc:
        return
    ch = db.session.get(Challenge, uc.challenge_id)
    if not ch or (ch.challenge_metadata or {}).get("kind") != "behavior_v1":
        return
    key = (ch.challenge_metadata or {}).get("challenge_key")
    if not key:
        return

    metrics = (detection or {}).get("metrics") or {}
    cur_state = (detection or {}).get("state") if detection else None

    prog, done = _evaluate_behavior_challenge(
        key,
        metrics,
        event_duration_sec,
        previous_state_str,
        cur_state,
    )
    prev_p = (uc.progress or 0) / 100.0
    final_p = _clamp01(max(prev_p, prog))
    was_completed = bool(uc.completed)
    uc.progress = int(round(final_p * 100))
    uc.completed = bool(uc.completed or done)

    logger.info(
        "[CHALLENGE_ENGINE] challenge=%s progress=%.3f completed=%s user_id=%s",
        key,
        final_p,
        uc.completed,
        user_id,
    )

    if not was_completed and uc.completed:
        db.session.flush()
        done_n = UserChallenge.query.filter_by(user_id=user_id, completed=True).count()
        if done_n >= 3:
            _award_badge_if_missing(
                user_id=user_id,
                badge_name="CHALLENGE_TRIPLE",
                badge_description="Rhythm Builder",
            )


def _focus_session_minutes_completed_today(user_id: int, today) -> float:
    rows = (
        FocusSession.query.filter(
            FocusSession.user_id == user_id,
            FocusSession.end_time.isnot(None),
            func.date(FocusSession.start_time) == today,
        ).all()
    )
    return float(sum(int(r.duration_minutes or 0) for r in rows))


def _achievements_challenge_payload(user_id: int, today) -> list[dict]:
    """3–5 behavior-aware daily challenges; reconciles daily_stats from usage_logs first."""
    stats = DailyStats.query.filter_by(user_id=user_id, date=today).first()
    stats, repaired = _sync_daily_stats_if_behind_usage_logs(user_id, today, stats)
    if repaired:
        db.session.flush()
        if stats is not None:
            db.session.refresh(stats)
    top_apps = _aggregate_top_apps(user_id, today, limit=8)
    focus_min = _focus_session_minutes_completed_today(user_id, today)
    if stats is None:
        raw_metrics = {
            "total_usage_seconds": 0,
            "social_seconds": 0,
            "entertainment_seconds": 0,
            "productivity_seconds": 0,
            "app_switches": 0,
            "peak_switch_rate": 0.0,
            "top_apps": top_apps,
            "focus_session_minutes_completed": focus_min,
        }
    else:
        total_sec = max(1, int(stats.total_usage_seconds or 0))
        sw = int(stats.app_switches or 0)
        peak = round((sw * 3600.0) / float(total_sec), 4)
        raw_metrics = {
            "total_usage_seconds": int(stats.total_usage_seconds or 0),
            "social_seconds": int(getattr(stats, "social_seconds", 0) or 0),
            "entertainment_seconds": int(stats.entertainment_seconds or 0),
            "productivity_seconds": int(stats.productivity_seconds or 0),
            "app_switches": sw,
            "peak_switch_rate": peak,
            "top_apps": top_apps,
            "focus_session_minutes_completed": focus_min,
        }
    return build_challenges_response(user_id, today.isoformat(), raw_metrics)


# -------------------------------------------------------
# Achievements (Badges + Challenges)
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/achievements", methods=["GET"])
def get_achievements(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    today = datetime.now(timezone.utc).date()

    try:
        ensure_today_behavior_challenge(user_id)
        db.session.commit()
    except Exception:
        logger.exception("ensure_today_behavior_challenge failed user=%s", user_id)
        db.session.rollback()

    challenges_payload: list[dict] = []
    try:
        challenges_payload = _achievements_challenge_payload(user_id, today)
        _try_award_badges_from_daily_challenges(user_id, challenges_payload)
        db.session.commit()
    except Exception:
        logger.exception(
            "_achievements_challenge_payload or challenge badge award failed user=%s",
            user_id,
        )
        db.session.rollback()

    today_challenge = challenges_payload[0] if challenges_payload else None

    badge_rows = (
        db.session.query(UserBadge, Badge)
        .join(Badge, Badge.id == UserBadge.badge_id)
        .filter(UserBadge.user_id == user_id)
        .order_by(UserBadge.earned_at.desc())
        .all()
    )
    badges_raw = [_serialize_earned_badge(ub, b) for (ub, b) in badge_rows]
    # One card per canonical key (keep most recently earned).
    by_key: dict[str, dict] = {}
    for b in badges_raw:
        k = b.get("badge_key")
        if not isinstance(k, str) or not k:
            continue
        prev = by_key.get(k)
        if not prev or (b.get("earned_at") or "") > (prev.get("earned_at") or ""):
            by_key[k] = b
    badges = sorted(by_key.values(), key=lambda x: x.get("earned_at") or "", reverse=True)
    earned_canonical = set(by_key.keys())
    locked_payload = available_badges_payload(earned_canonical)

    streak = Streak.query.filter_by(user_id=user_id).first()
    streaks_payload = {
        "current_streak": int(streak.current_streak or 0) if streak else 0,
        "longest_streak": int(streak.longest_streak or 0) if streak else 0,
        "last_active_date": streak.last_active_date.isoformat() if streak and streak.last_active_date else None,
    }

    return jsonify(
        {
            "success": True,
            "badges": badges,
            "available_badges": locked_payload,
            "today_challenge": today_challenge,
            "streaks": streaks_payload,
            "challenges": challenges_payload,
        }
    ), 200


# -------------------------------------------------------
# Health Check
# -------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# -------------------------------------------------------
# Create User
# -------------------------------------------------------

@app.route("/api/users", methods=["POST"])
def create_user():

    data = request.get_json()

    device_id = data.get("device_id")

    if not device_id:
        return jsonify({"success": False, "error": "device_id required"}), 400

    user = User.query.filter_by(device_id=device_id).first()

    if user:
        return jsonify({
            "success": True,
            "user_id": user.id
        })

    user = User(
        device_id=device_id,
        name=data.get("name", "User"),
        email=data.get("email"),
        mode_preference=data.get("mode_preference", "balanced")
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "user_id": user.id
    })


# -------------------------------------------------------
# Unified Event Ingestion Endpoint
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/events", methods=["POST"])
def ingest_event(user_id):

    try:

        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "Invalid JSON"}), 400

        app_name = data.get("app_name")
        category = data.get("category")
        # Frontend sends `duration` in seconds; map directly to the UsageLog.duration field
        duration = data.get("duration", 0)

        logger.info(
            "[EVENT_RECEIVED] user_id=%s app_name=%s category=%s duration=%s",
            user_id,
            app_name,
            category,
            duration,
        )

        if _should_skip_quick_duplicate_event(user_id, app_name, duration):
            logger.info(
                "[EVENT_DEDUPE_SKIP] user_id=%s app_name=%s duration=%s (no usage_log, no daily_stats update)",
                user_id,
                app_name,
                duration,
            )
            logger.info(
                "[BACKEND][EVENT_RESPONSE_DELIVERY] user_id=%s delivery=None has_payload=False reason=deduplicated",
                user_id,
            )
            return jsonify(
                {
                    "success": True,
                    "deduplicated": True,
                    "nudge_delivery": None,
                    "nudge_payload": None,
                }
            ), 200

        # Optional additional metadata – stored as JSON, never used in set/dict keys
        event_metadata = (
            dict(data["metadata"]) if isinstance(data.get("metadata"), dict) else {}
        )
        pkg_in = data.get("package_name")
        if isinstance(pkg_in, str) and pkg_in.strip():
            event_metadata["package_name"] = pkg_in.strip()
        if not event_metadata:
            event_metadata = None

        user = User.query.get_or_404(user_id)

        # ----------------------------------
        # Store raw usage event
        # ----------------------------------

        log = UsageLog(
            user_id=user_id,
            app_name=app_name,
            category=category,
            duration=duration,
            event_metadata=event_metadata,
        )

        db.session.add(log)
        db.session.flush()
        logger.info("[USAGE_LOG_INSERTED] user_id=%s usage_log_id=%s", user_id, log.id)

        try:
            dur_int = int(duration or 0)
            if dur_int >= 900:
                _award_badge_if_missing(
                    user_id=user_id,
                    badge_name="DEEP_FOCUS_SESSION",
                    badge_description=db_seed_description("DEEP_FOCUS")[:255],
                )
        except (TypeError, ValueError):
            pass

        # ----------------------------------
        # Get or Create DailyStats (same calendar day as this log's created_at, UTC)
        # ----------------------------------

        stats_date = (
            log.created_at.date()
            if log.created_at is not None
            else datetime.now(timezone.utc).date()
        )

        daily_stats = _get_or_create_daily_stats_for_user(user, stats_date)

        logger.info(
            "[DAILY_STATS_BEFORE] user_id=%s date=%s total_usage_seconds=%s app_switches=%s last_event_at=%s",
            user_id,
            stats_date,
            daily_stats.total_usage_seconds,
            daily_stats.app_switches,
            daily_stats.last_event_at.isoformat() if daily_stats.last_event_at else None,
        )

        daily_stats.update_from_event(log, user)

        logger.info(
            "[DAILY_STATS_AFTER] user_id=%s date=%s total_usage_seconds=%s app_switches=%s last_event_at=%s",
            user_id,
            stats_date,
            daily_stats.total_usage_seconds,
            daily_stats.app_switches,
            daily_stats.last_event_at.isoformat() if daily_stats.last_event_at else None,
        )

        # ----------------------------------
        # AI Pattern Detection (adaptive mode → PatternDetector focus_mode)
        # ----------------------------------

        previous_state = user.last_known_state
        current_state = previous_state
        detection = None

        try:
            effective_mode = resolve_effective_mode_for_user(user)
        except Exception:
            logger.exception("[MODE_SELECTOR] resolve failed user_id=%s", user_id)
            effective_mode = fallback_balanced_effective_mode()

        logger.info(
            "[MODE_SELECTOR] user_id=%s mode=%s confidence=%s auto=%s detector=%s nudge=%s lock=%s",
            user_id,
            effective_mode["mode"],
            effective_mode["confidence"],
            effective_mode["auto"],
            effective_mode["focus_mode_detector"],
            effective_mode["focus_mode_nudge"],
            effective_mode.get("manual_lock", False),
        )
        logger.info(
            "[ADAPTIVE_THRESHOLDS] user_id=%s mode=%s mult=%s cooldown_h=%s",
            user_id,
            effective_mode["mode"],
            effective_mode.get("pattern_profile_multipliers"),
            effective_mode.get("nudge_cooldown_hours"),
        )

        if AI_ENABLED and pattern_detector:

            # Map incoming fields to the UsageEvent dataclass used by the AI pipeline
            usage_event = UsageEvent(
                user_id=user_id,
                app_name=app_name,
                category=category,
                duration=duration,
                timestamp=log.created_at,
            )

            thresholds = _get_user_thresholds_dict(user_id)
            profile_mult = effective_mode.get("pattern_profile_multipliers") or {}

            try:
                # focus_mode maps to Work / Personal / Sleep; profile multipliers apply on top
                detection = pattern_detector.process_event(
                    usage_event,
                    focus_mode=effective_mode["focus_mode_detector"],
                    personalized_thresholds=thresholds,
                    mode_profile_multipliers=profile_mult,
                )
            except Exception as e:
                # Never let AI failures break ingestion; log and continue
                logger.error("Pattern detector error for user %s: %s", user_id, e)
                detection = None

            if detection and "state" in detection:
                current_state = detection["state"]
                if detection.get("effective_thresholds"):
                    logger.debug(
                        "[ADAPTIVE_THRESHOLDS] user_id=%s effective=%s",
                        user_id,
                        detection.get("effective_thresholds"),
                    )

        # Persist state as string for DB and comparisons
        state_str = (
            current_state.value if hasattr(current_state, "value") else str(current_state or "focused")
        )
        user.last_known_state = state_str

        # ----------------------------------
        # Smart Nudge Engine
        # ----------------------------------

        triggered_nudge = None
        nudge_pattern: str | None = None

        if previous_state != current_state and AI_ENABLED and nudge_engine and detection:

            # Normalize state to string (detection["state"] may be CognitiveState enum)
            prev_str = previous_state or "focused"
            cur_str = (
                detection["state"].value
                if hasattr(detection["state"], "value")
                else str(detection["state"])
            )

            # Derive pattern from metrics (rapid_switching, entertainment_overload, or generic)
            metrics = detection.get("metrics") or {}
            switches = int(metrics.get("switches", 0))
            impulsive = int(metrics.get("impulsive_switches", 0))
            entertainment_sec = float(metrics.get("entertainment_seconds", 0))
            if switches >= 6 or impulsive >= 4:
                pattern = "rapid_switching"
            elif entertainment_sec / 60 >= 5:
                pattern = "entertainment_overload"
            else:
                pattern = "generic"

            # Severity: low, medium, high
            sev = detection.get("severity", "medium")
            severity_str = (
                sev.name.lower()
                if hasattr(sev, "name")
                else (str(sev).lower() if sev else "medium")
            )
            if severity_str not in ("low", "medium", "high"):
                severity_str = "medium"
            nudge_pattern = pattern

            # Context for message templates
            context = {
                "switch_count": switches,
                "entertainment_time": int(entertainment_sec / 60),
                "score": detection.get("score", 0),
            }

            cd_hours = effective_mode.get("nudge_cooldown_hours")
            nudge_payload = nudge_engine.generate_nudge(
                user_id=user_id,
                pattern=pattern,
                severity=severity_str,
                context=context,
                previous_state=prev_str,
                current_state=cur_str,
                focus_mode=effective_mode["focus_mode_nudge"],
                nudge_cooldown_hours=cd_hours,
            )

            if nudge_payload:
                logger.info(
                    "[NUDGE_COOLDOWN_EFFECTIVE] user_id=%s pattern=%s mode=%s cooldown_h=%s",
                    user_id,
                    pattern,
                    effective_mode["mode"],
                    cd_hours,
                )

                nudge_explanation = _compose_nudge_explanation(pattern, metrics, context)

                nudge_row = Nudge(
                    user_id=user_id,
                    type=nudge_payload["type"],
                    message=nudge_payload["message"],
                    severity=nudge_payload["severity"],
                    action_label=nudge_payload.get("action_label"),
                    action_type=nudge_payload.get("action_type"),
                    explanation=nudge_explanation,
                )

                db.session.add(nudge_row)
                db.session.flush()  # id for real-time nudge payload

                triggered_nudge = {
                    "id": nudge_row.id,
                    "type": nudge_payload["type"],
                    "message": nudge_payload["message"],
                    "severity": nudge_payload["severity"],
                    "explanation": nudge_explanation,
                    "action_label": nudge_payload.get("action_label"),
                    "action_type": nudge_payload.get("action_type"),
                    "pattern": nudge_pattern,
                }

        # ----------------------------------
        # Update Streak / Challenges (non-critical)
        # ----------------------------------

        try:
            update_streak_and_badges(user_id)
            logger.debug("[GAMIFICATION UPDATED] user=%s (streaks/badges)", user_id)

            apply_behavior_challenge_update(
                user_id,
                previous_state,
                detection,
                int(duration or 0),
            )
        except Exception as e:
            # Gamification failures must never break ingestion
            logger.error("Streak/challenge update error for user %s: %s", user_id, e)

        enforcement_extras: dict = {}
        try:
            enforcement_extras = apply_focus_enforcement_signal(
                user_id,
                app_name,
                category,
            )
        except Exception:
            logger.exception(
                "[FOCUS_ENFORCEMENT] evaluation failed user_id=%s (ingestion continues)",
                user_id,
            )

        triggered_nudge = _ensure_in_app_nudge_after_detection(
            user_id, enforcement_extras, nudge_pattern, triggered_nudge
        )

        db.session.commit()

        logger.info(
            "[DAILY_STATS_COMMITTED] user_id=%s date=%s total_usage_seconds=%s last_event_at=%s",
            user_id,
            stats_date,
            daily_stats.total_usage_seconds,
            daily_stats.last_event_at.isoformat() if daily_stats.last_event_at else None,
        )

        nudge_payload_out: dict | None = None
        nudge_delivery: str | None = None
        is_enf = bool(enforcement_extras.get("enforcement"))

        if is_enf:
            nudge_delivery = "focus_guard"
            if triggered_nudge:
                nudge_payload_out = build_nudge_payload(
                    triggered_nudge, pattern=nudge_pattern, enforcement=True
                )
            else:
                nudge_payload_out = {
                    "id": None,
                    "message": (
                        "Spike noticed rapid app switching. "
                        "A short reset could help you settle back in."
                    ),
                    "explanation": (
                        "SpikeSense saw several app changes in a short period, "
                        "which can make it harder to stay focused."
                    ),
                    "severity": "medium",
                    "pattern": "rapid_switching",
                    "action_label": "Take a Break",
                    "action_type": "take_break",
                }
        elif triggered_nudge:
            nudge_delivery = select_nudge_delivery_tier(
                False, True, triggered_nudge.get("severity")
            )
            nudge_payload_out = build_nudge_payload(
                triggered_nudge, pattern=nudge_pattern, enforcement=False
            )
            if nudge_delivery is None or nudge_payload_out is None:
                nudge_delivery = None
                nudge_payload_out = None

        if isinstance(nudge_payload_out, dict):
            nudge_payload_out = _events_response_canonical_rapid_switching_payload(
                nudge_payload_out,
                triggered_nudge=triggered_nudge,
                nudge_pattern=nudge_pattern,
            )

        if nudge_delivery is not None:
            log_delivery_selected(
                user_id, nudge_delivery, triggered_nudge, pattern=nudge_pattern
            )

        if is_enf and nudge_delivery:
            delivery_reason = "focus_enforcement"
        elif triggered_nudge and nudge_delivery and nudge_payload_out is not None:
            delivery_reason = "pattern_nudge"
        elif triggered_nudge:
            delivery_reason = "pattern_nudge_incomplete"
        else:
            delivery_reason = "no_delivery"

        response: dict = {
            "success": True,
            "current_state": state_str,
            "total_usage_seconds": daily_stats.total_usage_seconds,
            "nudge": triggered_nudge,
            **enforcement_extras,
            "nudge_delivery": nudge_delivery,
            "nudge_payload": nudge_payload_out,
        }
        logger.info(
            "[BACKEND][EVENT_RESPONSE_DELIVERY] user_id=%s delivery=%s has_payload=%s reason=%s",
            user_id,
            nudge_delivery,
            nudge_payload_out is not None,
            delivery_reason,
        )
        return jsonify(response)

    except Exception as e:

        db.session.rollback()

        logger.error("Event ingestion error: %s", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# -------------------------------------------------------
# Get Nudges
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/nudges", methods=["GET"])
def get_nudges(user_id):

    since = datetime.now(timezone.utc) - timedelta(hours=24)

    nudges = Nudge.query.filter(
        Nudge.user_id == user_id,
        Nudge.dismissed == False,
        Nudge.created_at >= since
    ).order_by(Nudge.created_at.desc()).all()

    def _nudge_pattern_field(n: Nudge) -> str | None:
        m = (n.message or "").lower()
        if "rapid app switching" in m or "spike noticed rapid" in m:
            return "rapid_switching"
        return None

    return jsonify({
        "success": True,
        "nudges": [{
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "severity": n.severity,
            "created_at": n.created_at.isoformat(),
            "explanation": getattr(n, "explanation", None) or _fallback_nudge_explanation(n),
            "action_label": n.action_label,
            "action_type": n.action_type,
            "pattern": _nudge_pattern_field(n),
        } for n in nudges]
    })


# -------------------------------------------------------
# Dismiss Nudge
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/nudges/<int:nudge_id>/dismiss", methods=["POST"])
def dismiss_nudge(user_id, nudge_id):

    nudge = Nudge.query.filter_by(
        id=nudge_id,
        user_id=user_id
    ).first_or_404()

    nudge.dismissed = True
    nudge.dismissed_at = datetime.now(timezone.utc)

    try:
        _award_badge_if_missing(
            user_id=user_id,
            badge_name="TOOK_THE_HINT",
            badge_description="Took the Hint",
        )
    except Exception:
        logger.exception("dismiss_nudge badge award failed user=%s", user_id)

    db.session.commit()

    return jsonify({
        "success": True
    })
# -------------------------------------------------------
# Get Daily Stats
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/stats/daily", methods=["GET"])
def get_daily_stats(user_id):

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    # default to today if no date provided
    date_str = request.args.get("date")

    try:
        if date_str:
            target_date = datetime.fromisoformat(date_str).date()
        else:
            target_date = datetime.now(timezone.utc).date()
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid date format. Use YYYY-MM-DD"
        }), 400

    stats = DailyStats.query.filter_by(
        user_id=user_id,
        date=target_date
    ).first()

    stats, stats_repaired = _sync_daily_stats_if_behind_usage_logs(user_id, target_date, stats)
    if stats_repaired:
        db.session.commit()
        if stats is not None:
            db.session.refresh(stats)
        logger.info(
            "[STATS_RECONCILED_IF_STALE] user_id=%s date=%s total_usage_seconds=%s app_switches=%s",
            user_id,
            target_date,
            int(stats.total_usage_seconds or 0) if stats else 0,
            int(stats.app_switches or 0) if stats else 0,
        )

    # Helper to convert seconds → minutes (float)
    def _sec_to_min(value: int | None) -> float:
        return (value or 0) / 60.0

    top_apps = _aggregate_top_apps(user_id, target_date, limit=8)

    # If no stats yet, return zeroed structure
    if not stats:
        return jsonify({
            "success": True,
            "stats": {
                "date": target_date.isoformat(),
                "total_usage_seconds": 0,
                "productivity_seconds": 0,
                "social_seconds": 0,
                "entertainment_seconds": 0,
                "other_seconds": 0,
                "app_switches": 0,
                # Backwards-compatible minute-based fields expected by the app
                "total_screen_time": 0,
                "productivity_time": 0,
                "social_time": 0,
                "entertainment_time": 0,
                "other_time": 0,
                "focus_time": 0,
                "focus_score": 0,
                "focus_score_reason": "Once you use your phone today, we'll shape your focus score from your patterns.",
                "total_seconds": 0,
                "peak_switch_rate": 0.0,
                "impulsive_switches": None,
            },
            "top_apps": top_apps,
            "adaptive_mode": _adaptive_mode_for_response(user),
        })

    focus_score, focus_score_reason = _compute_daily_focus_score(stats)
    total_sec = max(1, int(stats.total_usage_seconds or 0))
    sw = int(stats.app_switches or 0)
    # Daily intensity: app switches per hour of recorded screen time (no window-level detector here)
    peak_switch_rate = round((sw * 3600.0) / float(total_sec), 4)

    return jsonify({
        "success": True,
        "stats": {
            "date": stats.date.isoformat(),
            # Raw seconds
            "total_usage_seconds": stats.total_usage_seconds or 0,
            "total_seconds": stats.total_usage_seconds or 0,
            "productivity_seconds": stats.productivity_seconds or 0,
            "social_seconds": getattr(stats, "social_seconds", 0) or 0,
            "entertainment_seconds": stats.entertainment_seconds or 0,
            "other_seconds": getattr(stats, "other_seconds", 0) or 0,
            "app_switches": stats.app_switches or 0,
            "last_event_at": stats.last_event_at.isoformat() if stats.last_event_at else None,
            # Minute-based fields expected by the existing frontend
            "total_screen_time": _sec_to_min(stats.total_usage_seconds),
            "productivity_time": _sec_to_min(stats.productivity_seconds),
            "social_time": _sec_to_min(getattr(stats, "social_seconds", 0)),
            "entertainment_time": _sec_to_min(stats.entertainment_seconds),
            "other_time": _sec_to_min(getattr(stats, "other_seconds", 0)),
            "focus_time": _sec_to_min(stats.productivity_seconds),
            "focus_score": focus_score,
            "focus_score_reason": focus_score_reason,
            "peak_switch_rate": peak_switch_rate,
            "impulsive_switches": None,
        },
        "top_apps": top_apps,
        "adaptive_mode": _adaptive_mode_for_response(user),
    })

@app.route("/api/users/<int:user_id>", methods=["PATCH"])
def update_user(user_id):
    try:
        data = request.get_json()

        user = User.query.get_or_404(user_id)

        if "mode_preference" in data:
            user.mode_preference = data["mode_preference"]

        db.session.commit()

        return jsonify({
            "success": True,
            "user_id": user.id,
            "mode_preference": user.mode_preference
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
# -------------------------------------------------------
# User Thresholds (Read-only)
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/thresholds", methods=["GET"])
def get_user_thresholds(user_id):
    """
    Return the user's threshold settings for the AI engine.
    If none exist, return sensible defaults so the frontend
    always receives a consistent JSON structure.
    """

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    thresholds = UserThreshold.query.filter_by(user_id=user_id).first()

    if not thresholds:
        payload = {
            "switch_threshold": 15,
            "entertainment_threshold": 60,
        }
    else:
        payload = {
            "switch_threshold": thresholds.switch_threshold,
            "entertainment_threshold": thresholds.entertainment_threshold,
        }

    return jsonify({
        "success": True,
        "thresholds": payload,
    })

# -------------------------------------------------------
# Adaptive / manual mode (GET = effective mode + manual_lock / mode_source, POST = preference)
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/mode", methods=["GET", "POST"])
def user_mode(user_id):

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    if request.method == "GET":
        payload = _adaptive_mode_for_response(user)
        return jsonify({
            "success": True,
            **payload,
        })

    data = request.get_json()

    if not data or "mode" not in data:
        return jsonify({
            "success": False,
            "error": "mode field required"
        }), 400

    mode = data["mode"]

    valid_modes = ["balanced", "focus", "strict", "supportive", "relax", "auto", "adaptive"]

    if mode not in valid_modes:
        return jsonify({
            "success": False,
            "error": "Invalid mode",
            "valid_modes": valid_modes
        }), 400

    user.mode_preference = mode

    db.session.commit()

    return jsonify({
        "success": True,
        "mode_preference": user.mode_preference,
        "adaptive_mode": _adaptive_mode_for_response(user),
    })


def _serialize_focus_session(row: FocusSession) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "start_time": row.start_time.isoformat() if row.start_time else None,
        "end_time": row.end_time.isoformat() if row.end_time else None,
        "duration_minutes": row.duration_minutes,
        "is_active": bool(row.is_active),
        "violations_count": int(row.violations_count or 0),
    }


# -------------------------------------------------------
# Focus sessions (server state + enforcement signals on /events)
# Mirrors REST style: /api/users/<id>/focus/...
# -------------------------------------------------------


@app.route("/api/users/<int:user_id>/focus/start", methods=["POST"])
def focus_session_start(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    data = request.get_json() or {}
    try:
        duration = int(data.get("duration_minutes", 25))
    except (TypeError, ValueError):
        duration = 25
    duration = max(5, min(180, duration))

    now = datetime.now(timezone.utc)
    FocusSession.query.filter_by(user_id=user_id, is_active=True).update(
        {"is_active": False, "end_time": now},
        synchronize_session=False,
    )

    row = FocusSession(
        user_id=user_id,
        duration_minutes=duration,
        is_active=True,
        violations_count=0,
    )
    db.session.add(row)
    db.session.commit()

    logger.info("[FOCUS_SESSION_START] user_id=%s session_id=%s duration_min=%s", user_id, row.id, duration)

    return jsonify({"success": True, "session": _serialize_focus_session(row)})


@app.route("/api/users/<int:user_id>/focus/stop", methods=["POST"])
def focus_session_stop(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    now = datetime.now(timezone.utc)
    updated = (
        FocusSession.query.filter_by(user_id=user_id, is_active=True).update(
            {"is_active": False, "end_time": now},
            synchronize_session=False,
        )
    )
    db.session.commit()

    logger.info("[FOCUS_SESSION_STOP] user_id=%s rows_updated=%s", user_id, updated)

    return jsonify({"success": True, "stopped": int(updated or 0)})


@app.route("/api/users/<int:user_id>/focus/status", methods=["GET"])
def focus_session_status(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    row = get_active_focus_session(user_id)
    if not row:
        return jsonify({"success": True, "active": False, "session": None, "is_expired": False})

    now = datetime.now(timezone.utc)
    st = ensure_utc_aware(row.start_time)
    if st is not None:
        grace_min = 5
        limit_min = int(row.duration_minutes or 25) + grace_min
        if now > st + timedelta(minutes=limit_min):
            row.is_active = False
            row.end_time = now
            db.session.commit()
            logger.info(
                "[FOCUS_SESSION_EXPIRED] user_id=%s session_id=%s duration_min=%s",
                user_id,
                row.id,
                row.duration_minutes,
            )
            return jsonify(
                {
                    "success": True,
                    "active": False,
                    "session": None,
                    "is_expired": True,
                }
            )

    return jsonify(
        {
            "success": True,
            "active": True,
            "session": _serialize_focus_session(row),
            "is_expired": False,
        }
    )


@app.route("/api/users/<int:user_id>/focus/violation", methods=["POST"])
def focus_session_violation(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    try:
        session, new_count = increment_focus_violations(user_id)
        if not session:
            return jsonify({"success": False, "error": "No active focus session"}), 400

        apply_threshold_escalation_for_repeated_violations(user_id, new_count)
        db.session.commit()

        logger.info(
            "[FOCUS_SESSION_VIOLATION] user_id=%s session_id=%s violations_count=%s",
            user_id,
            session.id,
            new_count,
        )

        return jsonify(
            {
                "success": True,
                "violations_count": new_count,
                "session": _serialize_focus_session(session),
            }
        )
    except Exception:
        logger.exception("[FOCUS_SESSION_VIOLATION] failed user_id=%s", user_id)
        db.session.rollback()
        return jsonify({"success": False, "error": "Could not record violation"}), 500


# -------------------------------------------------------
# Run Server
# -------------------------------------------------------

if __name__ == "__main__":

    print("DB URI:", app.config["SQLALCHEMY_DATABASE_URI"])

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

# """
# SpikeSense Backend API Server
# Flask-based RESTful API for digital wellness tracking
# """

# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from flask_sqlalchemy import SQLAlchemy
# from datetime import datetime, timedelta
# import os
# from dotenv import load_dotenv
# import logging

# #from models import db, User, AppUsage, Nudge, UserThreshold, DailyStats
# from models import (
#     db, User, AppUsage, Nudge,
#     UserThreshold, DailyStats,
#     Streak, UserChallenge, UserBadge
# )
# from utils.validators import validate_app_usage_data

# load_dotenv()

# app = Flask(__name__)
# # Default to SQLite for development (no PostgreSQL required); set DATABASE_URL for production
# _default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spikesense_dev.sqlite')
# app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
#     'DATABASE_URL',
#     f'sqlite:///{_default_db}'
# )
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS(app, resources={r"/api/*": {"origins": "*"}})

# db.init_app(app)

# # Initialize AI components (with graceful fallback if numpy/scikit-learn unavailable)
# try:
#     from ai_module.pattern_detector import PatternDetector
#     from ai_module.nudge_engine import NudgeEngine
#     pattern_detector = PatternDetector()
#     nudge_engine = NudgeEngine()
#     AI_ENABLED = True
# except (ImportError, OSError, Exception) as e:
#     # If numpy/scikit-learn cause segfaults or import errors, disable AI features
#     pattern_detector = None
#     nudge_engine = None
#     AI_ENABLED = False

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# def update_streak_and_badges(user_id):
#     today = datetime.utcnow().date()

#     streak = Streak.query.filter_by(user_id=user_id).first()

#     if not streak:
#         streak = Streak(
#             user_id=user_id,
#             start_date=today,
#             last_active_date=today,
#             current_length=1
#         )
#         db.session.add(streak)
#     else:
#         if streak.last_active_date == today:
#             pass  # already counted today
#         elif streak.last_active_date == today - timedelta(days=1):
#             streak.current_length += 1
#             streak.last_active_date = today
#         else:
#             streak.start_date = today
#             streak.last_active_date = today
#             streak.current_length = 1

#     # Award a simple badge at 3-day streak
#     if streak.current_length == 3:
#         already = UserBadge.query.filter_by(
#             user_id=user_id,
#             badge_type="3_day_streak"
#         ).first()

#         if not already:
#             db.session.add(
#                 UserBadge(
#                     user_id=user_id,
#                     badge_type="3_day_streak"
#                 )
#             )

# def ensure_default_challenge(user_id):
#     challenge = UserChallenge.query.filter_by(
#         user_id=user_id,
#         challenge_type="daily_switch_limit",
#         completed=False
#     ).first()

#     if not challenge:
#         challenge = UserChallenge(
#             user_id=user_id,
#             challenge_type="daily_switch_limit",
#             target=15,
#             progress=0
#         )
#         db.session.add(challenge)

#     return challenge

# def _get_user_thresholds_dict(user_id):
#     """Returns thresholds for the pattern detector; sensible defaults if none."""
#     t = UserThreshold.query.filter_by(user_id=user_id).first()
#     if not t:
#         return {
#             'switch_threshold': 15,
#             'entertainment_threshold': 60,
#             'rapid_switching_window': 10,
#         }
#     return {
#         'switch_threshold': t.switch_threshold,
#         'entertainment_threshold': t.entertainment_threshold,
#         'rapid_switching_window': t.rapid_switching_window,
#     }


# if not AI_ENABLED:
#     logger.warning("AI modules not available. Running in degraded mode without ML features.")

# # Create tables on startup
# with app.app_context():
#     db.create_all()
#     logger.info("Database tables initialized")


# @app.route('/api/health', methods=['GET'])
# def health_check():
#     """Health check endpoint"""
#     return jsonify({
#         'status': 'healthy',
#         'timestamp': datetime.utcnow().isoformat(),
#         'version': '1.0.0'
#     }), 200


# @app.route('/api/users', methods=['POST'])
# def create_user():
#     """Create a new user or return existing user for this device_id (get-or-create)."""
#     try:
#         data = request.json
#         device_id = data.get('device_id')
#         if not device_id:
#             return jsonify({'success': False, 'error': 'device_id is required'}), 400

#         user = User.query.filter_by(device_id=device_id).first()
#         if user:
#             logger.info(f"Existing user: {user.id}")
#             return jsonify({
#                 'success': True,
#                 'user_id': user.id,
#                 'message': 'User already exists'
#             }), 200

#         user = User(
#             device_id=device_id,
#             name=data.get('name', 'User'),
#             email=data.get('email'),
#             mode_preference=data.get('mode_preference', 'balanced')
#         )
#         db.session.add(user)
#         db.session.commit()

#         logger.info(f"Created user: {user.id}")
#         return jsonify({
#             'success': True,
#             'user_id': user.id,
#             'message': 'User created successfully'
#         }), 201
#     except Exception as e:
#         logger.error(f"Error creating user: {str(e)}")
#         return jsonify({'success': False, 'error': str(e)}), 400


# @app.route('/api/users/<int:user_id>', methods=['GET'])
# def get_user(user_id):
#     """Get user profile"""
#     user = User.query.get_or_404(user_id)
#     return jsonify({
#         'success': True,
#         'user': {
#             'id': user.id,
#             'device_id': user.device_id,
#             'name': user.name,
#             'email': user.email,
#             'mode_preference': user.mode_preference,
#             'created_at': user.created_at.isoformat()
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/usage', methods=['POST'])
# def log_app_usage(user_id):
#     data = request.get_json()

#     if not data:
#         return jsonify({"error": "Invalid data"}), 400

#     timestamp = data.get("timestamp")

#     if isinstance(timestamp, str):
#         timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

#     usage = AppUsage(
#         user_id=user_id,
#         app_name=data["app_name"],
#         category=data["category"],
#         duration_minutes=data["duration_minutes"],
#         timestamp=timestamp
#     )

#     db.session.add(usage)
#     db.session.commit()

#     # Build recent window for detector (same structure as before)
#     recent = (
#         AppUsage.query
#         .filter_by(user_id=user_id)
#         .order_by(AppUsage.timestamp.desc())
#         .limit(50)
#         .all()
#     )

#     window = [
#         {
#             "app_name": u.app_name,
#             "category": u.category,
#             "duration_minutes": u.duration_minutes,
#             "timestamp": u.timestamp
#         }
#         for u in recent
#     ]

#     if AI_ENABLED and pattern_detector:
#         pass

#     update_streak_and_badges(user_id)
#     db.session.commit()
#     return jsonify({"success": True}), 200


# @app.route('/api/users/<int:user_id>/app-switch', methods=['POST'])
# def log_app_switch(user_id):
#     try:
#         data = request.json or {}

#         timestamp = data.get("timestamp", datetime.utcnow().isoformat())

#         if isinstance(timestamp, str):
#             timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

#         # store switch event
#         switch_row = AppUsage(
#             user_id=user_id,
#             app_name="__switch__",
#             category="other",
#             duration_minutes=0,
#             timestamp=timestamp
#         )

#         db.session.add(switch_row)
#         db.session.commit()

#         window_minutes = 60
#         since = datetime.utcnow() - timedelta(minutes=window_minutes)

#         # count ONLY switch rows
#         switch_count = AppUsage.query.filter(
#             AppUsage.user_id == user_id,
#             AppUsage.app_name == "__switch__",
#             AppUsage.timestamp >= since
#         ).count()

#         challenge = ensure_default_challenge(user_id)
#         challenge.progress = switch_count

#         if challenge.progress >= challenge.target:
#             challenge.completed = True
#             challenge.completed_at = datetime.utcnow()
            
#         user_thresholds = _get_user_thresholds_dict(user_id)

#         if AI_ENABLED and pattern_detector:
#             pattern_result = pattern_detector.detect_rapid_switching(
#                 user_id=user_id,
#                 switch_count=switch_count,
#                 time_window_minutes=window_minutes,
#                 user_thresholds=user_thresholds,
#             )
#         else:
#             pattern_result = {}

#         is_overstimulated = (
#             pattern_result.get("is_overstimulated", False)
#             or pattern_result.get("detected", False)
#         )

#         nudge = None

#         if is_overstimulated and AI_ENABLED and nudge_engine:
#             nudge = nudge_engine.generate_nudge(
#                 user_id=user_id,
#                 pattern_type="rapid_switching",
#                 severity=pattern_result.get("severity", "low"),
#                 context=pattern_result.get("context") or {},
#             )

#             if nudge:
#                 db.session.add(Nudge(
#                     user_id=user_id,
#                     type=nudge["type"],
#                     message=nudge["message"],
#                     severity=nudge["severity"],
#                     action_label=nudge.get("action_label"),
#                     action_type=nudge.get("action_type"),
#                 ))
#                 db.session.commit()

#         return jsonify({
#             "success": True,
#             "switch_count": switch_count,
#             "pattern_detected": is_overstimulated,
#             "nudge": nudge
#         }), 201

#     except Exception as e:
#         db.session.rollback()
#         logger.error(f"Error logging app switch: {str(e)}")
#         return jsonify({"success": False, "error": str(e)}), 500


# @app.route('/api/users/<int:user_id>/nudges', methods=['GET'])
# def get_pending_nudges(user_id):
#     """Get pending nudges for a user (in-app only)."""
#     since = datetime.utcnow() - timedelta(hours=24)
#     nudges = Nudge.query.filter(
#         Nudge.user_id == user_id,
#         Nudge.dismissed == False,
#         Nudge.created_at >= since,
#     ).order_by(Nudge.created_at.desc()).all()

#     return jsonify({
#         'success': True,
#         'nudges': [{
#             'id': n.id,
#             'type': n.type,
#             'message': n.message,
#             'severity': n.severity,
#             'action_label': n.action_label,
#             'action_type': n.action_type,
#             'created_at': n.created_at.isoformat(),
#         } for n in nudges]
#     }), 200


# @app.route('/api/users/<int:user_id>/nudges/<int:nudge_id>/dismiss', methods=['POST'])
# def dismiss_nudge(user_id, nudge_id):
#     """Dismiss a nudge."""
#     nudge = Nudge.query.filter_by(id=nudge_id, user_id=user_id).first_or_404()
#     nudge.dismissed = True
#     nudge.dismissed_at = datetime.utcnow()
#     db.session.commit()

#     return jsonify({'success': True, 'message': 'Nudge dismissed'}), 200


# @app.route('/api/users/<int:user_id>/stats/daily', methods=['GET'])
# def get_daily_stats(user_id):
#     """Get daily statistics for a user. Always recomputed from AppUsage so stats stay current."""
#     if User.query.get(user_id) is None:
#         return jsonify({'success': False, 'error': 'User not found'}), 404
#     date_str = request.args.get('date', datetime.utcnow().date().isoformat())
#     target_date = datetime.fromisoformat(date_str).date()

#     start_of_day = datetime.combine(target_date, datetime.min.time())
#     end_of_day = datetime.combine(target_date, datetime.max.time())

#     usage_records = AppUsage.query.filter(
#         AppUsage.user_id == user_id,
#         AppUsage.timestamp >= start_of_day,
#         AppUsage.timestamp <= end_of_day
#     ).all()

#     total_screen_time = sum(u.duration_minutes for u in usage_records)
#     app_switches = sum(1 for u in usage_records if u.app_name == "__switch__")

#     category_times = {
#         'productivity': 0,
#         'social': 0,
#         'entertainment': 0,
#         'other': 0
#     }
#     for u in usage_records:
#         category_times[u.category] += u.duration_minutes

#     # Upsert DailyStats so the row exists and focus_score can be computed
#     # Use get_or_create pattern with try-except to handle race conditions
#     daily_stats = DailyStats.query.filter_by(
#         user_id=user_id,
#         date=target_date
#     ).first()

#     if daily_stats:
#         daily_stats.total_screen_time = total_screen_time
#         daily_stats.app_switches = app_switches
#         daily_stats.productivity_time = category_times['productivity']
#         daily_stats.social_time = category_times['social']
#         daily_stats.entertainment_time = category_times['entertainment']
#         daily_stats.other_time = category_times['other']
#         db.session.commit()
#     else:
#         try:
#             daily_stats = DailyStats(
#                 user_id=user_id,
#                 date=target_date,
#                 total_screen_time=total_screen_time,
#                 app_switches=app_switches,
#                 productivity_time=category_times['productivity'],
#                 social_time=category_times['social'],
#                 entertainment_time=category_times['entertainment'],
#                 other_time=category_times['other']
#             )
#             db.session.add(daily_stats)
#             db.session.commit()
#         except Exception as e:
#             # Handle race condition: another request created the row between query and insert
#             db.session.rollback()
#             daily_stats = DailyStats.query.filter_by(
#                 user_id=user_id,
#                 date=target_date
#             ).first()
#             if daily_stats:
#                 # Update the existing row
#                 daily_stats.total_screen_time = total_screen_time
#                 daily_stats.app_switches = app_switches
#                 daily_stats.productivity_time = category_times['productivity']
#                 daily_stats.social_time = category_times['social']
#                 daily_stats.entertainment_time = category_times['entertainment']
#                 daily_stats.other_time = category_times['other']
#                 db.session.commit()
#             else:
#                 # Re-raise if it's not a unique constraint error
#                 raise

#     focus_score = daily_stats.calculate_focus_score()
#     db.session.commit()

#     return jsonify({
#         'success': True,
#         'stats': {
#             'date': daily_stats.date.isoformat(),
#             'total_screen_time': daily_stats.total_screen_time,
#             'app_switches': daily_stats.app_switches,
#             'productivity_time': daily_stats.productivity_time,
#             'social_time': daily_stats.social_time,
#             'entertainment_time': daily_stats.entertainment_time,
#             'other_time': daily_stats.other_time,
#             'focus_score': focus_score
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/thresholds', methods=['GET'])
# def get_user_thresholds(user_id):
#     """Get personalized thresholds for a user"""
#     thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
#     if not thresholds:
#         # Return default thresholds
#         return jsonify({
#             'success': True,
#             'thresholds': {
#                 'switch_threshold': 15,
#                 'entertainment_threshold': 60,
#                 'break_interval': 45,
#                 'rapid_switching_window': 10
#             }
#         }), 200
    
#     return jsonify({
#         'success': True,
#         'thresholds': {
#             'switch_threshold': thresholds.switch_threshold,
#             'entertainment_threshold': thresholds.entertainment_threshold,
#             'break_interval': thresholds.break_interval,
#             'rapid_switching_window': thresholds.rapid_switching_window,
#             'updated_at': thresholds.updated_at.isoformat()
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/thresholds', methods=['POST'])
# def update_user_thresholds(user_id):
#     """Update personalized thresholds (AI learning)"""
#     data = request.json
    
#     thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
#     if not thresholds:
#         thresholds = UserThreshold(user_id=user_id)
#         db.session.add(thresholds)
    
#     if 'switch_threshold' in data:
#         thresholds.switch_threshold = data['switch_threshold']
#     if 'entertainment_threshold' in data:
#         thresholds.entertainment_threshold = data['entertainment_threshold']
#     if 'break_interval' in data:
#         thresholds.break_interval = data['break_interval']
#     if 'rapid_switching_window' in data:
#         thresholds.rapid_switching_window = data['rapid_switching_window']
    
#     thresholds.updated_at = datetime.utcnow()
#     db.session.commit()
    
#     return jsonify({
#         'success': True,
#         'message': 'Thresholds updated',
#         'thresholds': {
#             'switch_threshold': thresholds.switch_threshold,
#             'entertainment_threshold': thresholds.entertainment_threshold,
#             'break_interval': thresholds.break_interval,
#             'rapid_switching_window': thresholds.rapid_switching_window
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/mode', methods=['POST'])
# def update_user_mode(user_id):
#     """Update user's mode preference"""
#     data = request.json
#     mode = data.get('mode')
    
#     if mode not in ['supportive', 'motivational', 'restrictive', 'balanced']:
#         return jsonify({'success': False, 'error': 'Invalid mode'}), 400
    
#     user = User.query.get_or_404(user_id)
#     user.mode_preference = mode
#     db.session.commit()
    
#     return jsonify({
#         'success': True,
#         'message': 'Mode updated',
#         'mode': mode
#     }), 200


# if __name__ == "__main__":
#     print("DB URI =", app.config["SQLALCHEMY_DATABASE_URI"])
#     app.run(host="0.0.0.0", port=5000, debug=True)

