from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


# ==============================
# USER MODEL
# ==============================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    # Primary device identity (used instead of login accounts)
    device_id = db.Column(
        db.String(120),
        unique=True,
        nullable=False
    )

    # Optional user profile information
    name = db.Column(
        db.String(100),
        nullable=True
    )

    email = db.Column(
        db.String(120),
        nullable=True
    )

    # User experience mode (balanced / focus / strict etc.)
    mode_preference = db.Column(
        db.String(50),
        default="balanced"
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    # Behavioral state memory
    last_known_state = db.Column(
        db.String(50),
        default="focused"
    )

    # Used for switch detection
    last_app_name = db.Column(
        db.String(120),
        nullable=True
    )

    # Relationships
    usage_logs = db.relationship(
        "UsageLog",
        backref="user",
        lazy=True
    )

    daily_stats = db.relationship(
        "DailyStats",
        backref="user",
        lazy=True
    )

    nudges = db.relationship(
        "Nudge",
        backref="user",
        lazy=True
    )

    thresholds = db.relationship(
        "UserThreshold",
        backref="user",
        uselist=False
    )


# ==============================
# USAGE LOG EVENTS
# ==============================

class UsageLog(db.Model):

    __tablename__ = "usage_logs"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    app_name = db.Column(
        db.String(120),
        nullable=False
    )

    category = db.Column(
        db.String(50),
        nullable=False
    )

    duration = db.Column(
        db.Integer,
        default=0
    )

    event_metadata = db.Column(
        db.JSON,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.Index("idx_usage_user_time", "user_id", "created_at"),
    )


# ==============================
# DAILY STATS
# ==============================

class DailyStats(db.Model):

    __tablename__ = "daily_stats"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    date = db.Column(
        db.Date,
        nullable=False
    )

    total_usage_seconds = db.Column(
        db.Integer,
        default=0
    )

    productivity_seconds = db.Column(
        db.Integer,
        default=0
    )

    # Optional breakdowns by category. These default to 0 to avoid None math.
    social_seconds = db.Column(
        db.Integer,
        default=0
    )

    entertainment_seconds = db.Column(
        db.Integer,
        default=0
    )

    other_seconds = db.Column(
        db.Integer,
        default=0
    )

    app_switches = db.Column(
        db.Integer,
        default=0
    )

    last_event_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "date", name="unique_user_date"),
        db.Index("idx_stats_user_date", "user_id", "date"),
    )

    # ==============================
    # Incremental Update Logic
    # ==============================

    def update_from_event(self, event, user):

        """
        Incrementally update stats when a new usage event arrives.
        Prevents ghost switches and allows fast dashboard queries.
        """

        # Update total usage
        if event.duration:
            self.total_usage_seconds += event.duration

        # Categorize usage
        if event.category == "productivity":
            self.productivity_seconds += event.duration
        elif event.category == "entertainment":
            self.entertainment_seconds += event.duration
        elif event.category == "social":
            self.social_seconds += event.duration
        else:
            # Everything that is not explicitly productivity / entertainment / social
            # is counted as "other" to keep category totals consistent.
            self.other_seconds += event.duration

        # Detect app switches
        if user.last_app_name is not None:
            if user.last_app_name != event.app_name:
                self.app_switches += 1

        # Update user memory
        user.last_app_name = event.app_name

        # Update timestamp
        self.last_event_at = event.created_at


# ==============================
# NUDGES
# ==============================

class Nudge(db.Model):

    __tablename__ = "nudges"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    type = db.Column(
        db.String(50),
        nullable=False
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    severity = db.Column(
        db.String(20),
        default="medium"
    )

    action_label = db.Column(
        db.String(120),
        nullable=True
    )

    action_type = db.Column(
        db.String(50),
        nullable=True
    )

    dismissed = db.Column(
        db.Boolean,
        default=False
    )

    dismissed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )


# ==============================
# USER THRESHOLDS
# ==============================

class UserThreshold(db.Model):

    __tablename__ = "user_thresholds"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    switch_threshold = db.Column(
        db.Integer,
        default=15
    )

    entertainment_threshold = db.Column(
        db.Integer,
        default=60
    )

    rapid_switching_window = db.Column(
        db.Integer,
        default=10
    )

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )


# ==============================
# STREAKS
# ==============================

class Streak(db.Model):

    __tablename__ = "streaks"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    current_streak = db.Column(
        db.Integer,
        default=0
    )

    longest_streak = db.Column(
        db.Integer,
        default=0
    )

    last_active_date = db.Column(
        db.Date,
        nullable=True
    )


# ==============================
# BADGES
# ==============================

class Badge(db.Model):

    __tablename__ = "badges"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(120),
        nullable=False
    )

    description = db.Column(
        db.String(255),
        nullable=False
    )

    badge_metadata = db.Column(
        db.JSON,
        nullable=True
    )


class UserBadge(db.Model):

    __tablename__ = "user_badges"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    badge_id = db.Column(
        db.Integer,
        db.ForeignKey("badges.id"),
        nullable=False
    )

    earned_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )


# ==============================
# CHALLENGES
# ==============================

class Challenge(db.Model):

    __tablename__ = "challenges"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(
        db.String(200),
        nullable=False
    )

    description = db.Column(
        db.String(255),
        nullable=False
    )

    challenge_metadata = db.Column(
        db.JSON,
        nullable=True
    )


class UserChallenge(db.Model):

    __tablename__ = "user_challenges"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    challenge_id = db.Column(
        db.Integer,
        db.ForeignKey("challenges.id"),
        nullable=False
    )

    progress = db.Column(
        db.Integer,
        default=0
    )

    completed = db.Column(
        db.Boolean,
        default=False
    )

    started_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )
# """
# Database Models for SpikeSense
# """

# from flask_sqlalchemy import SQLAlchemy
# from datetime import datetime
# from sqlalchemy import func

# db = SQLAlchemy()


# class User(db.Model):
#     """User model"""
#     __tablename__ = 'users'
    
#     id = db.Column(db.BigInteger, primary_key=True)
#     device_id = db.Column(db.String(255), unique=True, nullable=False)
#     name = db.Column(db.String(255), nullable=False)
#     email = db.Column(db.String(255))
#     mode_preference = db.Column(db.String(50), default='balanced')
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)
#     updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
#     # Relationships
#     app_usage = db.relationship('AppUsage', backref='user', lazy=True)
#     nudges = db.relationship('Nudge', backref='user', lazy=True)
#     thresholds = db.relationship('UserThreshold', backref='user', uselist=False)
#     daily_stats = db.relationship('DailyStats', backref='user', lazy=True)
    
#     def to_dict(self):
#         return {
#             'id': self.id,
#             'device_id': self.device_id,
#             'name': self.name,
#             'email': self.email,
#             'mode_preference': self.mode_preference,
#             'created_at': self.created_at.isoformat()
#         }


# class AppUsage(db.Model):
#     """App usage tracking model"""
#     __tablename__ = 'app_usage'
    
#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
#     app_name = db.Column(db.String(255), nullable=False)
#     category = db.Column(db.String(50), nullable=False)  # productivity, social, entertainment, other
#     duration_minutes = db.Column(db.Float, nullable=False)
#     timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
#     def to_dict(self):
#         return {
#             'id': self.id,
#             'user_id': self.user_id,
#             'app_name': self.app_name,
#             'category': self.category,
#             'duration_minutes': self.duration_minutes,
#             'timestamp': self.timestamp.isoformat()
#         }


# class Nudge(db.Model):
#     """Nudge model for in-app notifications only."""
#     __tablename__ = 'nudges'

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
#     type = db.Column(db.String(50), nullable=False)
#     message = db.Column(db.Text, nullable=False)
#     severity = db.Column(db.String(20), default='medium')
#     action_label = db.Column(db.String(100))
#     action_type = db.Column(db.String(50))
#     dismissed = db.Column(db.Boolean, default=False)
#     dismissed_at = db.Column(db.DateTime)
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)

#     def to_dict(self):
#         return {
#             'id': self.id,
#             'user_id': self.user_id,
#             'type': self.type,
#             'message': self.message,
#             'severity': self.severity,
#             'action_label': self.action_label,
#             'action_type': self.action_type,
#             'dismissed': self.dismissed,
#             'created_at': self.created_at.isoformat(),
#         }


# class UserThreshold(db.Model):
#     """Personalized thresholds for each user (AI-learned)"""
#     __tablename__ = 'user_thresholds'
    
#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), unique=True, nullable=False)
#     switch_threshold = db.Column(db.Integer, default=15)  # switches per hour
#     entertainment_threshold = db.Column(db.Integer, default=60)  # minutes
#     break_interval = db.Column(db.Integer, default=45)  # minutes
#     rapid_switching_window = db.Column(db.Integer, default=10)  # switches in X minutes
#     updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
#     def to_dict(self):
#         return {
#             'id': self.id,
#             'user_id': self.user_id,
#             'switch_threshold': self.switch_threshold,
#             'entertainment_threshold': self.entertainment_threshold,
#             'break_interval': self.break_interval,
#             'rapid_switching_window': self.rapid_switching_window,
#             'updated_at': self.updated_at.isoformat()
#         }


# class DailyStats(db.Model):
#     """Daily aggregated statistics"""
#     __tablename__ = 'daily_stats'
    
#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
#     date = db.Column(db.Date, nullable=False)
#     total_screen_time = db.Column(db.Float, default=0)  # minutes
#     app_switches = db.Column(db.Integer, default=0)
#     productivity_time = db.Column(db.Float, default=0)  # minutes
#     social_time = db.Column(db.Float, default=0)  # minutes
#     entertainment_time = db.Column(db.Float, default=0)  # minutes
#     other_time = db.Column(db.Float, default=0)  # minutes
#     focus_time = db.Column(db.Float, default=0)  # minutes
#     focus_score = db.Column(db.Float)  # 0-100
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)
#     updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
#     __table_args__ = (db.UniqueConstraint('user_id', 'date', name='unique_user_date'),)
    
#     def calculate_focus_score(self):
#         """Calculate focus score based on productivity time and app switches"""
#         if self.total_screen_time == 0:
#             return 0
        
#         # Base score from productivity ratio
#         productivity_ratio = self.productivity_time / max(self.total_screen_time, 1)
#         productivity_score = productivity_ratio * 50
        
#         # Penalty for high switching
#         switch_penalty = min(self.app_switches / 50, 1) * 50
        
#         focus_score = max(0, min(100, productivity_score + (50 - switch_penalty)))
#         self.focus_score = focus_score
#         return focus_score
    
#     def to_dict(self):
#         return {
#             'id': self.id,
#             'user_id': self.user_id,
#             'date': self.date.isoformat(),
#             'total_screen_time': self.total_screen_time,
#             'app_switches': self.app_switches,
#             'productivity_time': self.productivity_time,
#             'social_time': self.social_time,
#             'entertainment_time': self.entertainment_time,
#             'other_time': self.other_time,
#             'focus_time': self.focus_time,
#             'focus_score': self.focus_score or self.calculate_focus_score()
#         }

# class Streak(db.Model):
#     __tablename__ = "streaks"

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

#     start_date = db.Column(db.Date, nullable=False)
#     last_active_date = db.Column(db.Date, nullable=False)
#     current_length = db.Column(db.Integer, default=1)

#     created_at = db.Column(db.DateTime, default=datetime.utcnow)


# class UserChallenge(db.Model):
#     __tablename__ = "user_challenges"

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

#     challenge_type = db.Column(db.String(64), nullable=False)
#     target = db.Column(db.Integer, nullable=False)
#     progress = db.Column(db.Integer, default=0)

#     completed = db.Column(db.Boolean, default=False)
#     started_at = db.Column(db.DateTime, default=datetime.utcnow)
#     completed_at = db.Column(db.DateTime)


# class UserBadge(db.Model):
#     __tablename__ = "user_badges"

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

#     badge_type = db.Column(db.String(64), nullable=False)
#     awarded_at = db.Column(db.DateTime, default=datetime.utcnow)
