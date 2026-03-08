"""
SpikeSense Backend API Server
Stateful AI-driven digital wellness backend
"""

from sqlalchemy.exc import IntegrityError
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
import os
from dotenv import load_dotenv
import logging

from models import (
    db,
    User,
    UsageLog,
    DailyStats,
    Nudge,
    UserThreshold,
    Streak,
    UserChallenge,
    UserBadge,
    Challenge,
)

load_dotenv()

app = Flask(__name__)

# -------------------------------------------------------
# Database Configuration
# -------------------------------------------------------

_default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spikesense_dev.sqlite')

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{_default_db}"
)

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "dev-secret")

CORS(app, resources={r"/api/*": {"origins": "*"}})

db.init_app(app)

# -------------------------------------------------------
# Logging
# -------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------------------------------------------
# AI Module Initialization
# -------------------------------------------------------

try:
    from ai_module.pattern_detector import PatternDetector, UsageEvent
    from ai_module.nudge_engine import NudgeEngine

    pattern_detector = PatternDetector()
    nudge_engine = NudgeEngine()

    AI_ENABLED = True

except Exception as e:

    pattern_detector = None
    nudge_engine = None

    AI_ENABLED = False

    logger.warning("AI modules disabled: %s", str(e))


# -------------------------------------------------------
# UsageEvent Dataclass
# -------------------------------------------------------

@dataclass(frozen=True)
class UsageEvent:
    user_id: int
    app_name: str
    category: str
    duration: int
    timestamp: datetime


# -------------------------------------------------------
# Database Initialization
# -------------------------------------------------------

with app.app_context():
    db.create_all()
    logger.info("Database initialized")


# -------------------------------------------------------
# Threshold Adapter
# -------------------------------------------------------

def _get_user_thresholds_dict(user_id):
    """
    Convert user threshold settings into the normalized values expected
    by the AI PatternDetector and NudgeEngine.
    """

    t = UserThreshold.query.filter_by(user_id=user_id).first()

    # Default thresholds if user has not configured any
    if not t:
        entertainment_minutes = 60
        switch_threshold = 15
        rapid_window = 10
    else:
        entertainment_minutes = t.entertainment_threshold or 0
        switch_threshold = t.switch_threshold or 15
        rapid_window = t.rapid_switching_window or 10

    # Normalize entertainment score (minutes → ratio of 1 hour)
    # Protect against divide-by-zero
    entertainment_cost = entertainment_minutes / 60 if entertainment_minutes > 0 else 0

    return {
        # used by overstimulation scoring
        "overstim_score": switch_threshold,

        # weight for impulsive switching
        "impulsive_weight": rapid_window,

        # normalized entertainment usage cost (0.0 – 1.0+)
        "entertainment_cost": entertainment_cost,
    }


# -------------------------------------------------------
# Streak / Challenge Logic
# -------------------------------------------------------

def update_streak_and_badges(user_id):

    today = datetime.now(timezone.utc).date()

    streak = Streak.query.filter_by(user_id=user_id).first()

    if not streak:
        streak = Streak(
            user_id=user_id,
            last_active_date=today,
            current_streak=1,
            longest_streak=1,
        )
        db.session.add(streak)

    else:

        if streak.last_active_date == today:
            pass

        elif streak.last_active_date == today - timedelta(days=1):
            streak.current_streak += 1
            if streak.current_streak > (streak.longest_streak or 0):
                streak.longest_streak = streak.current_streak
            streak.last_active_date = today

        else:
            streak.last_active_date = today
            streak.current_streak = 1

    if streak.current_streak == 3:

        existing = UserBadge.query.filter_by(
            user_id=user_id,
            badge_type="3_day_streak"
        ).first()

        if not existing:
            db.session.add(UserBadge(
                user_id=user_id,
                badge_type="3_day_streak"
            ))


def ensure_default_challenge(user_id):

    # The normalized schema uses a foreign key `challenge_id` into the
    # `challenges` table instead of an inline `challenge_type` column.
    # We look up (or lazily create) a canonical "daily_switch_limit"
    # Challenge row, then ensure there is a corresponding UserChallenge.

    base_challenge = Challenge.query.filter_by(
        title="Daily Switch Limit"
    ).first()

    if not base_challenge:
        base_challenge = Challenge(
            title="Daily Switch Limit",
            description="Stay under your daily app switch target.",
        )
        db.session.add(base_challenge)
        db.session.flush()

    challenge = UserChallenge.query.filter_by(
        user_id=user_id,
        challenge_id=base_challenge.id,
        completed=False
    ).first()

    if not challenge:

        challenge = UserChallenge(
            user_id=user_id,
            challenge_id=base_challenge.id,
            progress=0
        )

        db.session.add(challenge)

    return challenge


# -------------------------------------------------------
# Health Check
# -------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# -------------------------------------------------------
# Create User
# -------------------------------------------------------

@app.route("/api/users", methods=["POST"])
def create_user():

    data = request.get_json()

    device_id = data.get("device_id")

    if not device_id:
        return jsonify({"success": False, "error": "device_id required"}), 400

    user = User.query.filter_by(device_id=device_id).first()

    if user:
        return jsonify({
            "success": True,
            "user_id": user.id
        })

    user = User(
        device_id=device_id,
        name=data.get("name", "User"),
        email=data.get("email"),
        mode_preference=data.get("mode_preference", "balanced")
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "user_id": user.id
    })


# -------------------------------------------------------
# Unified Event Ingestion Endpoint
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/events", methods=["POST"])
def ingest_event(user_id):

    try:

        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "Invalid JSON"}), 400

        app_name = data.get("app_name")
        category = data.get("category")
        # Frontend sends `duration` in seconds; map directly to the UsageLog.duration field
        duration = data.get("duration", 0)
        # Optional additional metadata – stored as JSON, never used in set/dict keys
        event_metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else None

        user = User.query.get_or_404(user_id)

        # ----------------------------------
        # Store raw usage event
        # ----------------------------------

        log = UsageLog(
            user_id=user_id,
            app_name=app_name,
            category=category,
            duration=duration,
            event_metadata=event_metadata,
        )

        db.session.add(log)
        db.session.flush()

        # ----------------------------------
        # Get or Create DailyStats
        # ----------------------------------

        today = datetime.now(timezone.utc).date()

        try:
            daily_stats = DailyStats.query.filter_by(
                user_id=user.id,
                date=today
            ).first()

            if not daily_stats:
                daily_stats = DailyStats(
                    user_id=user.id,
                    date=today
                )
                db.session.add(daily_stats)
                db.session.flush()

        except IntegrityError:
            db.session.rollback()

            daily_stats = DailyStats.query.filter_by(
                user_id=user.id,
                date=today
            ).first()
        # ----------------------------------
        # Incremental Metric Update
        # ----------------------------------

        daily_stats.update_from_event(log, user)

        # ----------------------------------
        # AI Pattern Detection
        # ----------------------------------

        previous_state = user.last_known_state
        current_state = previous_state
        detection = None

        if AI_ENABLED and pattern_detector:

            # Map incoming fields to the UsageEvent dataclass used by the AI pipeline
            usage_event = UsageEvent(
                user_id=user_id,
                app_name=app_name,
                category=category,
                duration=duration,
                timestamp=log.created_at,
            )

            thresholds = _get_user_thresholds_dict(user_id)

            try:
                # Pass focus_mode explicitly and provide thresholds as personalized overrides.
                detection = pattern_detector.process_event(
                    usage_event,
                    focus_mode="Personal",
                    personalized_thresholds=thresholds,
                )
            except Exception as e:
                # Never let AI failures break ingestion; log and continue
                logger.error("Pattern detector error for user %s: %s", user_id, e)
                detection = None

            if detection and "state" in detection:
                current_state = detection["state"]

        # Persist state as string for DB and comparisons
        state_str = (
            current_state.value if hasattr(current_state, "value") else str(current_state or "focused")
        )
        user.last_known_state = state_str

        # ----------------------------------
        # Smart Nudge Engine
        # ----------------------------------

        triggered_nudge = None

        if previous_state != current_state and AI_ENABLED and nudge_engine and detection:

            # Normalize state to string (detection["state"] may be CognitiveState enum)
            prev_str = previous_state or "focused"
            cur_str = (
                detection["state"].value
                if hasattr(detection["state"], "value")
                else str(detection["state"])
            )

            # Derive pattern from metrics (rapid_switching, entertainment_overload, or generic)
            metrics = detection.get("metrics") or {}
            switches = int(metrics.get("switches", 0))
            impulsive = int(metrics.get("impulsive_switches", 0))
            entertainment_sec = float(metrics.get("entertainment_seconds", 0))
            if switches >= 6 or impulsive >= 4:
                pattern = "rapid_switching"
            elif entertainment_sec / 60 >= 5:
                pattern = "entertainment_overload"
            else:
                pattern = "generic"

            # Severity: low, medium, high
            sev = detection.get("severity", "medium")
            severity_str = (
                sev.name.lower()
                if hasattr(sev, "name")
                else (str(sev).lower() if sev else "medium")
            )
            if severity_str not in ("low", "medium", "high"):
                severity_str = "medium"

            # Context for message templates
            context = {
                "switch_count": switches,
                "entertainment_time": int(entertainment_sec / 60),
                "score": detection.get("score", 0),
            }

            focus_mode = detection.get("focus_mode", "Personal")

            nudge_payload = nudge_engine.generate_nudge(
                user_id=user_id,
                pattern=pattern,
                severity=severity_str,
                context=context,
                previous_state=prev_str,
                current_state=cur_str,
                focus_mode=focus_mode,
            )

            if nudge_payload:

                nudge_row = Nudge(
                    user_id=user_id,
                    type=nudge_payload["type"],
                    message=nudge_payload["message"],
                    severity=nudge_payload["severity"],
                    action_label=nudge_payload.get("action_label"),
                    action_type=nudge_payload.get("action_type")
                )

                db.session.add(nudge_row)

                triggered_nudge = {
                    "type": nudge_payload["type"],
                    "message": nudge_payload["message"],
                    "severity": nudge_payload["severity"]
                }

        # ----------------------------------
        # Update Streak / Challenges (non-critical)
        # ----------------------------------

        try:
            update_streak_and_badges(user_id)

            challenge = ensure_default_challenge(user_id)

            # Keep existing semantics: progress and completion are derived
            # from daily app switches and the challenge's configured target.
            challenge.progress = daily_stats.app_switches

            if hasattr(challenge, "target") and challenge.progress >= challenge.target:
                challenge.completed = True
                # Use a generic completed_at field only if it exists
                if hasattr(challenge, "completed_at"):
                    challenge.completed_at = datetime.now(timezone.utc)
        except Exception as e:
            # Gamification failures must never break ingestion
            logger.error("Streak/challenge update error for user %s: %s", user_id, e)

        db.session.commit()

        return jsonify({
            "success": True,
            "current_state": state_str,
            "total_usage_seconds": daily_stats.total_usage_seconds,
            "nudge": triggered_nudge
        })

    except Exception as e:

        db.session.rollback()

        logger.error("Event ingestion error: %s", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# -------------------------------------------------------
# Get Nudges
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/nudges", methods=["GET"])
def get_nudges(user_id):

    since = datetime.now(timezone.utc) - timedelta(hours=24)

    nudges = Nudge.query.filter(
        Nudge.user_id == user_id,
        Nudge.dismissed == False,
        Nudge.created_at >= since
    ).order_by(Nudge.created_at.desc()).all()

    return jsonify({
        "success": True,
        "nudges": [{
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "severity": n.severity,
            "created_at": n.created_at.isoformat()
        } for n in nudges]
    })


# -------------------------------------------------------
# Dismiss Nudge
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/nudges/<int:nudge_id>/dismiss", methods=["POST"])
def dismiss_nudge(user_id, nudge_id):

    nudge = Nudge.query.filter_by(
        id=nudge_id,
        user_id=user_id
    ).first_or_404()

    nudge.dismissed = True
    nudge.dismissed_at = datetime.now(timezone.utc)

    db.session.commit()

    return jsonify({
        "success": True
    })
# -------------------------------------------------------
# Get Daily Stats
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/stats/daily", methods=["GET"])
def get_daily_stats(user_id):

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    # default to today if no date provided
    date_str = request.args.get("date")

    try:
        if date_str:
            target_date = datetime.fromisoformat(date_str).date()
        else:
            target_date = datetime.now(timezone.utc).date()
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid date format. Use YYYY-MM-DD"
        }), 400

    stats = DailyStats.query.filter_by(
        user_id=user_id,
        date=target_date
    ).first()

    # Helper to convert seconds → minutes (float)
    def _sec_to_min(value: int | None) -> float:
        return (value or 0) / 60.0

    # If no stats yet, return zeroed structure
    if not stats:
        return jsonify({
            "success": True,
            "stats": {
                "date": target_date.isoformat(),
                "total_usage_seconds": 0,
                "productivity_seconds": 0,
                "social_seconds": 0,
                "entertainment_seconds": 0,
                "other_seconds": 0,
                "app_switches": 0,
                # Backwards-compatible minute-based fields expected by the app
                "total_screen_time": 0,
                "productivity_time": 0,
                "social_time": 0,
                "entertainment_time": 0,
                "other_time": 0,
            }
        })

    return jsonify({
        "success": True,
        "stats": {
            "date": stats.date.isoformat(),
            # Raw seconds
            "total_usage_seconds": stats.total_usage_seconds or 0,
            "productivity_seconds": stats.productivity_seconds or 0,
            "social_seconds": getattr(stats, "social_seconds", 0) or 0,
            "entertainment_seconds": stats.entertainment_seconds or 0,
            "other_seconds": getattr(stats, "other_seconds", 0) or 0,
            "app_switches": stats.app_switches or 0,
            "last_event_at": stats.last_event_at.isoformat() if stats.last_event_at else None,
            # Minute-based fields expected by the existing frontend
            "total_screen_time": _sec_to_min(stats.total_usage_seconds),
            "productivity_time": _sec_to_min(stats.productivity_seconds),
            "social_time": _sec_to_min(getattr(stats, "social_seconds", 0)),
            "entertainment_time": _sec_to_min(stats.entertainment_seconds),
            "other_time": _sec_to_min(getattr(stats, "other_seconds", 0)),
        }
    })


# -------------------------------------------------------
# User Thresholds (Read-only)
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/thresholds", methods=["GET"])
def get_user_thresholds(user_id):
    """
    Return the user's threshold settings for the AI engine.
    If none exist, return sensible defaults so the frontend
    always receives a consistent JSON structure.
    """

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    thresholds = UserThreshold.query.filter_by(user_id=user_id).first()

    if not thresholds:
        payload = {
            "switch_threshold": 15,
            "entertainment_threshold": 60,
        }
    else:
        payload = {
            "switch_threshold": thresholds.switch_threshold,
            "entertainment_threshold": thresholds.entertainment_threshold,
        }

    return jsonify({
        "success": True,
        "thresholds": payload,
    })

# -------------------------------------------------------
# Update User Mode
# -------------------------------------------------------

@app.route("/api/users/<int:user_id>/mode", methods=["POST"])
def update_user_mode(user_id):

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "error": "User not found"
        }), 404

    data = request.get_json()

    if not data or "mode" not in data:
        return jsonify({
            "success": False,
            "error": "mode field required"
        }), 400

    mode = data["mode"]

    valid_modes = ["balanced", "focus", "strict", "supportive"]

    if mode not in valid_modes:
        return jsonify({
            "success": False,
            "error": "Invalid mode",
            "valid_modes": valid_modes
        }), 400

    user.mode_preference = mode

    db.session.commit()

    return jsonify({
        "success": True,
        "mode_preference": user.mode_preference
    })
# -------------------------------------------------------
# Run Server
# -------------------------------------------------------

if __name__ == "__main__":

    print("DB URI:", app.config["SQLALCHEMY_DATABASE_URI"])

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

# """
# SpikeSense Backend API Server
# Flask-based RESTful API for digital wellness tracking
# """

# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from flask_sqlalchemy import SQLAlchemy
# from datetime import datetime, timedelta
# import os
# from dotenv import load_dotenv
# import logging

# #from models import db, User, AppUsage, Nudge, UserThreshold, DailyStats
# from models import (
#     db, User, AppUsage, Nudge,
#     UserThreshold, DailyStats,
#     Streak, UserChallenge, UserBadge
# )
# from utils.validators import validate_app_usage_data

# load_dotenv()

# app = Flask(__name__)
# # Default to SQLite for development (no PostgreSQL required); set DATABASE_URL for production
# _default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spikesense_dev.sqlite')
# app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
#     'DATABASE_URL',
#     f'sqlite:///{_default_db}'
# )
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS(app, resources={r"/api/*": {"origins": "*"}})

# db.init_app(app)

# # Initialize AI components (with graceful fallback if numpy/scikit-learn unavailable)
# try:
#     from ai_module.pattern_detector import PatternDetector
#     from ai_module.nudge_engine import NudgeEngine
#     pattern_detector = PatternDetector()
#     nudge_engine = NudgeEngine()
#     AI_ENABLED = True
# except (ImportError, OSError, Exception) as e:
#     # If numpy/scikit-learn cause segfaults or import errors, disable AI features
#     pattern_detector = None
#     nudge_engine = None
#     AI_ENABLED = False

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# def update_streak_and_badges(user_id):
#     today = datetime.utcnow().date()

#     streak = Streak.query.filter_by(user_id=user_id).first()

#     if not streak:
#         streak = Streak(
#             user_id=user_id,
#             start_date=today,
#             last_active_date=today,
#             current_length=1
#         )
#         db.session.add(streak)
#     else:
#         if streak.last_active_date == today:
#             pass  # already counted today
#         elif streak.last_active_date == today - timedelta(days=1):
#             streak.current_length += 1
#             streak.last_active_date = today
#         else:
#             streak.start_date = today
#             streak.last_active_date = today
#             streak.current_length = 1

#     # Award a simple badge at 3-day streak
#     if streak.current_length == 3:
#         already = UserBadge.query.filter_by(
#             user_id=user_id,
#             badge_type="3_day_streak"
#         ).first()

#         if not already:
#             db.session.add(
#                 UserBadge(
#                     user_id=user_id,
#                     badge_type="3_day_streak"
#                 )
#             )

# def ensure_default_challenge(user_id):
#     challenge = UserChallenge.query.filter_by(
#         user_id=user_id,
#         challenge_type="daily_switch_limit",
#         completed=False
#     ).first()

#     if not challenge:
#         challenge = UserChallenge(
#             user_id=user_id,
#             challenge_type="daily_switch_limit",
#             target=15,
#             progress=0
#         )
#         db.session.add(challenge)

#     return challenge

# def _get_user_thresholds_dict(user_id):
#     """Returns thresholds for the pattern detector; sensible defaults if none."""
#     t = UserThreshold.query.filter_by(user_id=user_id).first()
#     if not t:
#         return {
#             'switch_threshold': 15,
#             'entertainment_threshold': 60,
#             'rapid_switching_window': 10,
#         }
#     return {
#         'switch_threshold': t.switch_threshold,
#         'entertainment_threshold': t.entertainment_threshold,
#         'rapid_switching_window': t.rapid_switching_window,
#     }


# if not AI_ENABLED:
#     logger.warning("AI modules not available. Running in degraded mode without ML features.")

# # Create tables on startup
# with app.app_context():
#     db.create_all()
#     logger.info("Database tables initialized")


# @app.route('/api/health', methods=['GET'])
# def health_check():
#     """Health check endpoint"""
#     return jsonify({
#         'status': 'healthy',
#         'timestamp': datetime.utcnow().isoformat(),
#         'version': '1.0.0'
#     }), 200


# @app.route('/api/users', methods=['POST'])
# def create_user():
#     """Create a new user or return existing user for this device_id (get-or-create)."""
#     try:
#         data = request.json
#         device_id = data.get('device_id')
#         if not device_id:
#             return jsonify({'success': False, 'error': 'device_id is required'}), 400

#         user = User.query.filter_by(device_id=device_id).first()
#         if user:
#             logger.info(f"Existing user: {user.id}")
#             return jsonify({
#                 'success': True,
#                 'user_id': user.id,
#                 'message': 'User already exists'
#             }), 200

#         user = User(
#             device_id=device_id,
#             name=data.get('name', 'User'),
#             email=data.get('email'),
#             mode_preference=data.get('mode_preference', 'balanced')
#         )
#         db.session.add(user)
#         db.session.commit()

#         logger.info(f"Created user: {user.id}")
#         return jsonify({
#             'success': True,
#             'user_id': user.id,
#             'message': 'User created successfully'
#         }), 201
#     except Exception as e:
#         logger.error(f"Error creating user: {str(e)}")
#         return jsonify({'success': False, 'error': str(e)}), 400


# @app.route('/api/users/<int:user_id>', methods=['GET'])
# def get_user(user_id):
#     """Get user profile"""
#     user = User.query.get_or_404(user_id)
#     return jsonify({
#         'success': True,
#         'user': {
#             'id': user.id,
#             'device_id': user.device_id,
#             'name': user.name,
#             'email': user.email,
#             'mode_preference': user.mode_preference,
#             'created_at': user.created_at.isoformat()
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/usage', methods=['POST'])
# def log_app_usage(user_id):
#     data = request.get_json()

#     if not data:
#         return jsonify({"error": "Invalid data"}), 400

#     timestamp = data.get("timestamp")

#     if isinstance(timestamp, str):
#         timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

#     usage = AppUsage(
#         user_id=user_id,
#         app_name=data["app_name"],
#         category=data["category"],
#         duration_minutes=data["duration_minutes"],
#         timestamp=timestamp
#     )

#     db.session.add(usage)
#     db.session.commit()

#     # Build recent window for detector (same structure as before)
#     recent = (
#         AppUsage.query
#         .filter_by(user_id=user_id)
#         .order_by(AppUsage.timestamp.desc())
#         .limit(50)
#         .all()
#     )

#     window = [
#         {
#             "app_name": u.app_name,
#             "category": u.category,
#             "duration_minutes": u.duration_minutes,
#             "timestamp": u.timestamp
#         }
#         for u in recent
#     ]

#     if AI_ENABLED and pattern_detector:
#         pass

#     update_streak_and_badges(user_id)
#     db.session.commit()
#     return jsonify({"success": True}), 200


# @app.route('/api/users/<int:user_id>/app-switch', methods=['POST'])
# def log_app_switch(user_id):
#     try:
#         data = request.json or {}

#         timestamp = data.get("timestamp", datetime.utcnow().isoformat())

#         if isinstance(timestamp, str):
#             timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

#         # store switch event
#         switch_row = AppUsage(
#             user_id=user_id,
#             app_name="__switch__",
#             category="other",
#             duration_minutes=0,
#             timestamp=timestamp
#         )

#         db.session.add(switch_row)
#         db.session.commit()

#         window_minutes = 60
#         since = datetime.utcnow() - timedelta(minutes=window_minutes)

#         # count ONLY switch rows
#         switch_count = AppUsage.query.filter(
#             AppUsage.user_id == user_id,
#             AppUsage.app_name == "__switch__",
#             AppUsage.timestamp >= since
#         ).count()

#         challenge = ensure_default_challenge(user_id)
#         challenge.progress = switch_count

#         if challenge.progress >= challenge.target:
#             challenge.completed = True
#             challenge.completed_at = datetime.utcnow()
            
#         user_thresholds = _get_user_thresholds_dict(user_id)

#         if AI_ENABLED and pattern_detector:
#             pattern_result = pattern_detector.detect_rapid_switching(
#                 user_id=user_id,
#                 switch_count=switch_count,
#                 time_window_minutes=window_minutes,
#                 user_thresholds=user_thresholds,
#             )
#         else:
#             pattern_result = {}

#         is_overstimulated = (
#             pattern_result.get("is_overstimulated", False)
#             or pattern_result.get("detected", False)
#         )

#         nudge = None

#         if is_overstimulated and AI_ENABLED and nudge_engine:
#             nudge = nudge_engine.generate_nudge(
#                 user_id=user_id,
#                 pattern_type="rapid_switching",
#                 severity=pattern_result.get("severity", "low"),
#                 context=pattern_result.get("context") or {},
#             )

#             if nudge:
#                 db.session.add(Nudge(
#                     user_id=user_id,
#                     type=nudge["type"],
#                     message=nudge["message"],
#                     severity=nudge["severity"],
#                     action_label=nudge.get("action_label"),
#                     action_type=nudge.get("action_type"),
#                 ))
#                 db.session.commit()

#         return jsonify({
#             "success": True,
#             "switch_count": switch_count,
#             "pattern_detected": is_overstimulated,
#             "nudge": nudge
#         }), 201

#     except Exception as e:
#         db.session.rollback()
#         logger.error(f"Error logging app switch: {str(e)}")
#         return jsonify({"success": False, "error": str(e)}), 500


# @app.route('/api/users/<int:user_id>/nudges', methods=['GET'])
# def get_pending_nudges(user_id):
#     """Get pending nudges for a user (in-app only)."""
#     since = datetime.utcnow() - timedelta(hours=24)
#     nudges = Nudge.query.filter(
#         Nudge.user_id == user_id,
#         Nudge.dismissed == False,
#         Nudge.created_at >= since,
#     ).order_by(Nudge.created_at.desc()).all()

#     return jsonify({
#         'success': True,
#         'nudges': [{
#             'id': n.id,
#             'type': n.type,
#             'message': n.message,
#             'severity': n.severity,
#             'action_label': n.action_label,
#             'action_type': n.action_type,
#             'created_at': n.created_at.isoformat(),
#         } for n in nudges]
#     }), 200


# @app.route('/api/users/<int:user_id>/nudges/<int:nudge_id>/dismiss', methods=['POST'])
# def dismiss_nudge(user_id, nudge_id):
#     """Dismiss a nudge."""
#     nudge = Nudge.query.filter_by(id=nudge_id, user_id=user_id).first_or_404()
#     nudge.dismissed = True
#     nudge.dismissed_at = datetime.utcnow()
#     db.session.commit()

#     return jsonify({'success': True, 'message': 'Nudge dismissed'}), 200


# @app.route('/api/users/<int:user_id>/stats/daily', methods=['GET'])
# def get_daily_stats(user_id):
#     """Get daily statistics for a user. Always recomputed from AppUsage so stats stay current."""
#     if User.query.get(user_id) is None:
#         return jsonify({'success': False, 'error': 'User not found'}), 404
#     date_str = request.args.get('date', datetime.utcnow().date().isoformat())
#     target_date = datetime.fromisoformat(date_str).date()

#     start_of_day = datetime.combine(target_date, datetime.min.time())
#     end_of_day = datetime.combine(target_date, datetime.max.time())

#     usage_records = AppUsage.query.filter(
#         AppUsage.user_id == user_id,
#         AppUsage.timestamp >= start_of_day,
#         AppUsage.timestamp <= end_of_day
#     ).all()

#     total_screen_time = sum(u.duration_minutes for u in usage_records)
#     app_switches = sum(1 for u in usage_records if u.app_name == "__switch__")

#     category_times = {
#         'productivity': 0,
#         'social': 0,
#         'entertainment': 0,
#         'other': 0
#     }
#     for u in usage_records:
#         category_times[u.category] += u.duration_minutes

#     # Upsert DailyStats so the row exists and focus_score can be computed
#     # Use get_or_create pattern with try-except to handle race conditions
#     daily_stats = DailyStats.query.filter_by(
#         user_id=user_id,
#         date=target_date
#     ).first()

#     if daily_stats:
#         daily_stats.total_screen_time = total_screen_time
#         daily_stats.app_switches = app_switches
#         daily_stats.productivity_time = category_times['productivity']
#         daily_stats.social_time = category_times['social']
#         daily_stats.entertainment_time = category_times['entertainment']
#         daily_stats.other_time = category_times['other']
#         db.session.commit()
#     else:
#         try:
#             daily_stats = DailyStats(
#                 user_id=user_id,
#                 date=target_date,
#                 total_screen_time=total_screen_time,
#                 app_switches=app_switches,
#                 productivity_time=category_times['productivity'],
#                 social_time=category_times['social'],
#                 entertainment_time=category_times['entertainment'],
#                 other_time=category_times['other']
#             )
#             db.session.add(daily_stats)
#             db.session.commit()
#         except Exception as e:
#             # Handle race condition: another request created the row between query and insert
#             db.session.rollback()
#             daily_stats = DailyStats.query.filter_by(
#                 user_id=user_id,
#                 date=target_date
#             ).first()
#             if daily_stats:
#                 # Update the existing row
#                 daily_stats.total_screen_time = total_screen_time
#                 daily_stats.app_switches = app_switches
#                 daily_stats.productivity_time = category_times['productivity']
#                 daily_stats.social_time = category_times['social']
#                 daily_stats.entertainment_time = category_times['entertainment']
#                 daily_stats.other_time = category_times['other']
#                 db.session.commit()
#             else:
#                 # Re-raise if it's not a unique constraint error
#                 raise

#     focus_score = daily_stats.calculate_focus_score()
#     db.session.commit()

#     return jsonify({
#         'success': True,
#         'stats': {
#             'date': daily_stats.date.isoformat(),
#             'total_screen_time': daily_stats.total_screen_time,
#             'app_switches': daily_stats.app_switches,
#             'productivity_time': daily_stats.productivity_time,
#             'social_time': daily_stats.social_time,
#             'entertainment_time': daily_stats.entertainment_time,
#             'other_time': daily_stats.other_time,
#             'focus_score': focus_score
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/thresholds', methods=['GET'])
# def get_user_thresholds(user_id):
#     """Get personalized thresholds for a user"""
#     thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
#     if not thresholds:
#         # Return default thresholds
#         return jsonify({
#             'success': True,
#             'thresholds': {
#                 'switch_threshold': 15,
#                 'entertainment_threshold': 60,
#                 'break_interval': 45,
#                 'rapid_switching_window': 10
#             }
#         }), 200
    
#     return jsonify({
#         'success': True,
#         'thresholds': {
#             'switch_threshold': thresholds.switch_threshold,
#             'entertainment_threshold': thresholds.entertainment_threshold,
#             'break_interval': thresholds.break_interval,
#             'rapid_switching_window': thresholds.rapid_switching_window,
#             'updated_at': thresholds.updated_at.isoformat()
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/thresholds', methods=['POST'])
# def update_user_thresholds(user_id):
#     """Update personalized thresholds (AI learning)"""
#     data = request.json
    
#     thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
#     if not thresholds:
#         thresholds = UserThreshold(user_id=user_id)
#         db.session.add(thresholds)
    
#     if 'switch_threshold' in data:
#         thresholds.switch_threshold = data['switch_threshold']
#     if 'entertainment_threshold' in data:
#         thresholds.entertainment_threshold = data['entertainment_threshold']
#     if 'break_interval' in data:
#         thresholds.break_interval = data['break_interval']
#     if 'rapid_switching_window' in data:
#         thresholds.rapid_switching_window = data['rapid_switching_window']
    
#     thresholds.updated_at = datetime.utcnow()
#     db.session.commit()
    
#     return jsonify({
#         'success': True,
#         'message': 'Thresholds updated',
#         'thresholds': {
#             'switch_threshold': thresholds.switch_threshold,
#             'entertainment_threshold': thresholds.entertainment_threshold,
#             'break_interval': thresholds.break_interval,
#             'rapid_switching_window': thresholds.rapid_switching_window
#         }
#     }), 200


# @app.route('/api/users/<int:user_id>/mode', methods=['POST'])
# def update_user_mode(user_id):
#     """Update user's mode preference"""
#     data = request.json
#     mode = data.get('mode')
    
#     if mode not in ['supportive', 'motivational', 'restrictive', 'balanced']:
#         return jsonify({'success': False, 'error': 'Invalid mode'}), 400
    
#     user = User.query.get_or_404(user_id)
#     user.mode_preference = mode
#     db.session.commit()
    
#     return jsonify({
#         'success': True,
#         'message': 'Mode updated',
#         'mode': mode
#     }), 200


# if __name__ == "__main__":
#     print("DB URI =", app.config["SQLALCHEMY_DATABASE_URI"])
#     app.run(host="0.0.0.0", port=5000, debug=True)

