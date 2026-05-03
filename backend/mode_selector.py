"""
V1 rule-based adaptive mode inference (Focus / Balanced / Relax).

Lightweight, explainable, confidence-gated. Maps to PatternDetector / NudgeEngine
via canonical_to_detector_focus_mode / canonical_to_nudge_focus_mode.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func

from models import DailyStats, UsageLog, User, db

logger = logging.getLogger(__name__)

# Canonical product modes (capitalized for API; compare case-insensitive internally)
MODE_FOCUS = "Focus"
MODE_BALANCED = "Balanced"
MODE_RELAX = "Relax"

# Numeric knobs drive PatternDetector (multipliers) and NudgeEngine (cooldown_hours).
# Interpretation:
# - detection_threshold_scale: multiplied onto overstim_score cap (lower = stricter / escalate sooner)
# - switch_penalty_weight: multiplied onto impulsive_weight (higher = switching hurts score more)
# - entertainment_sensitivity: multiplied onto entertainment_cost (higher = entertainment hurts more)
# - cooldown_hours: nudge repeat window for the same (user, pattern)
MODE_PROFILES: dict[str, dict[str, Any]] = {
    MODE_FOCUS: {
        "label": "Focus",
        "detection_threshold_scale": 0.82,
        "cooldown_hours": 1.0,
        "switch_penalty_weight": 1.28,
        "entertainment_sensitivity": 1.22,
        "description": "Tighter detection, shorter cooldowns, stronger weight on switching and entertainment.",
    },
    MODE_BALANCED: {
        "label": "Balanced",
        "detection_threshold_scale": 1.0,
        "cooldown_hours": 2.0,
        "switch_penalty_weight": 1.0,
        "entertainment_sensitivity": 1.0,
        "description": "Default thresholds and cooldowns; moderate penalties.",
    },
    MODE_RELAX: {
        "label": "Relax",
        "detection_threshold_scale": 1.22,
        "cooldown_hours": 3.5,
        "switch_penalty_weight": 0.72,
        "entertainment_sensitivity": 0.78,
        "description": "Higher thresholds, longer cooldowns, less sensitivity to short entertainment bursts.",
    },
}


def get_mode_profile(canonical_mode: str | None) -> dict[str, Any]:
    """Return profile dict for Focus / Balanced / Relax with safe fallbacks."""
    if not canonical_mode:
        return dict(MODE_PROFILES[MODE_BALANCED])
    key = canonical_mode.strip()
    if key not in MODE_PROFILES:
        # Case-insensitive match
        low = key.lower()
        if low == "focus":
            key = MODE_FOCUS
        elif low == "relax":
            key = MODE_RELAX
        else:
            key = MODE_BALANCED
    return dict(MODE_PROFILES.get(key, MODE_PROFILES[MODE_BALANCED]))


def build_pattern_profile_multipliers(canonical_mode: str | None) -> dict[str, float]:
    """
    Multipliers applied in PatternDetector AFTER BASE_THRESHOLDS + MODE_WEIGHTS + personalized.

    Keys match PatternDetector threshold dict: impulsive_weight, entertainment_cost, overstim_score.
    """
    p = get_mode_profile(canonical_mode)
    det = float(p.get("detection_threshold_scale") or 1.0)
    sw = float(p.get("switch_penalty_weight") or 1.0)
    ent = float(p.get("entertainment_sensitivity") or 1.0)
    det = max(0.55, min(1.45, det))
    sw = max(0.55, min(1.55, sw))
    ent = max(0.55, min(1.55, ent))
    return {
        "impulsive_weight": sw,
        "entertainment_cost": ent,
        "overstim_score": det,
    }


def build_nudge_cooldown_hours(canonical_mode: str | None) -> float:
    """Cooldown between nudges of the same pattern for this user (hours)."""
    p = get_mode_profile(canonical_mode)
    h = float(p.get("cooldown_hours") or 2.0)
    return max(0.35, min(12.0, h))


def effective_profile_summary(canonical_mode: str | None) -> dict[str, float]:
    """Compact dict for API / logs (additive fields)."""
    p = get_mode_profile(canonical_mode)
    return {
        "detection_threshold_scale": float(p.get("detection_threshold_scale") or 1.0),
        "cooldown_hours": float(p.get("cooldown_hours") or 2.0),
        "switch_penalty_weight": float(p.get("switch_penalty_weight") or 1.0),
        "entertainment_sensitivity": float(p.get("entertainment_sensitivity") or 1.0),
    }


def _attach_v2_profile_fields(out: dict[str, Any]) -> dict[str, Any]:
    """Augment resolve/infer payloads with multipliers and cooldown (mutates out)."""
    mode = out.get("mode") or MODE_BALANCED
    out["effective_profile"] = effective_profile_summary(mode)
    out["pattern_profile_multipliers"] = build_pattern_profile_multipliers(mode)
    out["nudge_cooldown_hours"] = build_nudge_cooldown_hours(mode)
    return out

# --- Stabilization (in-process; resets on server restart) ---
_LAST_STICKY: dict[int, tuple[str, float]] = {}
_STICKY_GAP = 0.11
_MIN_TOP_SOFTMAX = 0.36
_MIN_MARGIN_SOFTMAX = 0.10
_FORCE_BALANCED_SOFTMAX = 0.55
_MIN_TOTAL_SECONDS = 240


def canonical_to_detector_focus_mode(canonical: str) -> str:
    """Map product mode to PatternDetector focus_mode (Work / Personal / Sleep)."""
    c = (canonical or MODE_BALANCED).strip().lower()
    if c == "focus":
        return "Work"
    if c == "relax":
        return "Sleep"
    return "Personal"


def canonical_to_nudge_focus_mode(canonical: str) -> str:
    """Templates primarily tag Personal / Work; Relax uses Personal for copy fit."""
    c = (canonical or MODE_BALANCED).strip().lower()
    if c == "focus":
        return "Work"
    return "Personal"


def _normalize_pref(raw: str | None) -> str:
    if not raw:
        return "balanced"
    p = raw.strip().lower()
    aliases = {
        "strict": "focus",
        "restrictive": "focus",
        "supportive": "relax",
        "relaxed": "relax",
        "moderate": "balanced",
        "motivational": "balanced",
        # auto / adaptive are distinct from balanced (inference vs manual lock)
    }
    return aliases.get(p, p)


def _gather_recent_signals(user_id: int, window_hours: int = 36) -> dict[str, Any]:
    """Aggregate usage_logs over a sliding window (UTC)."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=window_hours)

    logs = (
        UsageLog.query.filter(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= since,
        )
        .order_by(UsageLog.created_at.asc(), UsageLog.id.asc())
        .all()
    )

    prod = soc = ent = oth = 0
    switches = 0
    prev_name: str | None = None
    for row in logs:
        d = int(row.duration or 0)
        cat = (row.category or "other").lower()
        if cat == "productivity":
            prod += d
        elif cat == "social":
            soc += d
        elif cat == "entertainment":
            ent += d
        else:
            oth += d
        name = row.app_name or ""
        if prev_name is not None and prev_name != name:
            switches += 1
        prev_name = name

    total = prod + soc + ent + oth
    window_h = max(window_hours, 1)
    switches_per_hour = switches / float(window_h)

    today = now.date()
    daily = DailyStats.query.filter_by(user_id=user_id, date=today).first()
    daily_focus_hint: int | None = None
    if daily and (daily.total_usage_seconds or 0) > 0:
        tot = max(1, int(daily.total_usage_seconds or 0))
        ent_share = (daily.entertainment_seconds or 0) / tot
        sw = int(daily.app_switches or 0)
        daily_focus_hint = max(0, min(100, int(85 - 55 * ent_share - min(25, sw * 0.12))))

    hour_utc = now.hour
    work_bonus = 0.22 if 9 <= hour_utc <= 16 else 0.0
    evening_bonus = 0.20 if hour_utc >= 18 or hour_utc <= 5 else 0.0

    return {
        "log_count": len(logs),
        "total_seconds": total,
        "productivity_seconds": prod,
        "social_seconds": soc,
        "entertainment_seconds": ent,
        "other_seconds": oth,
        "switches": switches,
        "switches_per_hour": switches_per_hour,
        "hour_utc": hour_utc,
        "work_hours_bonus": work_bonus,
        "evening_bonus": evening_bonus,
        "daily_focus_hint": daily_focus_hint,
    }


def _scores_from_signals(sig: dict[str, Any]) -> tuple[float, float, float]:
    """Raw scores (any scale); softmax will normalize."""
    total = max(1, int(sig["total_seconds"]))
    pr = sig["productivity_seconds"] / total
    er = sig["entertainment_seconds"] / total
    sr = sig["social_seconds"] / total
    sw = float(sig["switches_per_hour"])
    switch_norm = min(1.2, sw / 8.0)

    focus_s = (
        pr * 2.4
        - er * 2.1
        - sr * 0.55
        - switch_norm * 0.65
        + float(sig["work_hours_bonus"])
        + (0.12 if (sig.get("daily_focus_hint") or 0) >= 70 else 0.0)
    )
    relax_s = (
        er * 2.35
        + sr * 1.1
        - pr * 1.85
        + float(sig["evening_bonus"])
        + (0.08 if switch_norm < 0.35 else 0.0)
    )
    mixed_penalty = abs(pr - er) * 0.9 + switch_norm * 0.25
    balanced_s = 0.55 - mixed_penalty + min(pr, er, sr) * 0.4

    return focus_s, balanced_s, relax_s


def _pick_reason(winner: str, sig: dict[str, Any], probs: list[float]) -> str:
    total = max(1, int(sig["total_seconds"]))
    pr = sig["productivity_seconds"] / total
    er = sig["entertainment_seconds"] / total
    sr = sig["social_seconds"] / total
    sw = float(sig["switches_per_hour"])
    hour = int(sig["hour_utc"])

    if winner == MODE_FOCUS:
        parts = []
        if pr >= 0.38:
            parts.append("productivity-heavy usage")
        if er <= 0.22:
            parts.append("light entertainment")
        if sw < 5:
            parts.append("moderate switching")
        if 9 <= hour <= 16:
            parts.append("daytime patterns")
        detail = ", ".join(parts) if parts else "calmer, task-leaning patterns"
        return f"Recent usage looks {detail}, so Focus mode fits best."

    if winner == MODE_RELAX:
        parts = []
        if er + sr >= 0.45:
            parts.append("more entertainment and social time")
        if pr <= 0.28:
            parts.append("lighter productivity share")
        if hour >= 18 or hour <= 5:
            parts.append("evening or wind-down hours")
        detail = ", ".join(parts) if parts else "leisure-leaning usage"
        return f"Recent usage shows {detail}, so Relax mode fits best."

    return (
        "Your recent usage is mixed without a strong focus or relax signal, "
        "so Balanced mode fits best."
    )


def _insufficient_reason() -> dict[str, Any]:
    out = {
        "mode": MODE_BALANCED,
        "confidence": 0.35,
        "reason": "Not enough recent activity to infer a stronger mode yet.",
        "auto": True,
        "features": {"data_sufficient": False},
    }
    return _attach_v2_profile_fields(out)


def infer_mode_for_user(user_id: int) -> dict[str, Any]:
    """
    Infer Focus / Balanced / Relax from recent logs (+ light daily stats hint).

    Returns: mode, confidence (0–1), reason, auto=True, features (debug).
    """
    sig = _gather_recent_signals(user_id)
    if sig["log_count"] < 4 or sig["total_seconds"] < _MIN_TOTAL_SECONDS:
        out = _insufficient_reason()
        out["features"] = {**sig, "data_sufficient": False}
        logger.debug(
            "[MODE_SELECTOR] user_id=%s mode=%s confidence=%s reason=%s (sparse data)",
            user_id,
            out["mode"],
            out["confidence"],
            out["reason"],
        )
        return out

    f_raw, b_raw, r_raw = _scores_from_signals(sig)
    probs = _softmax([f_raw, b_raw, r_raw])
    order = [MODE_FOCUS, MODE_BALANCED, MODE_RELAX]
    ranked = sorted(zip(probs, order), reverse=True)
    top_p, top_m = ranked[0]
    second_p = ranked[1][0]
    margin = top_p - second_p

    winner = top_m
    confidence = float(top_p)
    forced_balanced = False

    if top_p < _MIN_TOP_SOFTMAX or margin < _MIN_MARGIN_SOFTMAX:
        winner = MODE_BALANCED
        confidence = float(probs[order.index(MODE_BALANCED)])
        reason = (
            "Signals are close together, so Balanced mode keeps things steady "
            "until patterns separate more clearly."
        )
        forced_balanced = True
    elif top_p < _FORCE_BALANCED_SOFTMAX:
        winner = MODE_BALANCED
        confidence = max(0.45, float(probs[order.index(MODE_BALANCED)]))
        reason = (
            "Confidence in a single mode is moderate, so Balanced mode is used "
            "for stable guidance."
        )
        forced_balanced = True
    else:
        reason = _pick_reason(winner, sig, probs)

    # One-step sticky hysteresis (in-process; do not override confidence-gated Balanced)
    prev = _LAST_STICKY.get(user_id)
    if (
        not forced_balanced
        and prev
        and winner != prev[0]
        and margin < (_STICKY_GAP + _MIN_MARGIN_SOFTMAX)
        and winner in (MODE_FOCUS, MODE_RELAX)
    ):
        winner = prev[0]
        reason = (
            f"Keeping {winner} for stability; new signals are not quite strong enough "
            "to switch yet."
        )
        confidence = min(confidence, float(prev[1]))
    idx_final = order.index(winner)
    _LAST_STICKY[user_id] = (winner, probs[idx_final])

    out = {
        "mode": winner,
        "confidence": round(min(0.99, max(0.0, confidence)), 3),
        "reason": reason,
        "auto": True,
        "features": {
            **{k: (round(v, 4) if isinstance(v, float) else v) for k, v in sig.items()},
            "softmax_focus": round(probs[0], 4),
            "softmax_balanced": round(probs[1], 4),
            "softmax_relax": round(probs[2], 4),
            "data_sufficient": True,
        },
    }
    _attach_v2_profile_fields(out)
    logger.debug(
        "[MODE_SELECTOR] user_id=%s mode=%s confidence=%s reason=%s",
        user_id,
        out["mode"],
        out["confidence"],
        out["reason"],
    )
    return out


def _softmax(values: list[float]) -> list[float]:
    if not values:
        return []
    m = max(values)
    exps = [math.exp(x - m) for x in values]
    s = sum(exps) or 1.0
    return [e / s for e in exps]


def resolve_effective_mode_for_user(user: User) -> dict[str, Any]:
    """
    Apply manual mode locks from mode_preference for focus / balanced / relax.
    Use inference only when preference is auto or adaptive.

    Returns keys: mode, confidence, reason, auto, focus_mode_detector,
    focus_mode_nudge, features, manual_lock (bool).
    """
    pref = _normalize_pref(getattr(user, "mode_preference", None))

    if pref == "focus":
        out = {
            "mode": MODE_FOCUS,
            "confidence": 1.0,
            "reason": "Focus is selected in your settings, so detection stays in a stricter work-style profile.",
            "auto": False,
            "manual_lock": True,
            "focus_mode_detector": canonical_to_detector_focus_mode(MODE_FOCUS),
            "focus_mode_nudge": canonical_to_nudge_focus_mode(MODE_FOCUS),
            "features": {"preference": "focus"},
        }
        return _attach_v2_profile_fields(out)

    if pref == "relax":
        out = {
            "mode": MODE_RELAX,
            "confidence": 1.0,
            "reason": "Relax is selected in your settings, so thresholds stay gentler with a downtime-oriented profile.",
            "auto": False,
            "manual_lock": True,
            "focus_mode_detector": canonical_to_detector_focus_mode(MODE_RELAX),
            "focus_mode_nudge": canonical_to_nudge_focus_mode(MODE_RELAX),
            "features": {"preference": "relax"},
        }
        return _attach_v2_profile_fields(out)

    if pref == "balanced":
        out = {
            "mode": MODE_BALANCED,
            "confidence": 1.0,
            "reason": (
                "Balanced is selected in your settings, so thresholds use the default "
                "middle profile until you change mode."
            ),
            "auto": False,
            "manual_lock": True,
            "focus_mode_detector": canonical_to_detector_focus_mode(MODE_BALANCED),
            "focus_mode_nudge": canonical_to_nudge_focus_mode(MODE_BALANCED),
            "features": {"preference": "balanced"},
        }
        return _attach_v2_profile_fields(out)

    if pref in ("auto", "adaptive"):
        inferred = infer_mode_for_user(user.id)
        inferred["manual_lock"] = False
        inferred["focus_mode_detector"] = canonical_to_detector_focus_mode(inferred["mode"])
        inferred["focus_mode_nudge"] = canonical_to_nudge_focus_mode(inferred["mode"])
        feats = dict(inferred.get("features") or {})
        feats["preference"] = "adaptive"
        inferred["features"] = feats
        return _attach_v2_profile_fields(inferred)

    # Unknown preference: keep Balanced as a safe manual default
    out = {
        "mode": MODE_BALANCED,
        "confidence": 1.0,
        "reason": "Using Balanced as the default profile for this preference value.",
        "auto": False,
        "manual_lock": True,
        "focus_mode_detector": canonical_to_detector_focus_mode(MODE_BALANCED),
        "focus_mode_nudge": canonical_to_nudge_focus_mode(MODE_BALANCED),
        "features": {"preference": pref, "unknown_preference_fallback": True},
    }
    return _attach_v2_profile_fields(out)


def fallback_balanced_effective_mode() -> dict[str, Any]:
    """Safe fallback when resolve_effective_mode_for_user cannot run (additive fields)."""
    out: dict[str, Any] = {
        "mode": MODE_BALANCED,
        "confidence": 0.4,
        "reason": "Using Balanced defaults after a mode resolution error.",
        "auto": True,
        "manual_lock": False,
        "focus_mode_detector": "Personal",
        "focus_mode_nudge": "Personal",
        "features": {"fallback": True},
    }
    return _attach_v2_profile_fields(out)
