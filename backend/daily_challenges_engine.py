"""
Behavior-aware daily challenges (virtual payloads for GET /achievements).

Selection uses DailyStats + top_apps aggregates; stay-under challenges never
mark completed=true mid-day (see serialize_* helpers).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ChallengeMetrics:
    user_id: int
    date_iso: str
    total_usage_seconds: int
    social_seconds: int
    entertainment_seconds: int
    productivity_seconds: int
    app_switches: int
    peak_switch_rate: float
    top_apps: list[dict[str, Any]]
    focus_session_minutes_completed: float


def _day_end_iso(date_iso: str) -> str:
    try:
        y, m, d = (int(x) for x in date_iso.split("-")[:3])
        dt = datetime(y, m, d, 23, 59, 59, tzinfo=timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat()


def _social_opens(metrics: ChallengeMetrics) -> tuple[int, int]:
    """(sum of opens for social apps in top_apps, max opens on a single social app)."""
    ssum = 0
    smax = 0
    for row in metrics.top_apps:
        if (row.get("category") or "").lower() != "social":
            continue
        c = int(row.get("usage_count") or 0)
        ssum += c
        smax = max(smax, c)
    return ssum, smax


def _top_app(metrics: ChallengeMetrics) -> dict[str, Any] | None:
    if not metrics.top_apps:
        return None
    return metrics.top_apps[0]


def _ent_share(metrics: ChallengeMetrics) -> float:
    t = max(1, int(metrics.total_usage_seconds))
    return float(metrics.entertainment_seconds) / float(t)


def _social_share(metrics: ChallengeMetrics) -> float:
    t = max(1, int(metrics.total_usage_seconds))
    return float(metrics.social_seconds) / float(t)


def _meaningful_usage(metrics: ChallengeMetrics) -> bool:
    return int(metrics.total_usage_seconds) >= 120


def _social_dominated_over_entertainment(metrics: ChallengeMetrics) -> bool:
    """Suppress entertainment-style challenges when social clearly drives the day."""
    if int(metrics.total_usage_seconds) < 600:
        return False
    soc = int(metrics.social_seconds)
    ent = int(metrics.entertainment_seconds)
    return soc >= ent * 1.8 and soc >= 20 * 60


def _log_metrics(m: ChallengeMetrics) -> None:
    ssum, smax = _social_opens(m)
    logger.info(
        "[CHALLENGE_ENGINE][METRICS] user_id=%s date=%s total_usage_seconds=%s "
        "social_seconds=%s entertainment_seconds=%s productivity_seconds=%s "
        "app_switches=%s peak_switch_rate=%.2f top_social_opens_sum=%s top_social_opens_max=%s "
        "focus_session_minutes=%.1f",
        m.user_id,
        m.date_iso,
        m.total_usage_seconds,
        m.social_seconds,
        m.entertainment_seconds,
        m.productivity_seconds,
        m.app_switches,
        m.peak_switch_rate,
        ssum,
        smax,
        m.focus_session_minutes_completed,
    )


def _select_keys(metrics: ChallengeMetrics) -> list[str]:
    """Return ordered unique challenge_key list (max 5)."""
    if not _meaningful_usage(metrics):
        logger.info("[CHALLENGE_ENGINE][SELECTED] keys=[] reason=insufficient_data")
        return []

    t = max(1, int(metrics.total_usage_seconds))
    ssum, smax = _social_opens(metrics)
    ent_share = _ent_share(metrics)
    soc_share = _social_share(metrics)
    top = _top_app(metrics) or {}
    top_dur = int(top.get("total_duration") or 0)
    top_opens = int(top.get("usage_count") or 0)
    top_share = float(top_dur) / float(t) if top_dur else 0.0

    scored: list[tuple[int, str, str]] = []  # (priority, key, reason)

    # SOCIAL_SWITCH_REDUCER
    if (
        int(metrics.social_seconds) >= 20 * 60
        or ssum >= 40
        or smax >= 15
    ):
        scored.append((100, "SOCIAL_SWITCH_REDUCER", "social_usage_or_opens"))

    # TOP_APP_LIMIT
    if top and (top_share >= 0.4 or top_opens >= 20):
        scored.append((95, "TOP_APP_LIMIT", "dominant_top_app"))

    # APP_SWITCH_STABILITY — switches, peak rate, or heavy social open patterns
    if (
        int(metrics.app_switches) >= 15
        or float(metrics.peak_switch_rate) >= 40.0
        or ssum >= 35
    ):
        scored.append((90, "APP_SWITCH_STABILITY", "high_switching_or_social_opens"))

    # ENTERTAINMENT_BALANCE — only when entertainment is a real slice of the day
    ent_sig = int(metrics.entertainment_seconds) >= max(
        int(0.20 * t), 10 * 60
    ) and ent_share >= 0.18
    if ent_sig and not _social_dominated_over_entertainment(metrics):
        scored.append((75, "ENTERTAINMENT_BALANCE", "entertainment_share"))
    elif _social_dominated_over_entertainment(metrics) and int(metrics.entertainment_seconds) >= 10 * 60:
        logger.info(
            "[CHALLENGE_ENGINE][SKIPPED] key=ENTERTAINMENT_BALANCE reason=social_dominated_day"
        )
    elif not ent_sig and int(metrics.entertainment_seconds) > 0:
        logger.info(
            "[CHALLENGE_ENGINE][SKIPPED] key=ENTERTAINMENT_BALANCE reason=low_entertainment"
        )

    # SCREEN_BREAK (entertainment-heavy companion)
    if int(metrics.entertainment_seconds) >= 15 * 60 and ent_share >= 0.22:
        scored.append((72, "SCREEN_BREAK", "entertainment_heavy"))

    # SOCIAL_COOLDOWN
    if soc_share >= 0.38 and int(metrics.social_seconds) > int(metrics.entertainment_seconds):
        scored.append((65, "SOCIAL_COOLDOWN", "social_dominant_category"))

    # FOCUS_SESSION_STARTER
    if metrics.focus_session_minutes_completed < 15.0 or int(metrics.productivity_seconds) < 15 * 60:
        scored.append((70, "FOCUS_SESSION_STARTER", "low_focus_or_productivity"))

    # Calm-day fillers (low conflict)
    calm = int(metrics.app_switches) < 15 and float(metrics.peak_switch_rate) < 30.0
    if calm and t >= 600:
        scored.append((30, "MAINTAIN_RHYTHM", "calm_switching"))
        scored.append((25, "LIGHT_CHECKIN", "calm_day"))

    scored.sort(key=lambda x: -x[0])
    out: list[str] = []
    for _pri, key, _reason in scored:
        if key not in out:
            out.append(key)
        if len(out) >= 5:
            break

    # Pad to at least 3 when we have data
    fillers = ["FOCUS_SESSION_STARTER", "MAINTAIN_RHYTHM", "LIGHT_CHECKIN"]
    for fk in fillers:
        if len(out) >= 3:
            break
        if fk not in out:
            out.append(fk)

    out = out[:5]
    logger.info(
        "[CHALLENGE_ENGINE][SELECTED] keys=%s reason=ordered_priority",
        out,
    )
    return out


def _under_status(current: int, target: int) -> str:
    if current > target:
        return "exceeded"
    if target > 0 and current > int(0.8 * target):
        return "at_risk"
    return "on_track"


def _serialize_social_switch_reducer(m: ChallengeMetrics) -> dict[str, Any]:
    target = 40
    ssum, _smax = _social_opens(m)
    current = int(ssum)
    prog = min(1.0, float(current) / float(max(target, 1)))
    st = _under_status(current, target)
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-SOCIAL_SWITCH_REDUCER"
    return {
        "id": cid,
        "challenge_key": "SOCIAL_SWITCH_REDUCER",
        "title": "Reduce Social Switching",
        "description": "Keep repeated social app opens under control today.",
        "type": "stay_under",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "under",
        "status": st,
    }


def _serialize_app_switch_stability(m: ChallengeMetrics) -> dict[str, Any]:
    target = 30
    current = int(m.app_switches)
    prog = min(1.0, float(current) / float(max(target, 1)))
    st = _under_status(current, target)
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-APP_SWITCH_STABILITY"
    return {
        "id": cid,
        "challenge_key": "APP_SWITCH_STABILITY",
        "title": "Stay Intentional",
        "description": "Reduce rapid app switching and stay with one task longer.",
        "type": "stay_under",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "under",
        "status": st,
    }


def _serialize_focus_session_starter(m: ChallengeMetrics) -> dict[str, Any]:
    target = 15
    current = int(round(min(float(target), max(0.0, m.focus_session_minutes_completed))))
    prog = min(1.0, float(m.focus_session_minutes_completed) / float(target))
    done = m.focus_session_minutes_completed >= float(target)
    st = "completed" if done else "in_progress"
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-FOCUS_SESSION_STARTER"
    return {
        "id": cid,
        "challenge_key": "FOCUS_SESSION_STARTER",
        "title": "Start a Focus Session",
        "description": "Complete one 15-minute focus session today.",
        "type": "over_goal",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": bool(done),
        "is_completed": bool(done),
        "expires_at": expires,
        "direction": "over",
        "status": st,
    }


def _serialize_social_cooldown(m: ChallengeMetrics) -> dict[str, Any]:
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-SOCIAL_COOLDOWN"
    return {
        "id": cid,
        "challenge_key": "SOCIAL_COOLDOWN",
        "title": "Social Cooldown",
        "description": "Take a short break from social apps to reset your attention.",
        "type": "action",
        "current": 0,
        "target": 10,
        "progress": 0.0,
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "action",
        "status": "in_progress",
    }


def _serialize_entertainment_balance(m: ChallengeMetrics) -> dict[str, Any]:
    t = max(1, int(m.total_usage_seconds))
    target = max(int(0.35 * t), 600)
    current = int(m.entertainment_seconds)
    prog = min(1.0, float(current) / float(max(target, 1)))
    st = _under_status(current, target)
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-ENTERTAINMENT_BALANCE"
    return {
        "id": cid,
        "challenge_key": "ENTERTAINMENT_BALANCE",
        "title": "Stay Balanced",
        "description": "Keep entertainment from dominating your screen time today.",
        "type": "stay_under",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "under",
        "status": st,
    }


def _serialize_screen_break(m: ChallengeMetrics) -> dict[str, Any]:
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-SCREEN_BREAK"
    return {
        "id": cid,
        "challenge_key": "SCREEN_BREAK",
        "title": "Take a Screen Break",
        "description": "Step away from the screen for a few minutes to reset your eyes and attention.",
        "type": "action",
        "current": 0,
        "target": 1,
        "progress": 0.0,
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "action",
        "status": "in_progress",
    }


def _serialize_top_app_limit(m: ChallengeMetrics) -> dict[str, Any]:
    top = _top_app(m) or {}
    name = (top.get("app_name") or "Top App").strip() or "Top App"
    target = 25
    current = int(top.get("usage_count") or 0)
    prog = min(1.0, float(current) / float(max(target, 1)))
    st = _under_status(current, target)
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-TOP_APP_LIMIT"
    return {
        "id": cid,
        "challenge_key": "TOP_APP_LIMIT",
        "title": f"Limit {name} Loops",
        "description": "Try fewer repeat opens of your most-used app today.",
        "type": "stay_under",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "under",
        "status": st,
    }


def _serialize_maintain_rhythm(m: ChallengeMetrics) -> dict[str, Any]:
    target = 40
    current = int(m.app_switches)
    prog = min(1.0, float(current) / float(max(target, 1)))
    st = _under_status(current, target)
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-MAINTAIN_RHYTHM"
    return {
        "id": cid,
        "challenge_key": "MAINTAIN_RHYTHM",
        "title": "Maintain Rhythm",
        "description": "Keep your switching light and your day feeling steady.",
        "type": "stay_under",
        "current": current,
        "target": target,
        "progress": round(prog, 4),
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "under",
        "status": st,
    }


def _serialize_light_checkin(m: ChallengeMetrics) -> dict[str, Any]:
    expires = _day_end_iso(m.date_iso)
    cid = f"d-{m.user_id}-{m.date_iso}-LIGHT_CHECKIN"
    return {
        "id": cid,
        "challenge_key": "LIGHT_CHECKIN",
        "title": "Light Check-in",
        "description": "Notice how you feel after sessions of phone use—no pressure, just awareness.",
        "type": "action",
        "current": 0,
        "target": 1,
        "progress": 0.0,
        "completed": False,
        "is_completed": False,
        "expires_at": expires,
        "direction": "action",
        "status": "in_progress",
    }


_SERIALIZERS = {
    "SOCIAL_SWITCH_REDUCER": _serialize_social_switch_reducer,
    "APP_SWITCH_STABILITY": _serialize_app_switch_stability,
    "FOCUS_SESSION_STARTER": _serialize_focus_session_starter,
    "SOCIAL_COOLDOWN": _serialize_social_cooldown,
    "ENTERTAINMENT_BALANCE": _serialize_entertainment_balance,
    "SCREEN_BREAK": _serialize_screen_break,
    "TOP_APP_LIMIT": _serialize_top_app_limit,
    "MAINTAIN_RHYTHM": _serialize_maintain_rhythm,
    "LIGHT_CHECKIN": _serialize_light_checkin,
}


def build_challenges_for_metrics(metrics: ChallengeMetrics) -> list[dict[str, Any]]:
    keys = _select_keys(metrics)
    out: list[dict[str, Any]] = []
    for k in keys:
        fn = _SERIALIZERS.get(k)
        if not fn:
            logger.warning("[CHALLENGE_ENGINE][SKIPPED] key=%s reason=no_serializer", k)
            continue
        out.append(fn(metrics))
    return out


def metrics_from_dict(user_id: int, date_iso: str, d: dict[str, Any]) -> ChallengeMetrics:
    top = d.get("top_apps") or []
    if not isinstance(top, list):
        top = []
    total = int(d.get("total_usage_seconds") or 0)
    sw = int(d.get("app_switches") or 0)
    peak = float(d.get("peak_switch_rate") or 0.0)
    if peak <= 0 and total > 0:
        peak = round((sw * 3600.0) / float(total), 4)
    return ChallengeMetrics(
        user_id=user_id,
        date_iso=date_iso,
        total_usage_seconds=total,
        social_seconds=int(d.get("social_seconds") or 0),
        entertainment_seconds=int(d.get("entertainment_seconds") or 0),
        productivity_seconds=int(d.get("productivity_seconds") or 0),
        app_switches=sw,
        peak_switch_rate=peak,
        top_apps=top,
        focus_session_minutes_completed=float(d.get("focus_session_minutes_completed") or 0.0),
    )


def build_challenges_response(user_id: int, date_iso: str, raw_metrics: dict[str, Any]) -> list[dict[str, Any]]:
    m = metrics_from_dict(user_id, date_iso, raw_metrics)
    _log_metrics(m)
    return build_challenges_for_metrics(m)
