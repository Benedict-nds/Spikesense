"""
Pattern Detection Engine
Rule-based and ML-based overstimulation detection
"""

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)


class PatternDetector:
    """
    Detects digital overstimulation patterns using:
    1. Rule-based baseline model
    2. Optional lightweight ML model for personalization
    """
    
    def __init__(self):
        self.overstimulating_categories = ['entertainment', 'social']
        self.productivity_categories = ['productivity']
        
    def detect_overstimulation(
        self, 
        user_id: int, 
        usage_data: List[Dict[str, Any]],
        user_thresholds: Dict[str, int] = None
    ) -> Dict[str, Any]:
        """
        Main method to detect overstimulation patterns
        
        Args:
            user_id: User identifier
            usage_data: List of app usage records
            user_thresholds: Personalized thresholds (if available)
        
        Returns:
            Dictionary with detection results
        """
        if not usage_data:
            return {
                'is_overstimulated': False,
                'pattern_type': None,
                'severity': 'low',
                'context': {}
            }
        
        # Use default thresholds if not provided
        thresholds = user_thresholds or {
            'switch_threshold': 15,
            'entertainment_threshold': 60,
            'rapid_switching_window': 10
        }
        
        # Detect different patterns
        rapid_switching = self._detect_rapid_switching_pattern(
            usage_data, 
            thresholds['rapid_switching_window']
        )
        
        entertainment_overload = self._detect_entertainment_overload(
            usage_data,
            thresholds['entertainment_threshold']
        )
        
        cognitive_overload = self._detect_cognitive_overload(
            usage_data,
            thresholds
        )
        
        # Determine most severe pattern
        patterns = [
            (rapid_switching, 'rapid_switching'),
            (entertainment_overload, 'entertainment_overload'),
            (cognitive_overload, 'cognitive_overload')
        ]
        
        patterns = [p for p in patterns if p[0]['detected']]
        
        if not patterns:
            return {
                'is_overstimulated': False,
                'pattern_type': None,
                'severity': 'low',
                'context': {}
            }
        
        # Get most severe pattern
        most_severe = max(patterns, key=lambda x: self._severity_to_score(x[0]['severity']))
        pattern_result, pattern_type = most_severe
        
        return {
            'is_overstimulated': True,
            'pattern_type': pattern_type,
            'severity': pattern_result['severity'],
            'context': pattern_result['context']
        }
    
    def detect_rapid_switching(
        self,
        user_id: int,
        switch_count: int,
        time_window_minutes: int = 60,
        user_thresholds: Dict[str, int] = None
    ) -> Dict[str, Any]:
        """
        Detect rapid app switching pattern
        
        Args:
            user_id: User identifier
            switch_count: Number of switches in time window
            time_window_minutes: Time window in minutes
            user_thresholds: Personalized thresholds
        
        Returns:
            Detection result
        """
        thresholds = user_thresholds or {'switch_threshold': 15}
        threshold = thresholds.get('switch_threshold', 15)
        
        # Normalize to per-hour rate
        switches_per_hour = (switch_count / time_window_minutes) * 60
        
        if switches_per_hour >= threshold * 1.5:
            severity = 'high'
        elif switches_per_hour >= threshold:
            severity = 'medium'
        else:
            return {
                'is_overstimulated': False,
                'severity': 'low',
                'context': {'switch_count': switch_count}
            }
        
        return {
            'is_overstimulated': True,
            'severity': severity,
            'context': {
                'switch_count': switch_count,
                'switches_per_hour': switches_per_hour,
                'threshold': threshold
            }
        }
    
    def _detect_rapid_switching_pattern(
        self,
        usage_data: List[Dict[str, Any]],
        window_minutes: int = 10
    ) -> Dict[str, Any]:
        """Detect rapid switching in a short time window"""
        if len(usage_data) < 3:
            return {'detected': False, 'severity': 'low', 'context': {}}
        
        # Sort by timestamp
        sorted_data = sorted(usage_data, key=lambda x: x['timestamp'])
        
        # Check switches in recent window
        recent_data = sorted_data[-window_minutes:] if len(sorted_data) > window_minutes else sorted_data
        
        if len(recent_data) >= 8:  # 8+ switches in short window
            return {
                'detected': True,
                'severity': 'high',
                'context': {
                    'switches_in_window': len(recent_data),
                    'window_minutes': window_minutes
                }
            }
        elif len(recent_data) >= 5:
            return {
                'detected': True,
                'severity': 'medium',
                'context': {
                    'switches_in_window': len(recent_data),
                    'window_minutes': window_minutes
                }
            }
        
        return {'detected': False, 'severity': 'low', 'context': {}}
    
    def _detect_entertainment_overload(
        self,
        usage_data: List[Dict[str, Any]],
        threshold_minutes: int = 60
    ) -> Dict[str, Any]:
        """Detect prolonged entertainment app usage"""
        entertainment_time = sum(
            u['duration_minutes'] 
            for u in usage_data 
            if u.get('category') == 'entertainment'
        )
        
        if entertainment_time >= threshold_minutes * 1.5:
            return {
                'detected': True,
                'severity': 'high',
                'context': {
                    'entertainment_time': entertainment_time,
                    'threshold': threshold_minutes
                }
            }
        elif entertainment_time >= threshold_minutes:
            return {
                'detected': True,
                'severity': 'medium',
                'context': {
                    'entertainment_time': entertainment_time,
                    'threshold': threshold_minutes
                }
            }
        
        return {'detected': False, 'severity': 'low', 'context': {}}
    
    def _detect_cognitive_overload(
        self,
        usage_data: List[Dict[str, Any]],
        thresholds: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Detect cognitive overload through multiple signals:
        - High switching + high entertainment
        - Mixed productivity and distraction
        - No clear focus periods
        """
        total_time = sum(u['duration_minutes'] for u in usage_data)
        if total_time == 0:
            return {'detected': False, 'severity': 'low', 'context': {}}
        
        entertainment_ratio = sum(
            u['duration_minutes'] 
            for u in usage_data 
            if u.get('category') == 'entertainment'
        ) / total_time
        
        switch_rate = len(usage_data) / (total_time / 60)  # switches per hour
        
        # Cognitive overload: high switching + high entertainment ratio
        if switch_rate >= thresholds.get('switch_threshold', 15) and entertainment_ratio > 0.5:
            return {
                'detected': True,
                'severity': 'high',
                'context': {
                    'switch_rate': switch_rate,
                    'entertainment_ratio': entertainment_ratio,
                    'total_time': total_time
                }
            }
        elif switch_rate >= thresholds.get('switch_threshold', 15) * 0.7 and entertainment_ratio > 0.3:
            return {
                'detected': True,
                'severity': 'medium',
                'context': {
                    'switch_rate': switch_rate,
                    'entertainment_ratio': entertainment_ratio,
                    'total_time': total_time
                }
            }
        
        return {'detected': False, 'severity': 'low', 'context': {}}
    
    def _severity_to_score(self, severity: str) -> int:
        """Convert severity string to numeric score for comparison"""
        severity_map = {'low': 1, 'medium': 2, 'high': 3}
        return severity_map.get(severity, 0)
    
    def learn_personal_thresholds(
        self,
        user_id: int,
        historical_data: List[Dict[str, Any]],
        user_responses: List[Dict[str, Any]]  # User dismissals, actions, etc.
    ) -> Dict[str, int]:
        """
        Learn personalized thresholds from user behavior
        
        This is a lightweight ML approach that adapts thresholds
        based on user's actual overstimulation patterns and responses.
        
        Args:
            user_id: User identifier
            historical_data: Past usage patterns
            user_responses: How user responded to nudges
        
        Returns:
            Updated personalized thresholds
        """
        if not historical_data:
            return {
                'switch_threshold': 15,
                'entertainment_threshold': 60,
                'break_interval': 45,
                'rapid_switching_window': 10
            }
        
        # Analyze historical patterns
        switch_counts = []
        entertainment_times = []
        
        for record in historical_data:
            if 'app_switches' in record:
                switch_counts.append(record['app_switches'])
            if 'entertainment_time' in record:
                entertainment_times.append(record['entertainment_time'])
        
        # Calculate adaptive thresholds (percentile-based)
        if switch_counts:
            # Use 75th percentile as threshold (user-specific baseline)
            if NUMPY_AVAILABLE:
                switch_threshold = int(np.percentile(switch_counts, 75))
            else:
                # Fallback: use sorted median approach
                sorted_counts = sorted(switch_counts)
                percentile_index = int(len(sorted_counts) * 0.75)
                switch_threshold = sorted_counts[percentile_index] if percentile_index < len(sorted_counts) else sorted_counts[-1]
            switch_threshold = max(10, min(30, switch_threshold))  # Clamp between 10-30
        else:
            switch_threshold = 15
        
        if entertainment_times:
            if NUMPY_AVAILABLE:
                entertainment_threshold = int(np.percentile(entertainment_times, 75))
            else:
                # Fallback: use sorted median approach
                sorted_times = sorted(entertainment_times)
                percentile_index = int(len(sorted_times) * 0.75)
                entertainment_threshold = sorted_times[percentile_index] if percentile_index < len(sorted_times) else sorted_times[-1]
            entertainment_threshold = max(30, min(120, entertainment_threshold))  # Clamp between 30-120
        else:
            entertainment_threshold = 60
        
        # Adjust based on user responses
        # If user frequently dismisses nudges, thresholds might be too sensitive
        if user_responses:
            dismissal_rate = sum(1 for r in user_responses if r.get('action') == 'dismiss') / len(user_responses)
            if dismissal_rate > 0.7:  # User dismisses >70% of nudges
                switch_threshold = int(switch_threshold * 1.2)  # Increase threshold (less sensitive)
                entertainment_threshold = int(entertainment_threshold * 1.2)
        
        return {
            'switch_threshold': switch_threshold,
            'entertainment_threshold': entertainment_threshold,
            'break_interval': 45,  # Keep standard
            'rapid_switching_window': 10  # Keep standard
        }

