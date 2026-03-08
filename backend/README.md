# SpikeSense Backend

Flask-based RESTful API for digital wellness tracking and pattern detection.

## Quick Start

### 1. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database URL
```

### 3. Initialize Database

```bash
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### 4. Run Server

```bash
python app.py
```

Server will start on `http://localhost:5000`

## Testing

### Quick API Test

```bash
# Make sure server is running first!
python test_api.py
```

This will test all endpoints:
- Health check
- User creation
- App usage logging
- App switch logging
- Stats retrieval
- Nudge generation
- Pattern detection

### Pattern Detection Test

```bash
python test_patterns.py
```

Tests the AI pattern detection engine:
- Rapid switching detection
- Entertainment overload
- Cognitive overload
- Normal usage (no pattern)

### Manual Testing with cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Create user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test","name":"Test User"}'
```

### Using Python Requests

See `test_api.py` for examples of testing all endpoints programmatically.

## API Endpoints

See [../docs/API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) for complete API documentation.

## Project Structure

```
backend/
├── app.py                 # Main Flask application
├── models.py              # Database models
├── requirements.txt       # Python dependencies
├── test_api.py           # API testing script
├── test_patterns.py      # Pattern detection testing
├── ai_module/            # AI/ML components
│   ├── pattern_detector.py
│   └── nudge_engine.py
└── utils/               # Utility functions
    └── validators.py
```

## Development

### Database

- **Development**: SQLite (default)
- **Production**: PostgreSQL

Update `DATABASE_URL` in `.env` to use PostgreSQL.

**Schema changes (no migrations):** This project does not use Flask-Migrate/Alembic. After changing model definitions (e.g. column types), the database must be updated manually:

- **SQLite:** Delete the database file (e.g. `spikesense_dev.sqlite`) and run `python -c "from app import app, db; app.app_context().push(); db.create_all()"` to recreate tables.
- **PostgreSQL (local dev):** Simplest is to drop all tables and let the app recreate them with the current models (e.g. after changing `user_id` to BigInteger):
  ```sql
  DROP TABLE IF EXISTS daily_stats;
  DROP TABLE IF EXISTS user_thresholds;
  DROP TABLE IF EXISTS nudges;
  DROP TABLE IF EXISTS app_usage;
  DROP TABLE IF EXISTS users;
  ```
  Then run `python -c "from app import app, db; app.app_context().push(); db.create_all()"` (or start the server; it runs `db.create_all()` on startup).

### Debug Mode

```python
# In app.py
app.run(debug=True)
```

### Logging

Logs are printed to console. In production, configure proper logging handlers.

## Testing

See [../docs/TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) for comprehensive testing guide.

## Deployment

See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for production deployment instructions.



