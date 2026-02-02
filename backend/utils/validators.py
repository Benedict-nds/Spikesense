"""
Input validation utilities
"""

from typing import Dict, Any, Optional


def validate_app_usage_data(data: Dict[str, Any]) -> Optional[str]:
    """
    Validate app usage data from mobile app
    
    Returns:
        Error message if validation fails, None if valid
    """
    required_fields = ['app_name', 'category', 'duration_minutes', 'timestamp']
    
    for field in required_fields:
        if field not in data:
            return f"Missing required field: {field}"
    
    # Validate category
    valid_categories = ['productivity', 'social', 'entertainment', 'other']
    if data['category'] not in valid_categories:
        return f"Invalid category. Must be one of: {', '.join(valid_categories)}"
    
    # Validate duration
    if not isinstance(data['duration_minutes'], (int, float)) or data['duration_minutes'] < 0:
        return "duration_minutes must be a non-negative number"
    
    # Validate timestamp format (basic check)
    if not isinstance(data['timestamp'], str):
        return "timestamp must be a string in ISO format"
    
    return None



