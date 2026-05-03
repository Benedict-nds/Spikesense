"""
Central badge copy, display normalization, and metadata for achievements API.

DB `badges.name` may remain legacy; API exposes canonical `badge_key` + rich copy.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Canonical API key -> full copy (DB seed uses subtitle as short `badges.description` where needed)
BADGE_COPY: dict[str, dict[str, str]] = {
    "LOCKED_IN": {
        "title": "Locked In",
        "subtitle": "3-day focus streak",
        "description": "You stayed consistent across multiple days.",
        "category": "consistency",
        "rarity": "epic",
    },
    "DEEP_FOCUS": {
        "title": "Deep Focus",
        "subtitle": "15+ minutes in one focus session",
        "description": "You completed a meaningful focus session.",
        "category": "focus",
        "rarity": "common",
    },
    "COMEBACK_DAY": {
        "title": "Comeback",
        "subtitle": "Returned after a break",
        "description": "You came back and rebuilt momentum.",
        "category": "consistency",
        "rarity": "rare",
    },
    "TOOK_THE_HINT": {
        "title": "Took the Hint",
        "subtitle": "Responded to a Spike nudge",
        "description": "You noticed a nudge and returned to healthier use.",
        "category": "recovery",
        "rarity": "common",
    },
    "RHYTHM_BUILDER": {
        "title": "Rhythm Builder",
        "subtitle": "Completed three daily challenges",
        "description": "You built a stronger daily rhythm.",
        "category": "consistency",
        "rarity": "epic",
    },
    "SWITCH_TAMER": {
        "title": "Switch Tamer",
        "subtitle": "Reduced rapid app switching",
        "description": "You kept app switching under control and stayed more intentional.",
        "category": "switching",
        "rarity": "rare",
    },
    "LOOP_BREAKER": {
        "title": "Loop Breaker",
        "subtitle": "Broke repeated social app loops",
        "description": "You reduced repeated opens of social apps.",
        "category": "social",
        "rarity": "rare",
    },
    "INSTAGRAM_ESCAPE": {
        "title": "Instagram Escape",
        "subtitle": "Reduced Instagram loops",
        "description": "You used Instagram more intentionally today.",
        "category": "social",
        "rarity": "rare",
    },
    "RESET_MASTER": {
        "title": "Reset Master",
        "subtitle": "Took a healthy break",
        "description": "You paused after signs of overstimulation.",
        "category": "recovery",
        "rarity": "rare",
    },
    "SPIKE_APPROVED": {
        "title": "Spike Approved",
        "subtitle": "Completed your top challenge",
        "description": "Spike picked a challenge, and you handled it.",
        "category": "special",
        "rarity": "epic",
    },
}

# Legacy `badges.name` stored in DB -> canonical API key
LEGACY_BADGE_NAME_TO_CANONICAL: dict[str, str] = {
    "3_day_streak": "LOCKED_IN",
    "FOCUS_STREAK_3": "LOCKED_IN",
    "CHALLENGE_TRIPLE": "RHYTHM_BUILDER",
    "DEEP_FOCUS_SESSION": "DEEP_FOCUS",
    "COME_BACK": "COMEBACK_DAY",
    "COMEBACK_DAY": "COMEBACK_DAY",
    "TOOK_THE_HINT": "TOOK_THE_HINT",
    "RHYTHM_BUILDER": "RHYTHM_BUILDER",
    "LOCKED_IN": "LOCKED_IN",
    "DEEP_FOCUS": "DEEP_FOCUS",
    "SWITCH_TAMER": "SWITCH_TAMER",
    "LOOP_BREAKER": "LOOP_BREAKER",
    "INSTAGRAM_ESCAPE": "INSTAGRAM_ESCAPE",
    "RESET_MASTER": "RESET_MASTER",
    "SPIKE_APPROVED": "SPIKE_APPROVED",
}


def canonical_badge_key(raw_name: str) -> str:
    k = (raw_name or "").strip()
    return LEGACY_BADGE_NAME_TO_CANONICAL.get(k, k)


def db_seed_description(canonical: str) -> str:
    meta = BADGE_COPY.get(canonical, {})
    sub = (meta.get("subtitle") or meta.get("title") or canonical)[:255]
    return sub


def serialize_earned_badge_dict(badge_row: Any, ub: Any) -> dict[str, Any]:
    raw_key = (badge_row.name or "").strip()
    canonical = canonical_badge_key(raw_key)
    if canonical != raw_key:
        logger.info(
            "[BACKEND][BADGE_NORMALIZED] legacy_key=%s canonical_key=%s badge_id=%s",
            raw_key,
            canonical,
            badge_row.id,
        )

    meta = BADGE_COPY.get(
        canonical,
        {
            "title": raw_key.replace("_", " ").title(),
            "subtitle": (badge_row.description or "")[:220],
            "description": (badge_row.description or "")[:500],
            "category": "special",
            "rarity": "common",
        },
    )
    title = meta.get("title") or canonical
    subtitle = meta.get("subtitle") or ""
    long_desc = meta.get("description") or subtitle

    return {
        "id": badge_row.id,
        "badge_key": canonical,
        "title": title,
        "subtitle": subtitle,
        "description": long_desc,
        "category": meta.get("category", "special"),
        "rarity": meta.get("rarity", "common"),
        "earned_at": ub.earned_at.isoformat() if ub.earned_at else None,
        "progress": 100,
        "locked": False,
    }


def available_badges_payload(earned_canonical: set[str]) -> list[dict[str, Any]]:
    """Locked collectibles not yet earned (static pool from BADGE_COPY)."""
    out: list[dict[str, Any]] = []
    for key, meta in sorted(BADGE_COPY.items(), key=lambda x: x[0]):
        if key in earned_canonical:
            continue
        out.append(
            {
                "badge_key": key,
                "title": meta["title"],
                "subtitle": meta["subtitle"],
                "requirement": meta["subtitle"],
                "description": meta["description"],
                "category": meta.get("category", "special"),
                "rarity": meta.get("rarity", "common"),
                "progress": 0,
                "locked": True,
            }
        )
    return out
