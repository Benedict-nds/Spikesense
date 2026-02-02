"""
Database Models for SpikeSense
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import func

db = SQLAlchemy()


class User(db.Model):
    """User model"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    mode_preference = db.Column(db.String(50), default='balanced')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    app_usage = db.relationship('AppUsage', backref='user', lazy=True)
    nudges = db.relationship('Nudge', backref='user', lazy=True)
    thresholds = db.relationship('UserThreshold', backref='user', uselist=False)
    daily_stats = db.relationship('DailyStats', backref='user', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'name': self.name,
            'email': self.email,
            'mode_preference': self.mode_preference,
            'created_at': self.created_at.isoformat()
        }


class AppUsage(db.Model):
    """App usage tracking model"""
    __tablename__ = 'app_usage'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    app_name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # productivity, social, entertainment, other
    duration_minutes = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'app_name': self.app_name,
            'category': self.category,
            'duration_minutes': self.duration_minutes,
            'timestamp': self.timestamp.isoformat()
        }


class Nudge(db.Model):
    """Nudge/notification model"""
    __tablename__ = 'nudges'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # insight, challenge, restriction, etc.
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='medium')  # low, medium, high
    action_label = db.Column(db.String(100))
    action_type = db.Column(db.String(50))  # focus_mode, take_break, view_stats
    dismissed = db.Column(db.Boolean, default=False)
    dismissed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'message': self.message,
            'severity': self.severity,
            'action_label': self.action_label,
            'action_type': self.action_type,
            'dismissed': self.dismissed,
            'created_at': self.created_at.isoformat()
        }


class UserThreshold(db.Model):
    """Personalized thresholds for each user (AI-learned)"""
    __tablename__ = 'user_thresholds'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    switch_threshold = db.Column(db.Integer, default=15)  # switches per hour
    entertainment_threshold = db.Column(db.Integer, default=60)  # minutes
    break_interval = db.Column(db.Integer, default=45)  # minutes
    rapid_switching_window = db.Column(db.Integer, default=10)  # switches in X minutes
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'switch_threshold': self.switch_threshold,
            'entertainment_threshold': self.entertainment_threshold,
            'break_interval': self.break_interval,
            'rapid_switching_window': self.rapid_switching_window,
            'updated_at': self.updated_at.isoformat()
        }


class DailyStats(db.Model):
    """Daily aggregated statistics"""
    __tablename__ = 'daily_stats'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    total_screen_time = db.Column(db.Float, default=0)  # minutes
    app_switches = db.Column(db.Integer, default=0)
    productivity_time = db.Column(db.Float, default=0)  # minutes
    social_time = db.Column(db.Float, default=0)  # minutes
    entertainment_time = db.Column(db.Float, default=0)  # minutes
    other_time = db.Column(db.Float, default=0)  # minutes
    focus_time = db.Column(db.Float, default=0)  # minutes
    focus_score = db.Column(db.Float)  # 0-100
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='unique_user_date'),)
    
    def calculate_focus_score(self):
        """Calculate focus score based on productivity time and app switches"""
        if self.total_screen_time == 0:
            return 0
        
        # Base score from productivity ratio
        productivity_ratio = self.productivity_time / max(self.total_screen_time, 1)
        productivity_score = productivity_ratio * 50
        
        # Penalty for high switching
        switch_penalty = min(self.app_switches / 50, 1) * 50
        
        focus_score = max(0, min(100, productivity_score + (50 - switch_penalty)))
        self.focus_score = focus_score
        return focus_score
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'date': self.date.isoformat(),
            'total_screen_time': self.total_screen_time,
            'app_switches': self.app_switches,
            'productivity_time': self.productivity_time,
            'social_time': self.social_time,
            'entertainment_time': self.entertainment_time,
            'other_time': self.other_time,
            'focus_time': self.focus_time,
            'focus_score': self.focus_score or self.calculate_focus_score()
        }

