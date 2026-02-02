"""
Nudge Generation Engine
Creates personalized, contextual nudges based on detected patterns
"""

from typing import Dict, Any, List
import random
import logging

logger = logging.getLogger(__name__)


class NudgeEngine:
    """
    Generates gentle, supportive, and motivational nudges
    based on detected overstimulation patterns
    """
    
    def __init__(self):
        self.nudge_templates = self._initialize_templates()
    
    def generate_nudge(
        self,
        user_id: int,
        pattern_type: str,
        severity: str,
        context: Dict[str, Any],
        user_mode: str = 'balanced'
    ) -> Dict[str, Any]:
        """
        Generate a nudge based on detected pattern
        
        Args:
            user_id: User identifier
            pattern_type: Type of pattern detected
            severity: Severity level (low, medium, high)
            context: Additional context about the pattern
            user_mode: User's preferred mode (supportive, motivational, restrictive, balanced)
        
        Returns:
            Nudge dictionary with message and action
        """
        templates = self.nudge_templates.get(pattern_type, {})
        severity_templates = templates.get(severity, templates.get('medium', []))
        
        if not severity_templates:
            # Fallback to generic templates
            severity_templates = self.nudge_templates.get('generic', {}).get(severity, [])
        
        if not severity_templates:
            return None
        
        # Select template based on user mode
        mode_appropriate_templates = [
            t for t in severity_templates 
            if user_mode in t.get('modes', ['balanced', 'supportive', 'motivational', 'restrictive'])
        ]
        
        if not mode_appropriate_templates:
            mode_appropriate_templates = severity_templates
        
        template = random.choice(mode_appropriate_templates)
        
        # Customize message with context
        message = self._customize_message(template['message'], context, pattern_type)
        
        nudge = {
            'type': template.get('type', 'insight'),
            'message': message,
            'severity': severity,
            'action_label': template.get('action_label'),
            'action_type': template.get('action_type')
        }
        
        return nudge
    
    def _customize_message(
        self,
        template: str,
        context: Dict[str, Any],
        pattern_type: str
    ) -> str:
        """Customize nudge message with specific context"""
        message = template
        
        # Replace context variables
        if 'switch_count' in context:
            message = message.replace('{switch_count}', str(context['switch_count']))
        if 'switches_per_hour' in context:
            message = message.replace('{switches_per_hour}', str(int(context['switches_per_hour'])))
        if 'entertainment_time' in context:
            hours = int(context['entertainment_time'] // 60)
            mins = int(context['entertainment_time'] % 60)
            time_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            message = message.replace('{entertainment_time}', time_str)
        
        return message
    
    def _initialize_templates(self) -> Dict[str, Any]:
        """Initialize nudge message templates"""
        return {
            'rapid_switching': {
                'low': [
                    {
                        'message': 'You\'ve been switching apps frequently. Consider focusing on one task for better productivity.',
                        'type': 'insight',
                        'action_label': 'View Focus Tips',
                        'action_type': 'view_stats',
                        'modes': ['supportive', 'balanced']
                    }
                ],
                'medium': [
                    {
                        'message': 'You\'ve switched apps {switch_count} times recently. Frequent switching can lead to cognitive overload. Try the Pomodoro technique: 25 minutes of focused work, then a break.',
                        'type': 'insight',
                        'action_label': 'Start Focus Session',
                        'action_type': 'focus_mode',
                        'modes': ['supportive', 'balanced', 'motivational']
                    },
                    {
                        'message': 'Quick check-in: You\'ve been switching between apps quite a bit. Would you like to try a 20-minute focus session?',
                        'type': 'challenge',
                        'action_label': 'Accept Challenge',
                        'action_type': 'focus_mode',
                        'modes': ['motivational', 'balanced']
                    }
                ],
                'high': [
                    {
                        'message': 'You\'ve switched apps {switch_count} times in the last hour — that\'s a sign of cognitive overload. Let\'s take a moment to breathe and refocus.',
                        'type': 'insight',
                        'action_label': 'Take a Break',
                        'action_type': 'take_break',
                        'modes': ['supportive', 'balanced']
                    },
                    {
                        'message': 'Rapid app switching detected! Your brain might be feeling overwhelmed. Would you like to enable Focus Mode for 30 minutes?',
                        'type': 'restriction',
                        'action_label': 'Enable Focus Mode',
                        'action_type': 'focus_mode',
                        'modes': ['restrictive', 'balanced']
                    }
                ]
            },
            'entertainment_overload': {
                'medium': [
                    {
                        'message': 'You\'ve spent {entertainment_time} on entertainment apps. Consider balancing with some productive activities.',
                        'type': 'insight',
                        'action_label': 'View Balance',
                        'action_type': 'view_stats',
                        'modes': ['supportive', 'balanced']
                    },
                    {
                        'message': 'Entertainment break time! You\'ve been scrolling for a while. How about a quick walk or switching to a productive task?',
                        'type': 'challenge',
                        'action_label': 'Take a Break',
                        'action_type': 'take_break',
                        'modes': ['motivational', 'balanced']
                    }
                ],
                'high': [
                    {
                        'message': 'You\'ve spent {entertainment_time} on entertainment today. Extended screen time can impact focus and sleep. Consider setting a limit.',
                        'type': 'insight',
                        'action_label': 'Set Limit',
                        'action_type': 'view_stats',
                        'modes': ['supportive', 'balanced']
                    }
                ]
            },
            'cognitive_overload': {
                'medium': [
                    {
                        'message': 'Your usage pattern suggests cognitive overload — high switching combined with entertainment. Try focusing on one task for 25 minutes.',
                        'type': 'insight',
                        'action_label': 'Start Focus Session',
                        'action_type': 'focus_mode',
                        'modes': ['supportive', 'balanced', 'motivational']
                    }
                ],
                'high': [
                    {
                        'message': 'Signs of cognitive overload detected. Your brain needs a break! Try the 20-20-20 rule: look at something 20 feet away for 20 seconds.',
                        'type': 'insight',
                        'action_label': 'Take a Break',
                        'action_type': 'take_break',
                        'modes': ['supportive', 'balanced']
                    },
                    {
                        'message': 'High cognitive load detected. Would you like to enable Focus Mode to help you regain concentration?',
                        'type': 'restriction',
                        'action_label': 'Enable Focus Mode',
                        'action_type': 'focus_mode',
                        'modes': ['restrictive', 'balanced']
                    }
                ]
            },
            'generic': {
                'low': [
                    {
                        'message': 'Gentle reminder: Take a moment to check in with yourself. How are you feeling?',
                        'type': 'insight',
                        'modes': ['supportive', 'balanced']
                    }
                ],
                'medium': [
                    {
                        'message': 'Consider taking a short break to refresh your mind and improve focus.',
                        'type': 'insight',
                        'action_label': 'Take a Break',
                        'action_type': 'take_break',
                        'modes': ['supportive', 'balanced', 'motivational']
                    }
                ],
                'high': [
                    {
                        'message': 'Your usage patterns suggest you might benefit from a focused break. Consider stepping away for a few minutes.',
                        'type': 'insight',
                        'action_label': 'Take a Break',
                        'action_type': 'take_break',
                        'modes': ['supportive', 'balanced']
                    }
                ]
            }
        }

