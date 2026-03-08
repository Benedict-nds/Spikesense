#!/usr/bin/env python3
"""
Clear all data from the SpikeSense database so you can start fresh.
Uses the same DATABASE_URL / SQLite path as app.py.

Run from the backend directory with your venv activated:
  source env311/bin/activate   # or: venv\Scripts\activate on Windows
  python clear_db.py

If you use SQLite only, you can instead delete the database file for a full reset:
  rm -f spikesense_dev.sqlite
  (Tables will be recreated on next "python app.py".)
"""
import os
import sys

# Run from backend directory so app can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, AppUsage, Nudge, UserThreshold, DailyStats, User


def clear_all():
    with app.app_context():
        # Delete in order of foreign keys (children first)
        deleted = {}
        deleted['app_usage'] = AppUsage.query.delete()
        deleted['nudges'] = Nudge.query.delete()
        deleted['user_thresholds'] = UserThreshold.query.delete()
        deleted['daily_stats'] = DailyStats.query.delete()
        deleted['users'] = User.query.delete()
        db.session.commit()
        print("Database cleared. Rows deleted:")
        for table, count in deleted.items():
            print(f"  {table}: {count}")
        print("You can start afresh. Restart the backend (python app.py) if it was running.")


if __name__ == '__main__':
    clear_all()
