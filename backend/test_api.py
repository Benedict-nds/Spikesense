"""
Quick API Testing Script
Run this to test all backend endpoints
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000/api"

def print_response(title, response):
    """Pretty print API response"""
    print(f"\n{'='*50}")
    print(f"{title}")
    print(f"{'='*50}")
    print(f"Status: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

def test_health_check():
    """Test health check endpoint"""
    print("\n🔍 Testing Health Check...")
    response = requests.get(f"{BASE_URL}/health")
    print_response("Health Check", response)
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("✅ Health check passed!")

def test_user_creation():
    """Test user creation"""
    print("\n👤 Testing User Creation...")
    data = {
        "device_id": f"test_device_{datetime.now().timestamp()}",
        "name": "Test User",
        "email": "test@example.com",
        "mode_preference": "balanced"
    }
    response = requests.post(f"{BASE_URL}/users", json=data)
    print_response("User Creation", response)
    assert response.status_code == 201
    user_id = response.json()["user_id"]
    print(f"✅ User created with ID: {user_id}")
    return user_id

def test_log_app_usage(user_id):
    """Test app usage logging"""
    print("\n📱 Testing App Usage Logging...")
    data = {
        "app_name": "Instagram",
        "category": "social",
        "duration_minutes": 15.5,
        "timestamp": datetime.utcnow().isoformat()
    }
    response = requests.post(f"{BASE_URL}/users/{user_id}/usage", json=data)
    print_response("App Usage Log", response)
    assert response.status_code == 201
    print("✅ App usage logged!")

def test_log_app_switch(user_id):
    """Test app switch logging"""
    print("\n🔄 Testing App Switch Logging...")
    data = {
        "timestamp": datetime.utcnow().isoformat()
    }
    response = requests.post(f"{BASE_URL}/users/{user_id}/app-switch", json=data)
    print_response("App Switch Log", response)
    assert response.status_code == 201
    print("✅ App switch logged!")

def test_get_stats(user_id):
    """Test getting daily stats"""
    print("\n📊 Testing Daily Stats...")
    response = requests.get(f"{BASE_URL}/users/{user_id}/stats/daily")
    print_response("Daily Stats", response)
    assert response.status_code == 200
    print("✅ Stats retrieved!")

def test_get_nudges(user_id):
    """Test getting nudges"""
    print("\n💡 Testing Nudges...")
    response = requests.get(f"{BASE_URL}/users/{user_id}/nudges")
    print_response("Nudges", response)
    assert response.status_code == 200
    nudges = response.json().get("nudges", [])
    print(f"✅ Found {len(nudges)} nudges!")

def test_get_thresholds(user_id):
    """Test getting thresholds"""
    print("\n⚙️ Testing User Thresholds...")
    response = requests.get(f"{BASE_URL}/users/{user_id}/thresholds")
    print_response("User Thresholds", response)
    assert response.status_code == 200
    print("✅ Thresholds retrieved!")

def test_update_mode(user_id):
    """Test updating user mode"""
    print("\n🎯 Testing Mode Update...")
    data = {"mode": "supportive"}
    response = requests.post(f"{BASE_URL}/users/{user_id}/mode", json=data)
    print_response("Mode Update", response)
    assert response.status_code == 200
    print("✅ Mode updated!")

def test_pattern_detection(user_id):
    """Test pattern detection by logging multiple rapid switches"""
    print("\n🧠 Testing Pattern Detection (Rapid Switching)...")
    print("Logging 20 rapid app switches...")
    
    for i in range(20):
        data = {
            "timestamp": datetime.utcnow().isoformat()
        }
        requests.post(f"{BASE_URL}/users/{user_id}/app-switch", json=data)
        if (i + 1) % 5 == 0:
            print(f"  Logged {i + 1} switches...")
    
    # Wait a moment for processing
    import time
    time.sleep(1)
    
    # Check for nudges
    response = requests.get(f"{BASE_URL}/users/{user_id}/nudges")
    nudges = response.json().get("nudges", [])
    print(f"\n✅ Generated {len(nudges)} nudges from rapid switching")
    if nudges:
        print(f"   First nudge: {nudges[0]['message'][:50]}...")

def test_entertainment_overload(user_id):
    """Test entertainment overload pattern"""
    print("\n🎮 Testing Entertainment Overload Pattern...")
    
    # Log entertainment app usage
    for i in range(5):
        data = {
            "app_name": "YouTube",
            "category": "entertainment",
            "duration_minutes": 15,
            "timestamp": datetime.utcnow().isoformat()
        }
        requests.post(f"{BASE_URL}/users/{user_id}/usage", json=data)
    
    # Check for nudges
    import time
    time.sleep(1)
    
    response = requests.get(f"{BASE_URL}/users/{user_id}/nudges")
    nudges = response.json().get("nudges", [])
    print(f"✅ Generated {len(nudges)} nudges from entertainment overload")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 SpikeSense API Testing Suite")
    print("="*60)
    print("\nMake sure the backend is running on http://localhost:5000")
    print("Press Enter to start tests...")
    input()
    
    try:
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
        
        # Test getting thresholds
        test_get_thresholds(user_id)
        
        # Test updating mode
        test_update_mode(user_id)
        
        # Test getting nudges
        test_get_nudges(user_id)
        
        # Test pattern detection
        test_pattern_detection(user_id)
        
        # Test entertainment overload
        test_entertainment_overload(user_id)
        
        print("\n" + "="*60)
        print("✅ All tests completed successfully!")
        print("="*60)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to backend!")
        print("   Make sure the backend is running:")
        print("   cd backend && python app.py")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()



