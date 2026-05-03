from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum, IntEnum
from typing import Deque, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


# ----------------------------
# Domain types
# ----------------------------

class CognitiveState(Enum):
    FOCUSED = "focused"
    DISTRACTED = "distracted"
    OVERSTIMULATED = "overstimulated"


class Severity(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3


@dataclass(frozen=True)
class UsageEvent:
    user_id: int
    app_name: str
    category: str
    duration: int
    timestamp: datetime


# ----------------------------
# Core Engine
# ----------------------------

class PatternDetector:
    """
    Streaming, state-based overstimulation detection engine.

    Key properties:
    - Zero-copy sliding window evaluation
    - Deterministic state machine with hysteresis (anti-flicker)
    - Lightweight personalization support
    """

    IMPULSIVE_THRESHOLD_SECONDS = 60
    MIN_SAMPLES_FOR_LEARNING = 20

    # Entry thresholds
    BASE_THRESHOLDS = {
        "switches_per_10m": 6,
        "impulsive_weight": 2.5,
        "entertainment_cost": 1.0,
        "overstim_score": 10.0,
    }

    MODE_WEIGHTS = {
        "Work": {
            "entertainment_cost": 2.0,
            "overstim_score": 8.0
        },
        "Personal": {
            "entertainment_cost": 1.0,
            "overstim_score": 10.0
        },
        "Sleep": {
            "entertainment_cost": 2.5,
            "overstim_score": 6.0
        }
    }

    # Width of the stability band (anti-flicker zone)
    HYSTERESIS_FACTOR = 0.15

    def __init__(self, window_minutes: int = 10) -> None:
        self.window = timedelta(minutes=window_minutes)

        self._events: Deque[UsageEvent] = deque()
        self._state: CognitiveState = CognitiveState.FOCUSED

        # Stored only for observability / debugging
        self._last_score: float = 0.0

    # -----------------------------------------------------
    # Public API
    # -----------------------------------------------------

    def process_event(
        self,
        event: UsageEvent,
        focus_mode: str = "Personal",
        personalized_thresholds: Optional[Dict[str, float]] = None,
        mode_profile_multipliers: Optional[Dict[str, float]] = None,
    ) -> Dict[str, object]:

        self._push_event(event)

        metrics = self._compute_window_metrics()
        result = self._detect_overstimulation(
            metrics,
            focus_mode,
            personalized_thresholds,
            mode_profile_multipliers,
        )

        self._state = result["state"]
        return result

    # -----------------------------------------------------
    # Streaming window
    # -----------------------------------------------------

    def _push_event(self, event: UsageEvent) -> None:
        self._events.append(event)

        cutoff = event.timestamp - self.window
        while self._events and self._events[0].timestamp < cutoff:
            self._events.popleft()

    # -----------------------------------------------------
    # Metrics (zero-copy hot path)
    # -----------------------------------------------------

    def _compute_window_metrics(self) -> Dict[str, float]:
        """
        Computes metrics over the sliding window.

        Important:
        - Iterates directly over the deque.
        - No list(...) conversion or intermediate copies.
        """
        window_minutes = max(0.0, self.window.total_seconds() / 60.0)

        if len(self._events) < 2:
            out = {
                "switches": 0,
                "impulsive_switches": 0,
                "intentional_sessions": 0,
                "entertainment_seconds": 0,
                "total_seconds": 0,
                "window_minutes": window_minutes,
                "switch_rate": 0.0,
            }
            self._log_metrics_debug(out)
            return out

        switches = 0
        impulsive = 0
        intentional = 0

        entertainment_seconds = 0
        total_seconds = 0

        iterator = iter(self._events)
        prev = next(iterator)

        for cur in iterator:
            total_seconds += cur.duration

            if cur.category == "entertainment":
                entertainment_seconds += cur.duration

            if cur.app_name != prev.app_name:
                switches += 1

                if prev.duration < self.IMPULSIVE_THRESHOLD_SECONDS:
                    impulsive += 1
                else:
                    intentional += 1

            prev = cur

        switch_rate = (switches / window_minutes) if window_minutes > 0 else 0.0

        out = {
            "switches": switches,
            "switch_rate": switch_rate,
            "impulsive_switches": impulsive,
            "intentional_sessions": intentional,
            "entertainment_seconds": entertainment_seconds,
            "total_seconds": total_seconds,
            "window_minutes": window_minutes,
        }
        self._log_metrics_debug(out)
        return out

    @staticmethod
    def _log_metrics_debug(metrics: Dict[str, float]) -> None:
        if not logger.isEnabledFor(logging.DEBUG):
            return
        logger.debug(
            "[PATTERN_DETECTOR][METRICS] switches=%s switch_rate=%.4f impulsive=%s "
            "entertainment_seconds=%s window_minutes=%.4f total_seconds=%s",
            metrics.get("switches"),
            float(metrics.get("switch_rate", 0.0)),
            metrics.get("impulsive_switches"),
            metrics.get("entertainment_seconds"),
            float(metrics.get("window_minutes", 0.0)),
            metrics.get("total_seconds"),
        )

    # -----------------------------------------------------
    # State machine & scoring
    # -----------------------------------------------------

    def _detect_overstimulation(
        self,
        metrics: Dict[str, float],
        focus_mode: str,
        personalized: Optional[Dict[str, float]],
        mode_profile_multipliers: Optional[Dict[str, float]] = None,
    ) -> Dict[str, object]:

        thresholds = dict(self.BASE_THRESHOLDS)
        thresholds.update(self.MODE_WEIGHTS.get(focus_mode, {}))

        if personalized:
            thresholds.update(personalized)

        # Adaptive mode V2: multiply selected knobs (after base + mode + personalization)
        if mode_profile_multipliers:
            for key, mult in mode_profile_multipliers.items():
                if key not in thresholds or mult is None:
                    continue
                try:
                    thresholds[key] = float(thresholds[key]) * float(mult)
                except (TypeError, ValueError):
                    continue

        thresholds["impulsive_weight"] = max(0.8, float(thresholds.get("impulsive_weight", 2.5)))
        thresholds["entertainment_cost"] = max(0.35, float(thresholds.get("entertainment_cost", 1.0)))
        thresholds["overstim_score"] = max(3.0, float(thresholds.get("overstim_score", 10.0)))

        impulsive_score = (
            metrics["impulsive_switches"]
            * thresholds["impulsive_weight"]
        )

        entertainment_minutes = metrics["entertainment_seconds"] / 60.0
        entertainment_score = (
            entertainment_minutes
            * thresholds["entertainment_cost"]
        )

        total_score = impulsive_score + entertainment_score

        next_state = self._transition_state(
            total_score,
            thresholds["overstim_score"]
        )

        severity = self._severity_from_score(
            total_score,
            thresholds["overstim_score"]
        )

        return {
            "state": next_state,
            "severity": severity,
            "score": round(total_score, 2),
            "metrics": metrics,
            "focus_mode": focus_mode,
            "effective_thresholds": {
                "impulsive_weight": round(float(thresholds["impulsive_weight"]), 4),
                "entertainment_cost": round(float(thresholds["entertainment_cost"]), 4),
                "overstim_score": round(float(thresholds["overstim_score"]), 4),
            },
            "mode_profile_multipliers": dict(mode_profile_multipliers or {}),
        }

    def _transition_state(
        self,
        score: float,
        threshold: float
    ) -> CognitiveState:
        """
        State transition with hysteresis.

        Hysteresis prevents rapid toggling when the score hovers around
        decision thresholds.

        Entry vs exit logic:

        - To transition UP into a more severe state, the score must exceed
          the entry threshold.
        - To transition DOWN into a less severe state, the score must fall
          below a lower exit threshold:

              exit_threshold = entry_threshold * (1 - HYSTERESIS_FACTOR)

        The band between entry and exit thresholds forms a stability zone
        where the current state is preserved.
        """

        hysteresis = threshold * self.HYSTERESIS_FACTOR

        # Entry thresholds
        overstim_enter = threshold
        distracted_enter = threshold * 0.5

        # Exit thresholds
        overstim_exit = threshold - hysteresis
        distracted_exit = distracted_enter - hysteresis

        current = self._state

        # ----------------------------
        # From OVERSTIMULATED
        # ----------------------------
        if current == CognitiveState.OVERSTIMULATED:
            if score < overstim_exit:
                if score >= distracted_enter:
                    next_state = CognitiveState.DISTRACTED
                else:
                    next_state = CognitiveState.FOCUSED
            else:
                next_state = CognitiveState.OVERSTIMULATED

        # ----------------------------
        # From DISTRACTED
        # ----------------------------
        elif current == CognitiveState.DISTRACTED:
            if score >= overstim_enter:
                next_state = CognitiveState.OVERSTIMULATED
            elif score < distracted_exit:
                next_state = CognitiveState.FOCUSED
            else:
                next_state = CognitiveState.DISTRACTED

        # ----------------------------
        # From FOCUSED
        # ----------------------------
        else:
            if score >= overstim_enter:
                next_state = CognitiveState.OVERSTIMULATED
            elif score >= distracted_enter:
                next_state = CognitiveState.DISTRACTED
            else:
                next_state = CognitiveState.FOCUSED

        self._last_score = score
        return next_state

    def _severity_from_score(
        self,
        score: float,
        threshold: float
    ) -> Severity:

        if score >= threshold * 1.2:
            return Severity.HIGH

        if score >= threshold:
            return Severity.MEDIUM

        return Severity.LOW

    # -----------------------------------------------------
    # Robust personalization learning
    # -----------------------------------------------------

    def learn_personal_thresholds(
        self,
        historical_windows: Iterable[Dict[str, float]]
    ) -> Dict[str, float]:

        windows = list(historical_windows)

        if len(windows) < self.MIN_SAMPLES_FOR_LEARNING:
            return {}

        impulsive_counts = [
            w["impulsive_switches"]
            for w in windows
            if "impulsive_switches" in w
        ]

        entertainment_minutes = [
            w["entertainment_seconds"] / 60.0
            for w in windows
            if "entertainment_seconds" in w
        ]

        if not impulsive_counts or not entertainment_minutes:
            return {}

        impulsive_baseline = self._robust_percentile(impulsive_counts, 0.75)
        entertainment_baseline = self._robust_percentile(entertainment_minutes, 0.75)

        impulsive_mean = sum(impulsive_counts) / len(impulsive_counts)
        entertainment_mean = sum(entertainment_minutes) / len(entertainment_minutes)

        return {
            "impulsive_weight": max(
                1.5,
                min(
                    4.0,
                    2.5 * impulsive_baseline / max(1.0, impulsive_mean)
                )
            ),
            "entertainment_cost": max(
                0.8,
                min(
                    3.0,
                    entertainment_baseline / max(1.0, entertainment_mean)
                )
            )
        }

    # -----------------------------------------------------
    # Robust percentile without brittle indexing
    # -----------------------------------------------------

    def _robust_percentile(
        self,
        values: List[float],
        q: float
    ) -> float:

        if not values:
            return 0.0

        values = sorted(values)

        if len(values) == 1:
            return values[0]

        pos = q * (len(values) - 1)
        lower = int(pos)
        upper = min(lower + 1, len(values) - 1)

        if lower == upper:
            return values[lower]

        weight = pos - lower
        return values[lower] * (1.0 - weight) + values[upper] * weight
    
    # -----------------------------------------------------
    # Window maintenance (stale window protection)
    # -----------------------------------------------------

    def heartbeat(self, now: Optional[datetime] = None) -> None:
        """
        Flushes stale events from the sliding window even when no
        new UsageEvent arrives.

        This prevents the 'stale window' problem where old activity
        can incorrectly influence the user's current cognitive state
        after long inactivity.

        Intended to be called periodically by the OS / scheduler.
        """

        if not self._events:
            return

        if now is None:
            now = datetime.utcnow()

        cutoff = now - self.window

        while self._events and self._events[0].timestamp < cutoff:
            self._events.popleft()
# """
# Pattern Detection Engine
# Rule-based and ML-based overstimulation detection
# """

# try:
#     import numpy as np
#     NUMPY_AVAILABLE = True
# except ImportError:
#     NUMPY_AVAILABLE = False
#     np = None

# from datetime import datetime, timedelta
# from typing import Dict, List, Any
# import logging

# logger = logging.getLogger(__name__)


# class PatternDetector:
#     """
#     Detects digital overstimulation patterns using:
#     1. Rule-based baseline model
#     2. Optional lightweight ML model for personalization
#     """
    
#     def __init__(self):
#         self.overstimulating_categories = ['entertainment', 'social']
#         self.productivity_categories = ['productivity']
        
#     def detect_overstimulation(
#         self, 
#         user_id: int, 
#         usage_data: List[Dict[str, Any]],
#         user_thresholds: Dict[str, int] = None
#     ) -> Dict[str, Any]:
#         """
#         Main method to detect overstimulation patterns
        
#         Args:
#             user_id: User identifier
#             usage_data: List of app usage records
#             user_thresholds: Personalized thresholds (if available)
        
#         Returns:
#             Dictionary with detection results
#         """
#         if not usage_data:
#             return {
#                 'is_overstimulated': False,
#                 'pattern_type': None,
#                 'severity': 'low',
#                 'context': {}
#             }
        
#         # Use default thresholds if not provided
#         thresholds = user_thresholds or {
#             'switch_threshold': 15,
#             'entertainment_threshold': 60,
#             'rapid_switching_window': 10
#         }
        
#         # Detect different patterns
#         rapid_switching = self._detect_rapid_switching_pattern(
#             usage_data, 
#             thresholds['rapid_switching_window']
#         )
        
#         entertainment_overload = self._detect_entertainment_overload(
#             usage_data,
#             thresholds['entertainment_threshold']
#         )
        
#         cognitive_overload = self._detect_cognitive_overload(
#             usage_data,
#             thresholds
#         )
        
#         # Determine most severe pattern
#         patterns = [
#             (rapid_switching, 'rapid_switching'),
#             (entertainment_overload, 'entertainment_overload'),
#             (cognitive_overload, 'cognitive_overload')
#         ]
        
#         patterns = [p for p in patterns if p[0]['detected']]
        
#         if not patterns:
#             return {
#                 'is_overstimulated': False,
#                 'pattern_type': None,
#                 'severity': 'low',
#                 'context': {}
#             }
        
#         # Get most severe pattern
#         most_severe = max(patterns, key=lambda x: self._severity_to_score(x[0]['severity']))
#         pattern_result, pattern_type = most_severe
        
#         return {
#             'is_overstimulated': True,
#             'pattern_type': pattern_type,
#             'severity': pattern_result['severity'],
#             'context': pattern_result['context']
#         }
    
#     def detect_rapid_switching(
#         self,
#         user_id: int,
#         switch_count: int,
#         time_window_minutes: int = 60,
#         user_thresholds: Dict[str, int] = None
#     ) -> Dict[str, Any]:
#         """
#         Detect rapid app switching pattern
        
#         Args:
#             user_id: User identifier
#             switch_count: Number of switches in time window
#             time_window_minutes: Time window in minutes
#             user_thresholds: Personalized thresholds
        
#         Returns:
#             Detection result
#         """
#         thresholds = user_thresholds or {'switch_threshold': 15}
#         threshold = thresholds.get('switch_threshold', 15)

#         # Only trigger when switch_count >= threshold (never for 0 or low counts)
#         if switch_count < threshold:
#             return {
#                 'detected': False,
#                 'severity': 'low',
#                 'context': {
#                     'switch_count': switch_count,
#                     'time_window_minutes': time_window_minutes,
#                     'threshold': threshold,
#                 }
#             }

#         # Normalize to per-hour rate
#         switches_per_hour = (switch_count / time_window_minutes) * 60
#         if switches_per_hour < threshold:
#             return {
#                 'detected': False,
#                 'severity': 'low',
#                 'context': {
#                     'switch_count': switch_count,
#                     'time_window_minutes': time_window_minutes,
#                     'switches_per_hour': switches_per_hour,
#                     'threshold': threshold,
#                 }
#             }

#         if switches_per_hour >= threshold * 1.5:
#             severity = 'high'
#         elif switches_per_hour >= threshold:
#             severity = 'medium'
#         else:
#             return {
#                 'detected': False,
#                 'severity': 'low',
#                 'context': {
#                     'switch_count': switch_count,
#                     'time_window_minutes': time_window_minutes,
#                     'switches_per_hour': switches_per_hour,
#                     'threshold': threshold,
#                 }
#             }

#         return {
#             'detected': True,
#             'severity': severity,
#             'context': {
#                 'switch_count': switch_count,
#                 'time_window_minutes': time_window_minutes,
#                 'switches_per_hour': switches_per_hour,
#                 'threshold': threshold,
#             }
#         }

#     def _detect_rapid_switching_pattern(
#         self,
#         usage_data: List[Dict[str, Any]],
#         window_minutes: int = 10
#     ) -> Dict[str, Any]:
#         """Detect rapid switching in a short time window"""
#         if len(usage_data) < 3:
#             return {'detected': False, 'severity': 'low', 'context': {}}
        
#         # Sort by timestamp
#         sorted_data = sorted(usage_data, key=lambda x: x['timestamp'])
#         latest_ts = sorted_data[-1]['timestamp']
#         window_start = latest_ts - timedelta(minutes=window_minutes)
#         recent_data = [r for r in sorted_data if r['timestamp'] >= window_start]

#         if len(recent_data) >= 8:  # 8+ switches in short window
#             return {
#                 'detected': True,
#                 'severity': 'high',
#                 'context': {
#                     'switches_in_window': len(recent_data),
#                     'window_minutes': window_minutes
#                 }
#             }
#         elif len(recent_data) >= 5:
#             return {
#                 'detected': True,
#                 'severity': 'medium',
#                 'context': {
#                     'switches_in_window': len(recent_data),
#                     'window_minutes': window_minutes
#                 }
#             }
        
#         return {'detected': False, 'severity': 'low', 'context': {}}
    
#     def _detect_entertainment_overload(
#         self,
#         usage_data: List[Dict[str, Any]],
#         threshold_minutes: int = 60
#     ) -> Dict[str, Any]:
#         """Detect prolonged entertainment app usage"""
#         entertainment_time = sum(
#             u['duration_minutes'] 
#             for u in usage_data 
#             if u.get('category') == 'entertainment'
#         )
        
#         if entertainment_time >= threshold_minutes * 1.5:
#             return {
#                 'detected': True,
#                 'severity': 'high',
#                 'context': {
#                     'entertainment_time': entertainment_time,
#                     'threshold': threshold_minutes
#                 }
#             }
#         elif entertainment_time >= threshold_minutes:
#             return {
#                 'detected': True,
#                 'severity': 'medium',
#                 'context': {
#                     'entertainment_time': entertainment_time,
#                     'threshold': threshold_minutes
#                 }
#             }
        
#         return {'detected': False, 'severity': 'low', 'context': {}}
    
#     def _detect_cognitive_overload(
#         self,
#         usage_data: List[Dict[str, Any]],
#         thresholds: Dict[str, int]
#     ) -> Dict[str, Any]:
#         """
#         Detect cognitive overload through multiple signals:
#         - High switching + high entertainment
#         - Mixed productivity and distraction
#         - No clear focus periods
#         """
#         total_time = sum(u['duration_minutes'] for u in usage_data)
#         if total_time <= 0:
#             return {'detected': False, 'severity': 'low', 'context': {}}

#         entertainment_ratio = sum(
#             u['duration_minutes'] 
#             for u in usage_data 
#             if u.get('category') == 'entertainment'
#         ) / total_time
        
#         switch_rate = len(usage_data) / (total_time / 60)  # switches per hour
        
#         # Cognitive overload: high switching + high entertainment ratio
#         if switch_rate >= thresholds.get('switch_threshold', 15) and entertainment_ratio > 0.5:
#             return {
#                 'detected': True,
#                 'severity': 'high',
#                 'context': {
#                     'switch_rate': switch_rate,
#                     'entertainment_ratio': entertainment_ratio,
#                     'total_time': total_time
#                 }
#             }
#         elif switch_rate >= thresholds.get('switch_threshold', 15) * 0.7 and entertainment_ratio > 0.3:
#             return {
#                 'detected': True,
#                 'severity': 'medium',
#                 'context': {
#                     'switch_rate': switch_rate,
#                     'entertainment_ratio': entertainment_ratio,
#                     'total_time': total_time
#                 }
#             }
        
#         return {'detected': False, 'severity': 'low', 'context': {}}
    
#     def _severity_to_score(self, severity: str) -> int:
#         """Convert severity string to numeric score for comparison"""
#         severity_map = {'low': 1, 'medium': 2, 'high': 3}
#         return severity_map.get(severity, 0)
    
#     def learn_personal_thresholds(
#         self,
#         user_id: int,
#         historical_data: List[Dict[str, Any]],
#         user_responses: List[Dict[str, Any]]  # User dismissals, actions, etc.
#     ) -> Dict[str, int]:
#         """
#         Learn personalized thresholds from user behavior
        
#         This is a lightweight ML approach that adapts thresholds
#         based on user's actual overstimulation patterns and responses.
        
#         Args:
#             user_id: User identifier
#             historical_data: Past usage patterns
#             user_responses: How user responded to nudges
        
#         Returns:
#             Updated personalized thresholds
#         """
#         if not historical_data:
#             return {
#                 'switch_threshold': 15,
#                 'entertainment_threshold': 60,
#                 'break_interval': 45,
#                 'rapid_switching_window': 10
#             }
        
#         # Analyze historical patterns
#         switch_counts = []
#         entertainment_times = []
        
#         for record in historical_data:
#             if 'app_switches' in record:
#                 switch_counts.append(record['app_switches'])
#             if 'entertainment_time' in record:
#                 entertainment_times.append(record['entertainment_time'])
        
#         # Calculate adaptive thresholds (percentile-based)
#         if switch_counts:
#             # Use 75th percentile as threshold (user-specific baseline)
#             if NUMPY_AVAILABLE:
#                 switch_threshold = int(np.percentile(switch_counts, 75))
#             else:
#                 # Fallback: use sorted median approach
#                 sorted_counts = sorted(switch_counts)
#                 percentile_index = int(len(sorted_counts) * 0.75)
#                 switch_threshold = sorted_counts[percentile_index] if percentile_index < len(sorted_counts) else sorted_counts[-1]
#             switch_threshold = max(10, min(30, switch_threshold))  # Clamp between 10-30
#         else:
#             switch_threshold = 15
        
#         if entertainment_times:
#             if NUMPY_AVAILABLE:
#                 entertainment_threshold = int(np.percentile(entertainment_times, 75))
#             else:
#                 # Fallback: use sorted median approach
#                 sorted_times = sorted(entertainment_times)
#                 percentile_index = int(len(sorted_times) * 0.75)
#                 entertainment_threshold = sorted_times[percentile_index] if percentile_index < len(sorted_times) else sorted_times[-1]
#             entertainment_threshold = max(30, min(120, entertainment_threshold))  # Clamp between 30-120
#         else:
#             entertainment_threshold = 60
        
#         # Adjust based on user responses
#         # If user frequently dismisses nudges, thresholds might be too sensitive
#         if user_responses:
#             dismissal_rate = sum(1 for r in user_responses if r.get('action') == 'dismiss') / len(user_responses)
#             if dismissal_rate > 0.7:  # User dismisses >70% of nudges
#                 switch_threshold = int(switch_threshold * 1.2)  # Increase threshold (less sensitive)
#                 entertainment_threshold = int(entertainment_threshold * 1.2)
        
#         return {
#             'switch_threshold': switch_threshold,
#             'entertainment_threshold': entertainment_threshold,
#             'break_interval': 45,  # Keep standard
#             'rapid_switching_window': 10  # Keep standard
#         }

