"""
Focus session enforcement helpers (soft / guided — signals client, never blocks ingestion).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from models import FocusSession, UserThreshold, db

logger = logging.getLogger(__name__)

# Categories that never trigger the enforcement overlay during a focus session.
ALLOWED_FOCUS_CATEGORIES = frozenset({"productivity", "communication"})

# Categories that count as distracting (explicit allowlist avoids noisy "other" apps).
DISTRACTING_FOCUS_CATEGORIES = frozenset({"social", "entertainment"})

# Suppress repeat enforcement signals for the same foreground app within this window.
_ENFORCEMENT_THROTTLE_SECONDS = 90


def ensure_utc_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_active_focus_session(user_id: int) -> FocusSession | None:
    return (
        FocusSession.query.filter_by(user_id=user_id, is_active=True)
        .order_by(FocusSession.start_time.desc())
        .first()
    )


def should_trigger_enforcement(user_id: int, app_category: str | None) -> bool:
    session = get_active_focus_session(user_id)
    if not session or not session.is_active:
        return False
    cat = (app_category or "").strip().lower()
    if cat in ALLOWED_FOCUS_CATEGORIES:
        return False
    return cat in DISTRACTING_FOCUS_CATEGORIES


def apply_focus_enforcement_signal(
    user_id: int,
    app_name: str | None,
    app_category: str | None,
) -> dict[str, Any]:
    """
    If a focus session is active and the app is distracting, return an additive
    enforcement payload for the events API. Updates throttle fields on the session.
    """
    out: dict[str, Any] = {}
    if not should_trigger_enforcement(user_id, app_category):
        return out

    session = get_active_focus_session(user_id)
    if not session:
        return out

    an = (app_name or "").strip() or "unknown"
    now = ensure_utc_aware(datetime.now(timezone.utc)) or datetime.now(timezone.utc)
    last = ensure_utc_aware(session.last_enforcement_at)
    if session.last_enforcement_app_name == an and last is not None:
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "[FOCUS_ENFORCEMENT][DATETIME_NORMALIZED] user_id=%s now_tz=%s last_tz=%s",
                user_id,
                now.tzinfo,
                last.tzinfo,
            )
        delta = now - last
        if delta.total_seconds() < _ENFORCEMENT_THROTTLE_SECONDS:
            return out

    session.last_enforcement_app_name = an
    session.last_enforcement_at = datetime.now(timezone.utc)

    cat = (app_category or "").strip().lower() or "unknown"
    logger.info(
        "[FOCUS_ENFORCEMENT_TRIGGERED] user_id=%s app=%s category=%s violations=%s",
        user_id,
        an,
        cat,
        int(session.violations_count or 0),
    )

    out["enforcement"] = True
    out["reason"] = "focus_session_active"
    out["category"] = cat
    out["violations_count"] = int(session.violations_count or 0)
    return out


def increment_focus_violations(user_id: int) -> tuple[FocusSession | None, int]:
    session = get_active_focus_session(user_id)
    if not session:
        return None, 0
    session.violations_count = int(session.violations_count or 0) + 1
    return session, session.violations_count


def apply_threshold_escalation_for_repeated_violations(user_id: int, violations_count: int) -> None:
    """Optional: nudge adaptive thresholds when user repeatedly dismisses enforcement."""
    if violations_count < 3:
        return
    t = UserThreshold.query.filter_by(user_id=user_id).first()
    if not t:
        t = UserThreshold(user_id=user_id)
        db.session.add(t)
    rw = int(t.rapid_switching_window or 10)
    t.rapid_switching_window = min(18, rw + 1)
    logger.info(
        "[FOCUS_ENFORCEMENT_ESCALATION] user_id=%s violations=%s rapid_switching_window=%s",
        user_id,
        violations_count,
        t.rapid_switching_window,
    )
