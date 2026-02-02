"""
SpikeSense Backend API Server
Flask-based RESTful API for digital wellness tracking
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import logging

from models import db, User, AppUsage, Nudge, UserThreshold, DailyStats
from utils.validators import validate_app_usage_data

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 
    'postgresql://spikesense:spikesense@localhost/spikesense_db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

CORS(app, resources={r"/api/*": {"origins": "*"}})

db.init_app(app)

# Initialize AI components (with graceful fallback if numpy/scikit-learn unavailable)
try:
    from ai_module.pattern_detector import PatternDetector
    from ai_module.nudge_engine import NudgeEngine
    pattern_detector = PatternDetector()
    nudge_engine = NudgeEngine()
    AI_ENABLED = True
except (ImportError, OSError, Exception) as e:
    # If numpy/scikit-learn cause segfaults or import errors, disable AI features
    pattern_detector = None
    nudge_engine = None
    AI_ENABLED = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not AI_ENABLED:
    logger.warning("AI modules not available. Running in degraded mode without ML features.")

# Create tables on startup
with app.app_context():
    db.create_all()
    logger.info("Database tables initialized")


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    }), 200


@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.json
        user = User(
            device_id=data.get('device_id'),
            name=data.get('name', 'User'),
            email=data.get('email'),
            mode_preference=data.get('mode_preference', 'balanced')
        )
        db.session.add(user)
        db.session.commit()
        
        logger.info(f"Created user: {user.id}")
        return jsonify({
            'success': True,
            'user_id': user.id,
            'message': 'User created successfully'
        }), 201
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get user profile"""
    user = User.query.get_or_404(user_id)
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'device_id': user.device_id,
            'name': user.name,
            'email': user.email,
            'mode_preference': user.mode_preference,
            'created_at': user.created_at.isoformat()
        }
    }), 200


@app.route('/api/users/<int:user_id>/usage', methods=['POST'])
def log_app_usage(user_id):
    """Log app usage data from mobile app"""
    try:
        data = request.json
        
        # Validate input
        validation_error = validate_app_usage_data(data)
        if validation_error:
            return jsonify({'success': False, 'error': validation_error}), 400
        
        # Create app usage record
        app_usage = AppUsage(
            user_id=user_id,
            app_name=data['app_name'],
            category=data['category'],
            duration_minutes=data['duration_minutes'],
            timestamp=datetime.fromisoformat(data['timestamp'])
        )
        db.session.add(app_usage)
        
        # Get recent usage for pattern detection
        recent_usage = AppUsage.query.filter(
            AppUsage.user_id == user_id,
            AppUsage.timestamp >= datetime.utcnow() - timedelta(hours=1)
        ).all()
        
        # Detect overstimulation patterns
        usage_data = [{
            'app_name': u.app_name,
            'category': u.category,
            'duration_minutes': u.duration_minutes,
            'timestamp': u.timestamp.isoformat()
        } for u in recent_usage]
        
        # Detect patterns if AI is enabled
        if AI_ENABLED and pattern_detector:
            pattern_result = pattern_detector.detect_overstimulation(
                user_id=user_id,
                usage_data=usage_data
            )
        else:
            pattern_result = {
                'is_overstimulated': False,
                'pattern_type': None,
                'severity': 'low',
                'context': {}
            }
        
        # Generate nudge if needed
        nudge = None
        if pattern_result['is_overstimulated'] and AI_ENABLED and nudge_engine:
            nudge = nudge_engine.generate_nudge(
                user_id=user_id,
                pattern_type=pattern_result['pattern_type'],
                severity=pattern_result['severity'],
                context=pattern_result['context']
            )
            
            if nudge:
                nudge_record = Nudge(
                    user_id=user_id,
                    type=nudge['type'],
                    message=nudge['message'],
                    severity=nudge['severity'],
                    action_label=nudge.get('action_label'),
                    action_type=nudge.get('action_type')
                )
                db.session.add(nudge_record)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'pattern_detected': pattern_result['is_overstimulated'],
            'pattern_type': pattern_result.get('pattern_type'),
            'nudge': nudge
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error logging app usage: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/app-switch', methods=['POST'])
def log_app_switch(user_id):
    """Log an app switch event"""
    try:
        data = request.json
        timestamp = datetime.fromisoformat(data.get('timestamp', datetime.utcnow().isoformat()))
        
        # Get app switches in the last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_switches = AppUsage.query.filter(
            AppUsage.user_id == user_id,
            AppUsage.timestamp >= one_hour_ago
        ).count()
        
        # Detect rapid switching pattern
        if AI_ENABLED and pattern_detector:
            pattern_result = pattern_detector.detect_rapid_switching(
                user_id=user_id,
                switch_count=recent_switches + 1,
                time_window_minutes=60
            )
        else:
            pattern_result = {
                'is_overstimulated': False,
                'severity': 'low',
                'context': {}
            }
        
        # Generate nudge if needed
        nudge = None
        if pattern_result['is_overstimulated'] and AI_ENABLED and nudge_engine:
            nudge = nudge_engine.generate_nudge(
                user_id=user_id,
                pattern_type='rapid_switching',
                severity=pattern_result['severity'],
                context={'switch_count': recent_switches + 1}
            )
            
            if nudge:
                nudge_record = Nudge(
                    user_id=user_id,
                    type=nudge['type'],
                    message=nudge['message'],
                    severity=nudge['severity'],
                    action_label=nudge.get('action_label'),
                    action_type=nudge.get('action_type')
                )
                db.session.add(nudge_record)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'switch_count': recent_switches + 1,
            'pattern_detected': pattern_result['is_overstimulated'],
            'nudge': nudge
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error logging app switch: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/nudges', methods=['GET'])
def get_pending_nudges(user_id):
    """Get pending nudges for a user"""
    nudges = Nudge.query.filter(
        Nudge.user_id == user_id,
        Nudge.dismissed == False,
        Nudge.created_at >= datetime.utcnow() - timedelta(hours=24)
    ).order_by(Nudge.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'nudges': [{
            'id': n.id,
            'type': n.type,
            'message': n.message,
            'severity': n.severity,
            'action_label': n.action_label,
            'action_type': n.action_type,
            'created_at': n.created_at.isoformat()
        } for n in nudges]
    }), 200


@app.route('/api/users/<int:user_id>/nudges/<int:nudge_id>/dismiss', methods=['POST'])
def dismiss_nudge(user_id, nudge_id):
    """Dismiss a nudge"""
    nudge = Nudge.query.filter_by(id=nudge_id, user_id=user_id).first_or_404()
    nudge.dismissed = True
    nudge.dismissed_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Nudge dismissed'}), 200


@app.route('/api/users/<int:user_id>/stats/daily', methods=['GET'])
def get_daily_stats(user_id):
    """Get daily statistics for a user"""
    date_str = request.args.get('date', datetime.utcnow().date().isoformat())
    target_date = datetime.fromisoformat(date_str).date()
    
    # Get or create daily stats
    daily_stats = DailyStats.query.filter_by(
        user_id=user_id,
        date=target_date
    ).first()
    
    if not daily_stats:
        # Calculate from app usage records
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())
        
        usage_records = AppUsage.query.filter(
            AppUsage.user_id == user_id,
            AppUsage.timestamp >= start_of_day,
            AppUsage.timestamp <= end_of_day
        ).all()
        
        total_screen_time = sum(u.duration_minutes for u in usage_records)
        app_switches = len(usage_records)
        
        category_times = {
            'productivity': 0,
            'social': 0,
            'entertainment': 0,
            'other': 0
        }
        
        for u in usage_records:
            category_times[u.category] += u.duration_minutes
        
        daily_stats = DailyStats(
            user_id=user_id,
            date=target_date,
            total_screen_time=total_screen_time,
            app_switches=app_switches,
            productivity_time=category_times['productivity'],
            social_time=category_times['social'],
            entertainment_time=category_times['entertainment'],
            other_time=category_times['other']
        )
        db.session.add(daily_stats)
        db.session.commit()
    
    return jsonify({
        'success': True,
        'stats': {
            'date': daily_stats.date.isoformat(),
            'total_screen_time': daily_stats.total_screen_time,
            'app_switches': daily_stats.app_switches,
            'productivity_time': daily_stats.productivity_time,
            'social_time': daily_stats.social_time,
            'entertainment_time': daily_stats.entertainment_time,
            'other_time': daily_stats.other_time,
            'focus_score': daily_stats.calculate_focus_score()
        }
    }), 200


@app.route('/api/users/<int:user_id>/thresholds', methods=['GET'])
def get_user_thresholds(user_id):
    """Get personalized thresholds for a user"""
    thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
    if not thresholds:
        # Return default thresholds
        return jsonify({
            'success': True,
            'thresholds': {
                'switch_threshold': 15,
                'entertainment_threshold': 60,
                'break_interval': 45,
                'rapid_switching_window': 10
            }
        }), 200
    
    return jsonify({
        'success': True,
        'thresholds': {
            'switch_threshold': thresholds.switch_threshold,
            'entertainment_threshold': thresholds.entertainment_threshold,
            'break_interval': thresholds.break_interval,
            'rapid_switching_window': thresholds.rapid_switching_window,
            'updated_at': thresholds.updated_at.isoformat()
        }
    }), 200


@app.route('/api/users/<int:user_id>/thresholds', methods=['POST'])
def update_user_thresholds(user_id):
    """Update personalized thresholds (AI learning)"""
    data = request.json
    
    thresholds = UserThreshold.query.filter_by(user_id=user_id).first()
    
    if not thresholds:
        thresholds = UserThreshold(user_id=user_id)
        db.session.add(thresholds)
    
    if 'switch_threshold' in data:
        thresholds.switch_threshold = data['switch_threshold']
    if 'entertainment_threshold' in data:
        thresholds.entertainment_threshold = data['entertainment_threshold']
    if 'break_interval' in data:
        thresholds.break_interval = data['break_interval']
    if 'rapid_switching_window' in data:
        thresholds.rapid_switching_window = data['rapid_switching_window']
    
    thresholds.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Thresholds updated',
        'thresholds': {
            'switch_threshold': thresholds.switch_threshold,
            'entertainment_threshold': thresholds.entertainment_threshold,
            'break_interval': thresholds.break_interval,
            'rapid_switching_window': thresholds.rapid_switching_window
        }
    }), 200


@app.route('/api/users/<int:user_id>/mode', methods=['POST'])
def update_user_mode(user_id):
    """Update user's mode preference"""
    data = request.json
    mode = data.get('mode')
    
    if mode not in ['supportive', 'motivational', 'restrictive', 'balanced']:
        return jsonify({'success': False, 'error': 'Invalid mode'}), 400
    
    user = User.query.get_or_404(user_id)
    user.mode_preference = mode
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Mode updated',
        'mode': mode
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)

