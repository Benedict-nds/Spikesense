"""
State-aware Nudge Engine
Production-grade behavioral intervention layer.

Designed for:
- transition-driven nudges
- nudge fatigue prevention
- deterministic template rotation (LRU)
- empathetic, Apple-style tone
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


# -------------------------------------------------
# Domain
# -------------------------------------------------

class CognitiveState:
    FOCUSED = "focused"
    DISTRACTED = "distracted"
    OVERSTIMULATED = "overstimulated"


# -------------------------------------------------
# History & cooldown management
# -------------------------------------------------

class HistoryManager:
    """
    Tracks when nudges were last shown per (user, pattern).
    Used to enforce cooldowns and avoid nudge fatigue.
    """

    def __init__(self, cooldown_hours: int = 2) -> None:
        self._cooldown = timedelta(hours=cooldown_hours)
        self._last_sent: Dict[Tuple[int, str], datetime] = {}

    def can_send(
        self,
        user_id: int,
        pattern: str,
        now: datetime,
        cooldown_override: Optional[timedelta] = None,
    ) -> bool:
        key = (user_id, pattern)

        last = self._last_sent.get(key)
        if last is None:
            return True

        cd = cooldown_override if cooldown_override is not None else self._cooldown
        return now - last >= cd

    def mark_sent(self, user_id: int, pattern: str, now: datetime) -> None:
        self._last_sent[(user_id, pattern)] = now


# -------------------------------------------------
# LRU template rotation
# -------------------------------------------------

class TemplateLRU:
    """
    Keeps per-template usage order so we never repeat
    the same message twice in a row.
    """

    def __init__(self) -> None:
        self._queues: Dict[str, deque[int]] = defaultdict(deque)

    def pick(self, bucket_key: str, templates: List[Dict[str, Any]]) -> Dict[str, Any]:
        q = self._queues[bucket_key]

        if not q:
            q.extend(range(len(templates)))

        idx = q.popleft()
        q.append(idx)

        return templates[idx]


# -------------------------------------------------
# Small formatting helpers
# -------------------------------------------------

def pluralize(value: int, unit: str) -> str:
    if value == 1:
        return f"{value} {unit}"
    return f"{value} {unit}s"


def minutes_to_string(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60

    parts = []
    if h:
        parts.append(pluralize(h, "hour"))
    if m:
        parts.append(pluralize(m, "minute"))

    return " ".join(parts) if parts else "0 minutes"


# -------------------------------------------------
# Engine
# -------------------------------------------------

class NudgeEngine:
    """
    State-aware behavioral intervention engine.

    Nudges are emitted only on meaningful
    CognitiveState transitions and are rate-limited
    through a history manager.
    """

    def __init__(self, cooldown_hours: int = 2) -> None:
        self._templates = self._initialize_templates()
        self._history = HistoryManager(cooldown_hours)
        self._lru = TemplateLRU()

    # -------------------------------------------------

    def generate_nudge(
        self,
        user_id: int,
        pattern: str,
        severity: str,
        context: Dict[str, Any],
        previous_state: str,
        current_state: str,
        focus_mode: str = "Personal",
        nudge_cooldown_hours: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a nudge only when a meaningful
        cognitive transition occurs.

        Example:
            focused → distracted
            distracted → overstimulated

        nudge_cooldown_hours: when set, overrides HistoryManager default for this decision.
        """

        now = datetime.now(timezone.utc)
        # now = datetime.utcnow()

        if not self._is_transition_worthy(previous_state, current_state):
            return None

        cooldown_td: Optional[timedelta] = None
        if nudge_cooldown_hours is not None:
            try:
                h = float(nudge_cooldown_hours)
                if h > 0:
                    cooldown_td = timedelta(hours=h)
            except (TypeError, ValueError):
                cooldown_td = None

        if not self._history.can_send(user_id, pattern, now, cooldown_td):
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "[NUDGE_COOLDOWN_EFFECTIVE] user_id=%s pattern=%s blocked cooldown_h=%s",
                    user_id,
                    pattern,
                    nudge_cooldown_hours,
                )
            return None

        templates = self._lookup_templates(
            pattern=pattern,
            severity=severity,
            mode=focus_mode
        )

        if not templates:
            return None

        bucket_key = f"{pattern}:{severity}:{focus_mode}"
        template = self._lru.pick(bucket_key, templates)

        message = self._render_message(
            template["message"],
            context
        )

        payload = self._build_action_payload(
            template.get("action_type"),
            context,
            focus_mode
        )

        self._history.mark_sent(user_id, pattern, now)

        action_type = template.get("action_type")
        action_label = {
            "focus_mode": "Start Focus Session",
            "take_break": "Take a Break",
            "screen_limit": "Set Limit",
        }.get(action_type)

        return {
            "pattern": pattern,
            "severity": severity,
            "message": message,
            "type": template["type"],
            "payload": payload,
            "action_type": action_type,
            "action_label": action_label,
            "meta": {
                "trigger": f"{previous_state}->{current_state}",
                "mode": focus_mode,
            }
        }

    # -------------------------------------------------
    # Transition logic
    # -------------------------------------------------

    def _is_transition_worthy(
        self,
        prev: str,
        cur: str
    ) -> bool:

        return (
            (prev == CognitiveState.FOCUSED and cur == CognitiveState.DISTRACTED) or
            (prev == CognitiveState.DISTRACTED and cur == CognitiveState.OVERSTIMULATED)
        )

    # -------------------------------------------------
    # Hierarchical template lookup
    # Pattern → Severity → Mode → Default
    # -------------------------------------------------

    def _lookup_templates(
        self,
        pattern: str,
        severity: str,
        mode: str
    ) -> List[Dict[str, Any]]:

        root = self._templates

        for p in (pattern, "generic"):
            p_node = root.get(p)
            if not p_node:
                continue

            s_node = p_node.get(severity) or p_node.get("medium")
            if not s_node:
                continue

            mode_filtered = [
                t for t in s_node
                if mode in t.get("modes", ["Personal"])
            ]

            return mode_filtered or s_node

        return []

    # -------------------------------------------------
    # Message rendering
    # -------------------------------------------------

    def _render_message(
        self,
        template: str,
        context: Dict[str, Any]
    ) -> str:

        data = dict(context)

        if "switch_count" in data:
            data["switches"] = pluralize(int(data["switch_count"]), "switch")

        if "entertainment_time" in data:
            data["entertainment_time"] = minutes_to_string(
                int(data["entertainment_time"])
            )

        try:
            return template.format(**data)
        except Exception:
            logger.exception("Template formatting failed")
            return template

    # -------------------------------------------------
    # Action payloads
    # -------------------------------------------------

    def _build_action_payload(
        self,
        action_type: Optional[str],
        context: Dict[str, Any],
        mode: str
    ) -> Optional[Dict[str, Any]]:

        if not action_type:
            return None

        if action_type == "focus_mode":
            return {
                "type": "ENABLE_FOCUS_MODE",
                "duration_minutes": 25,
                "mode": mode
            }

        if action_type == "take_break":
            return {
                "type": "START_BREAK",
                "duration_minutes": 5
            }

        if action_type == "screen_limit":
            return {
                "type": "SET_SCREEN_TIME_LIMIT",
                "category": context.get("category"),
                "minutes": 30
            }

        return {
            "type": action_type
        }

    # -------------------------------------------------
    # Templates
    # -------------------------------------------------

    def _initialize_templates(self) -> Dict[str, Any]:

        return {
            "rapid_switching": {
                "medium": [
                    {
                        "type": "insight",
                        "modes": ["Personal", "Work"],
                        "message":
                            "It looks like a lot is happening right now — {switches} in a short time. "
                            "We could try a quick focus window together.",
                        "action_type": "focus_mode",
                    }
                ],
                "high": [
                    {
                        "type": "support",
                        "modes": ["Personal", "Work"],
                        "message":
                            "We’re noticing frequent app changes — {switches}. "
                            "A short pause can help everything feel a bit steadier.",
                        "action_type": "take_break",
                    }
                ]
            },

            "entertainment_overload": {
                "medium": [
                    {
                        "type": "insight",
                        "modes": ["Personal"],
                        "message":
                            "We’ve spent about {entertainment_time} on entertainment. "
                            "Want to rebalance with a quick focus session?",
                        "action_type": "focus_mode",
                    }
                ],
                "high": [
                    {
                        "type": "support",
                        "modes": ["Personal"],
                        "message":
                            "We’ve been scrolling for {entertainment_time}. "
                            "A short break could help reset your focus.",
                        "action_type": "take_break",
                    }
                ]
            },

            "cognitive_overload": {
                "medium": [
                    {
                        "type": "support",
                        "modes": ["Work", "Personal"],
                        "message":
                            "It looks like a lot is competing for attention right now. "
                            "We can create a calm 25-minute focus space if you’d like.",
                        "action_type": "focus_mode",
                    }
                ],
                "high": [
                    {
                        "type": "support",
                        "modes": ["Work", "Personal"],
                        "message":
                            "Things feel intense at the moment. "
                            "Let’s slow things down together for a few minutes.",
                        "action_type": "take_break",
                    }
                ]
            },

            "generic": {
                "medium": [
                    {
                        "type": "support",
                        "modes": ["Personal", "Work"],
                        "message":
                            "We’re here if you’d like a short moment to reset your focus.",
                        "action_type": "take_break",
                    }
                ]
            }
        }
# """
# Nudge Generation Engine
# Creates personalized, contextual nudges based on detected patterns
# """

# from typing import Dict, Any, List
# import random
# import logging

# logger = logging.getLogger(__name__)


# class NudgeEngine:
#     """
#     Generates gentle, supportive, and motivational nudges
#     based on detected overstimulation patterns
#     """
    
#     def __init__(self):
#         self.nudge_templates = self._initialize_templates()
    
#     def generate_nudge(
#         self,
#         user_id: int,
#         pattern_type: str,
#         severity: str,
#         context: Dict[str, Any],
#         user_mode: str = 'balanced'
#     ) -> Dict[str, Any]:
#         """
#         Generate a nudge based on detected pattern
        
#         Args:
#             user_id: User identifier
#             pattern_type: Type of pattern detected
#             severity: Severity level (low, medium, high)
#             context: Additional context about the pattern
#             user_mode: User's preferred mode (supportive, motivational, restrictive, balanced)
        
#         Returns:
#             Nudge dictionary with message and action
#         """
#         templates = self.nudge_templates.get(pattern_type, {})
#         severity_templates = templates.get(severity, templates.get('medium', []))
        
#         if not severity_templates:
#             # Fallback to generic templates
#             severity_templates = self.nudge_templates.get('generic', {}).get(severity, [])
        
#         if not severity_templates:
#             # Final fallback: use generic medium templates
#             severity_templates = self.nudge_templates.get('generic', {}).get('medium', [])
        
#         if not severity_templates:
#             # Ultimate fallback: use any available generic template
#             generic_templates = self.nudge_templates.get('generic', {})
#             for sev in ['medium', 'high', 'low']:
#                 if sev in generic_templates and generic_templates[sev]:
#                     severity_templates = generic_templates[sev]
#                     break
        
#         # Select template based on user mode
#         mode_appropriate_templates = [
#             t for t in severity_templates 
#             if user_mode in t.get('modes', ['balanced', 'supportive', 'motivational', 'restrictive'])
#         ]
        
#         if not mode_appropriate_templates:
#             mode_appropriate_templates = severity_templates
        
#         template = random.choice(mode_appropriate_templates)
        
#         # Customize message with context
#         message = self._customize_message(template['message'], context, pattern_type)
        
#         nudge = {
#             'type': template.get('type', 'insight'),
#             'message': message,
#             'severity': severity,
#             'action_label': template.get('action_label'),
#             'action_type': template.get('action_type')
#         }
        
#         return nudge
    
#     def _customize_message(
#         self,
#         template: str,
#         context: Dict[str, Any],
#         pattern_type: str
#     ) -> str:
#         """Customize nudge message with specific context"""
#         message = template
        
#         # Replace context variables
#         if 'switch_count' in context:
#             message = message.replace('{switch_count}', str(context['switch_count']))
#         elif 'switches_in_window' in context:
#             message = message.replace('{switch_count}', str(context['switches_in_window']))
#         if 'switches_per_hour' in context:
#             message = message.replace('{switches_per_hour}', str(int(context['switches_per_hour'])))
#         if 'entertainment_time' in context:
#             hours = int(context['entertainment_time'] // 60)
#             mins = int(context['entertainment_time'] % 60)
#             time_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
#             message = message.replace('{entertainment_time}', time_str)
        
#         return message
    
#     def _initialize_templates(self) -> Dict[str, Any]:
#         """Initialize nudge message templates"""
#         return {
#             'rapid_switching': {
#                 'low': [
#                     {
#                         'message': 'You\'ve been switching apps frequently. Consider focusing on one task for better productivity.',
#                         'type': 'insight',
#                         'action_label': 'View Focus Tips',
#                         'action_type': 'view_stats',
#                         'modes': ['supportive', 'balanced']
#                     }
#                 ],
#                 'medium': [
#                     {
#                         'message': 'You\'ve switched apps {switch_count} times recently. Frequent switching can lead to cognitive overload. Try the Pomodoro technique: 25 minutes of focused work, then a break.',
#                         'type': 'insight',
#                         'action_label': 'Start Focus Session',
#                         'action_type': 'focus_mode',
#                         'modes': ['supportive', 'balanced', 'motivational']
#                     },
#                     {
#                         'message': 'Quick check-in: You\'ve been switching between apps quite a bit. Would you like to try a 20-minute focus session?',
#                         'type': 'challenge',
#                         'action_label': 'Accept Challenge',
#                         'action_type': 'focus_mode',
#                         'modes': ['motivational', 'balanced']
#                     }
#                 ],
#                 'high': [
#                     {
#                         'message': 'You\'ve switched apps {switch_count} times in the last hour — that\'s a sign of cognitive overload. Let\'s take a moment to breathe and refocus.',
#                         'type': 'insight',
#                         'action_label': 'Take a Break',
#                         'action_type': 'take_break',
#                         'modes': ['supportive', 'balanced']
#                     },
#                     {
#                         'message': 'Rapid app switching detected! Your brain might be feeling overwhelmed. Would you like to enable Focus Mode for 30 minutes?',
#                         'type': 'restriction',
#                         'action_label': 'Enable Focus Mode',
#                         'action_type': 'focus_mode',
#                         'modes': ['restrictive', 'balanced']
#                     }
#                 ]
#             },
#             'entertainment_overload': {
#                 'medium': [
#                     {
#                         'message': 'You\'ve spent {entertainment_time} on entertainment apps. Consider balancing with some productive activities.',
#                         'type': 'insight',
#                         'action_label': 'View Balance',
#                         'action_type': 'view_stats',
#                         'modes': ['supportive', 'balanced']
#                     },
#                     {
#                         'message': 'Entertainment break time! You\'ve been scrolling for a while. How about a quick walk or switching to a productive task?',
#                         'type': 'challenge',
#                         'action_label': 'Take a Break',
#                         'action_type': 'take_break',
#                         'modes': ['motivational', 'balanced']
#                     }
#                 ],
#                 'high': [
#                     {
#                         'message': 'You\'ve spent {entertainment_time} on entertainment today. Extended screen time can impact focus and sleep. Consider setting a limit.',
#                         'type': 'insight',
#                         'action_label': 'Set Limit',
#                         'action_type': 'view_stats',
#                         'modes': ['supportive', 'balanced']
#                     }
#                 ]
#             },
#             'cognitive_overload': {
#                 'medium': [
#                     {
#                         'message': 'Your usage pattern suggests cognitive overload — high switching combined with entertainment. Try focusing on one task for 25 minutes.',
#                         'type': 'insight',
#                         'action_label': 'Start Focus Session',
#                         'action_type': 'focus_mode',
#                         'modes': ['supportive', 'balanced', 'motivational']
#                     }
#                 ],
#                 'high': [
#                     {
#                         'message': 'Signs of cognitive overload detected. Your brain needs a break! Try the 20-20-20 rule: look at something 20 feet away for 20 seconds.',
#                         'type': 'insight',
#                         'action_label': 'Take a Break',
#                         'action_type': 'take_break',
#                         'modes': ['supportive', 'balanced']
#                     },
#                     {
#                         'message': 'High cognitive load detected. Would you like to enable Focus Mode to help you regain concentration?',
#                         'type': 'restriction',
#                         'action_label': 'Enable Focus Mode',
#                         'action_type': 'focus_mode',
#                         'modes': ['restrictive', 'balanced']
#                     }
#                 ]
#             },
#             'generic': {
#                 'low': [
#                     {
#                         'message': 'Gentle reminder: Take a moment to check in with yourself. How are you feeling?',
#                         'type': 'insight',
#                         'modes': ['supportive', 'balanced']
#                     }
#                 ],
#                 'medium': [
#                     {
#                         'message': 'Consider taking a short break to refresh your mind and improve focus.',
#                         'type': 'insight',
#                         'action_label': 'Take a Break',
#                         'action_type': 'take_break',
#                         'modes': ['supportive', 'balanced', 'motivational']
#                     }
#                 ],
#                 'high': [
#                     {
#                         'message': 'Your usage patterns suggest you might benefit from a focused break. Consider stepping away for a few minutes.',
#                         'type': 'insight',
#                         'action_label': 'Take a Break',
#                         'action_type': 'take_break',
#                         'modes': ['supportive', 'balanced']
#                     }
#                 ]
#             }
#         }

