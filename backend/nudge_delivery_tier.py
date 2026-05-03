"""
Selects how a nudge should be delivered to the client in real time.
Used only for /events response shaping — does not replace DB persistence.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Mapping

logger = logging.getLogger(__name__)

NudgeDelivery = Literal["notification", "mini_orb", "focus_guard"]


def select_nudge_delivery_tier(
    enforcement: bool,
    has_nudge: bool,
    severity: str | None,
) -> NudgeDelivery | None:
    """
    1) Active focus + distracting app (enforcement) -> focus_guard
    2) Otherwise, pattern nudge: low/mild -> notification, medium/high -> mini_orb
    """
    if enforcement:
        return "focus_guard"
    if not has_nudge:
        return None
    s = (severity or "medium").strip().lower()
    if s not in ("low", "medium", "high"):
        s = "medium"
    if s == "low":
        return "notification"
    return "mini_orb"


def build_nudge_payload(
    nudge: Mapping[str, Any] | None,
    *,
    pattern: str | None = None,
    enforcement: bool = False,
) -> dict[str, Any] | None:
    """Full explainable payload for the client; optional nudge for enforcement-only path."""
    if nudge and isinstance(nudge, Mapping):
        pat = nudge.get("pattern")
        if pat is None or pat == "":
            pat = pattern
        out: dict[str, Any] = {
            "id": nudge.get("id"),
            "message": nudge.get("message") or "",
            "explanation": nudge.get("explanation") or "",
            "action_label": nudge.get("action_label"),
            "action_type": nudge.get("action_type"),
            "severity": nudge.get("severity") or "medium",
            "pattern": pat,
        }
        for k, v in list(out.items()):
            if v is None and k in ("id", "action_label", "action_type", "pattern"):
                out.pop(k, None)
        return out

    if enforcement:
        return {
            "id": None,
            "message": "Your focus session is still active.",
            "explanation": "A potentially distracting app was used during focus. Continue or pause from Focus Guard when it appears.",
            "action_label": None,
            "action_type": None,
            "severity": "high",
            "pattern": "focus_session_enforcement",
        }
    return None


def log_delivery_selected(
    user_id: int,
    delivery: NudgeDelivery | None,
    nudge: Mapping[str, Any] | None,
    *,
    pattern: str | None = None,
) -> None:
    nudge_id = nudge.get("id") if nudge and isinstance(nudge, Mapping) else None
    severity = nudge.get("severity") if nudge and isinstance(nudge, Mapping) else None
    p = (pattern or (nudge.get("pattern") if nudge and isinstance(nudge, Mapping) else None)) or ""
    try:
        logger.info(
            "[BACKEND][NUDGE_DELIVERY_SELECTED] user_id=%s delivery=%s nudge_id=%s severity=%s pattern=%s",
            user_id,
            delivery,
            nudge_id,
            severity,
            p,
        )
    except Exception:
        logger.info("[BACKEND][NUDGE_DELIVERY_SELECTED] user_id=%s delivery=%s", user_id, delivery)
