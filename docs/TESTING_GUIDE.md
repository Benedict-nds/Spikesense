# SpikeSense Testing Guide

Complete guide for testing all components of the SpikeSense system.

## Table of Contents

1. [Backend API Testing](#backend-api-testing)
2. [Mobile App Testing](#mobile-app-testing)
3. [Integration Testing](#integration-testing)
4. [Manual Testing Procedures](#manual-testing-procedures)
5. [Automated Testing](#automated-testing)

---

## Backend API Testing

### Prerequisites

```bash
cd backend
source venv/bin/activate
pip install pytest pytest-flask requests
```

### Method 1: Using cURL

#### Test Health Check

```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

#### Test User Creation

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test_device_123",
    "name": "Test User",
    "email": "test@example.com",
    "mode_preference": "balanced"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user_id": 1,
  "message": "User created successfully"
}
```

**Save the user_id for subsequent tests!**

#### Test App Usage Logging

```bash
# Replace USER_ID with the ID from previous response
curl -X POST http://localhost:5000/api/users/1/usage \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Instagram",
    "category": "social",
    "duration_minutes": 15.5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }'
```

#### Test App Switch Logging

```bash
curl -X POST http://localhost:5000/api/users/1/app-switch \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-15T10:30:00.000Z"
  }'
```

#### Test Get Daily Stats

```bash
curl http://localhost:5000/api/users/1/stats/daily
```

#### Test Get Pending Nudges

```bash
curl http://localhost:5000/api/users/1/nudges
```

#### Test Dismiss Nudge

```bash
# Replace NUDGE_ID with actual nudge ID
curl -X POST http://localhost:5000/api/users/1/nudges/1/dismiss
```

### Method 2: Using Python Script

Create `backend/test_api.py`:

```python
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000/api"

def test_health_check():
    """Test health check endpoint"""
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check:", response.json())
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_user_creation():
    """Test user creation"""
    data = {
        "device_id": f"test_device_{datetime.now().timestamp()}",
        "name": "Test User",
        "email": "test@example.com",
        "mode_preference": "balanced"
    }
    response = requests.post(f"{BASE_URL}/users", json=data)
    print("User Creation:", response.json())
    assert response.status_code == 201
    user_id = response.json()["user_id"]
    return user_id

def test_log_app_usage(user_id):
    """Test app usage logging"""
    data = {
        "app_name": "Instagram",
        "category": "social",
        "duration_minutes": 15.5,
        "timestamp": datetime.utcnow().isoformat()
    }
    response = requests.post(f"{BASE_URL}/users/{user_id}/usage", json=data)
    print("App Usage Log:", response.json())
    assert response.status_code == 201

def test_log_app_switch(user_id):
    """Test app switch logging"""
    data = {
        "timestamp": datetime.utcnow().isoformat()
    }
    response = requests.post(f"{BASE_URL}/users/{user_id}/app-switch", json=data)
    print("App Switch Log:", response.json())
    assert response.status_code == 201

def test_get_stats(user_id):
    """Test getting daily stats"""
    response = requests.get(f"{BASE_URL}/users/{user_id}/stats/daily")
    print("Daily Stats:", response.json())
    assert response.status_code == 200

def test_get_nudges(user_id):
    """Test getting nudges"""
    response = requests.get(f"{BASE_URL}/users/{user_id}/nudges")
    print("Nudges:", response.json())
    assert response.status_code == 200

def test_pattern_detection(user_id):
    """Test pattern detection by logging multiple rapid switches"""
    print("\n=== Testing Rapid Switching Pattern ===")
    for i in range(20):  # Log 20 switches rapidly
        data = {
            "timestamp": datetime.utcnow().isoformat()
        }
        requests.post(f"{BASE_URL}/users/{user_id}/app-switch", json=data)
    
    # Check for nudges
    response = requests.get(f"{BASE_URL}/users/{user_id}/nudges")
    nudges = response.json().get("nudges", [])
    print(f"Generated {len(nudges)} nudges")
    if nudges:
        print("Nudge:", nudges[0])

if __name__ == "__main__":
    print("Starting API Tests...\n")
    
    # Test health check
    test_health_check()
    
    # Create user
    user_id = test_user_creation()
    
    # Test app usage logging
    test_log_app_usage(user_id)
    
    # Test app switch logging
    test_log_app_switch(user_id)
    
    # Test getting stats
    test_get_stats(user_id)
    
    # Test getting nudges
    test_get_nudges(user_id)
    
    # Test pattern detection
    test_pattern_detection(user_id)
    
    print("\n✅ All tests passed!")
```

Run it:
```bash
cd backend
python test_api.py
```

### Method 3: Using Postman/Insomnia

1. **Import Collection**: Create a new collection in Postman
2. **Set Base URL**: `http://localhost:5000/api`
3. **Create Requests**:

   - **GET** `/health`
   - **POST** `/users` (Body: JSON with device_id, name, email)
   - **POST** `/users/:user_id/usage` (Body: JSON with app_name, category, duration_minutes, timestamp)
   - **POST** `/users/:user_id/app-switch` (Body: JSON with timestamp)
   - **GET** `/users/:user_id/stats/daily`
   - **GET** `/users/:user_id/nudges`
   - **POST** `/users/:user_id/nudges/:nudge_id/dismiss`

4. **Test Sequence**:
   - Create user → Save user_id
   - Log multiple app usages
   - Log app switches rapidly
   - Check for nudges
   - Get daily stats

---

## Mobile App Testing

### Prerequisites

```bash
# Start backend first
cd backend
python app.py

# In another terminal, start mobile app
cd ..
npm run dev
```

### Testing Checklist

#### 1. App Launch
- [ ] App launches without errors
- [ ] Splash screen displays
- [ ] Dashboard loads correctly
- [ ] No console errors

#### 2. Permissions
- [ ] Android: Usage Access permission request appears
- [ ] iOS: Permission guidance displays
- [ ] Permission denial handled gracefully

#### 3. Dashboard Display
- [ ] Daily stats display correctly
- [ ] Charts render properly
- [ ] Focus score shows
- [ ] App usage list displays
- [ ] Weekly trend chart visible

#### 4. Mode Selection
- [ ] Can switch between modes (Supportive, Motivational, Restrictive, Balanced)
- [ ] Mode changes persist
- [ ] UI updates based on selected mode
- [ ] Features enable/disable correctly per mode

#### 5. Nudge System
- [ ] Nudges appear when patterns detected
- [ ] Can dismiss nudges
- [ ] Nudge actions work (if implemented)
- [ ] Nudges match selected mode

#### 6. Settings/Profile
- [ ] Profile screen loads
- [ ] Can update nudge settings
- [ ] Threshold values display
- [ ] Mode selection works

#### 7. Focus Mode
- [ ] Can start focus session
- [ ] Focus session timer works
- [ ] Can end focus session
- [ ] Completion message appears

### Manual Testing Scenarios

#### Scenario 1: Rapid App Switching Detection

1. Open the app
2. Switch between apps rapidly (10+ times in 5 minutes)
3. Return to SpikeSense
4. **Expected**: Nudge appears about rapid switching

#### Scenario 2: Entertainment Overload

1. Use entertainment apps (YouTube, Instagram) for 60+ minutes
2. Open SpikeSense
3. **Expected**: Nudge about entertainment overload

#### Scenario 3: Mode Switching

1. Go to Settings
2. Switch to "Supportive" mode
3. Return to Dashboard
4. **Expected**: Only supportive features visible (insights, tips)

#### Scenario 4: Focus Session

1. Start a 25-minute focus session
2. Wait (or fast-forward time in simulator)
3. End session
4. **Expected**: Completion message appears

---

## Integration Testing

### Test Full Flow

#### Test 1: Complete Usage Tracking Flow

```bash
# 1. Start backend
cd backend
python app.py

# 2. Start mobile app
cd ..
npm run dev

# 3. In mobile app:
# - Grant permissions
# - Use phone normally for 10 minutes
# - Check dashboard for stats
# - Verify data appears in backend database
```

#### Test 2: Pattern Detection → Nudge Flow

1. **Backend**: Log 20 app switches rapidly
2. **Backend**: Check for pattern detection
3. **Backend**: Verify nudge generation
4. **Mobile**: Refresh nudges
5. **Mobile**: Verify nudge appears

#### Test 3: Offline → Online Sync

1. **Mobile**: Disable network
2. **Mobile**: Use apps (data stored locally)
3. **Mobile**: Re-enable network
4. **Mobile**: Verify data syncs to backend
5. **Backend**: Verify data received

---

## Automated Testing

### Backend Unit Tests

Create `backend/tests/` directory:

```bash
mkdir backend/tests
touch backend/tests/__init__.py
touch backend/tests/test_pattern_detector.py
touch backend/tests/test_nudge_engine.py
touch backend/tests/test_api.py
```

#### `backend/tests/test_pattern_detector.py`

```python
import pytest
from ai_module.pattern_detector import PatternDetector
from datetime import datetime, timedelta

def test_rapid_switching_detection():
    detector = PatternDetector()
    
    # Create usage data with rapid switching
    usage_data = []
    base_time = datetime.utcnow()
    for i in range(15):
        usage_data.append({
            'app_name': f'App{i}',
            'category': 'social',
            'duration_minutes': 1,
            'timestamp': (base_time + timedelta(minutes=i)).isoformat()
        })
    
    result = detector.detect_overstimulation(1, usage_data)
    assert result['is_overstimulated'] == True
    assert result['pattern_type'] == 'rapid_switching'

def test_entertainment_overload():
    detector = PatternDetector()
    
    usage_data = [{
        'app_name': 'YouTube',
        'category': 'entertainment',
        'duration_minutes': 90,
        'timestamp': datetime.utcnow().isoformat()
    }]
    
    result = detector.detect_overstimulation(1, usage_data)
    assert result['is_overstimulated'] == True
    assert result['pattern_type'] == 'entertainment_overload'

def test_no_pattern():
    detector = PatternDetector()
    
    usage_data = [{
        'app_name': 'Notion',
        'category': 'productivity',
        'duration_minutes': 30,
        'timestamp': datetime.utcnow().isoformat()
    }]
    
    result = detector.detect_overstimulation(1, usage_data)
    assert result['is_overstimulated'] == False
```

#### `backend/tests/test_api.py`

```python
import pytest
from app import app, db
from models import User

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_health_check(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'

def test_create_user(client):
    response = client.post('/api/users', json={
        'device_id': 'test123',
        'name': 'Test User'
    })
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] == True
    assert 'user_id' in data
```

Run tests:
```bash
cd backend
pytest tests/
```

### Mobile App Tests (Jest)

Create `__tests__/` directory:

```typescript
// __tests__/services/api.test.ts
import { apiService } from '../services/api';

describe('API Service', () => {
  it('should create user', async () => {
    const result = await apiService.createUser('test_device', 'Test User');
    expect(result.success).toBe(true);
  });
  
  it('should log app usage', async () => {
    const result = await apiService.logAppUsage(
      1,
      'Instagram',
      'social',
      15,
      new Date().toISOString()
    );
    expect(result.success).toBe(true);
  });
});
```

Run tests:
```bash
npm test
```

---

## Testing Pattern Detection

### Test Rapid Switching Pattern

```python
# backend/test_patterns.py
from ai_module.pattern_detector import PatternDetector
from datetime import datetime, timedelta

detector = PatternDetector()

# Simulate rapid switching
usage_data = []
base_time = datetime.utcnow()
for i in range(20):
    usage_data.append({
        'app_name': f'App{i % 5}',
        'category': 'social' if i % 2 == 0 else 'entertainment',
        'duration_minutes': 0.5,
        'timestamp': (base_time + timedelta(minutes=i*0.5)).isoformat()
    })

result = detector.detect_overstimulation(1, usage_data)
print("Pattern Detection Result:")
print(f"  Overstimulated: {result['is_overstimulated']}")
print(f"  Pattern Type: {result['pattern_type']}")
print(f"  Severity: {result['severity']}")
print(f"  Context: {result['context']}")
```

Run:
```bash
cd backend
python test_patterns.py
```

---

## Performance Testing

### Load Test Backend

```python
# backend/load_test.py
import requests
import concurrent.futures
import time

BASE_URL = "http://localhost:5000/api"

def make_request(user_id):
    data = {
        "app_name": "Test App",
        "category": "other",
        "duration_minutes": 1,
        "timestamp": "2024-01-15T10:30:00.000Z"
    }
    response = requests.post(f"{BASE_URL}/users/{user_id}/usage", json=data)
    return response.status_code

def load_test():
    user_id = 1
    num_requests = 100
    num_threads = 10
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(make_request, user_id) for _ in range(num_requests)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"Completed {num_requests} requests in {duration:.2f} seconds")
    print(f"Requests per second: {num_requests/duration:.2f}")
    print(f"Success rate: {results.count(201)/len(results)*100:.1f}%")

if __name__ == "__main__":
    load_test()
```

---

## Debugging Tips

### Backend Debugging

1. **Enable Debug Mode**:
```python
# In app.py
app.run(debug=True)
```

2. **Check Logs**:
```bash
# View Flask logs in terminal
# Or check application logs
```

3. **Database Inspection**:
```python
# Python shell
from app import app, db
from models import User, AppUsage

with app.app_context():
    users = User.query.all()
    print(f"Total users: {len(users)}")
    
    usage = AppUsage.query.all()
    print(f"Total usage records: {len(usage)}")
```

### Mobile App Debugging

1. **React Native Debugger**:
   - Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
   - Select "Debug"

2. **Console Logs**:
   - Check Metro bundler terminal
   - Use `console.log()` in code

3. **Network Inspection**:
   - Use React Native Debugger's Network tab
   - Or use `react-native-debugger`

---

## Test Data Generation

### Generate Test Usage Data

```python
# backend/generate_test_data.py
from app import app, db
from models import User, AppUsage
from datetime import datetime, timedelta
import random

with app.app_context():
    # Create test user
    user = User(device_id="test_device", name="Test User")
    db.session.add(user)
    db.session.commit()
    
    # Generate usage data
    apps = ['Instagram', 'YouTube', 'Notion', 'Slack', 'Twitter']
    categories = ['social', 'entertainment', 'productivity', 'social', 'social']
    
    base_time = datetime.utcnow() - timedelta(hours=1)
    
    for i in range(50):
        app_name = random.choice(apps)
        category = categories[apps.index(app_name)]
        
        usage = AppUsage(
            user_id=user.id,
            app_name=app_name,
            category=category,
            duration_minutes=random.uniform(1, 30),
            timestamp=base_time + timedelta(minutes=i*1.2)
        )
        db.session.add(usage)
    
    db.session.commit()
    print(f"Generated 50 usage records for user {user.id}")
```

---

## Quick Test Commands

```bash
# Test backend health
curl http://localhost:5000/api/health

# Test user creation
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test","name":"Test"}'

# Test mobile app (after starting with npm run dev)
# Open in Expo Go or simulator
```

---

For more details, see:
- [INSTALLATION.md](INSTALLATION.md) - Setup instructions
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [QUICK_START.md](QUICK_START.md) - Quick setup guide



