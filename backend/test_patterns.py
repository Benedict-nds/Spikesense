"""
Pattern Detection Testing Script
Test the AI pattern detection engine
"""

from ai_module.pattern_detector import PatternDetector
from datetime import datetime, timedelta

def test_rapid_switching():
    """Test rapid switching pattern detection"""
    print("\n" + "="*60)
    print("Test 1: Rapid Switching Pattern")
    print("="*60)
    
    detector = PatternDetector()
    
    # Simulate rapid switching (20 switches in 30 minutes)
    usage_data = []
    base_time = datetime.utcnow() - timedelta(minutes=30)
    
    for i in range(20):
        usage_data.append({
            'app_name': f'App{i % 5}',
            'category': 'social' if i % 2 == 0 else 'entertainment',
            'duration_minutes': 0.5,
            'timestamp': (base_time + timedelta(minutes=i*1.5)).isoformat()
        })
    
    result = detector.detect_overstimulation(1, usage_data)
    
    print(f"Usage Records: {len(usage_data)}")
    print(f"Overstimulated: {result['is_overstimulated']}")
    print(f"Pattern Type: {result['pattern_type']}")
    print(f"Severity: {result['severity']}")
    print(f"Context: {result['context']}")
    
    assert result['is_overstimulated'] == True
    assert result['pattern_type'] in ['rapid_switching', 'cognitive_overload']
    print("✅ Rapid switching pattern detected correctly!")

def test_entertainment_overload():
    """Test entertainment overload pattern"""
    print("\n" + "="*60)
    print("Test 2: Entertainment Overload Pattern")
    print("="*60)
    
    detector = PatternDetector()
    
    # Simulate 90 minutes of entertainment
    usage_data = [
        {
            'app_name': 'YouTube',
            'category': 'entertainment',
            'duration_minutes': 45,
            'timestamp': (datetime.utcnow() - timedelta(minutes=90)).isoformat()
        },
        {
            'app_name': 'Netflix',
            'category': 'entertainment',
            'duration_minutes': 45,
            'timestamp': (datetime.utcnow() - timedelta(minutes=45)).isoformat()
        }
    ]
    
    result = detector.detect_overstimulation(1, usage_data)
    
    print(f"Entertainment Time: 90 minutes")
    print(f"Overstimulated: {result['is_overstimulated']}")
    print(f"Pattern Type: {result['pattern_type']}")
    print(f"Severity: {result['severity']}")
    
    assert result['is_overstimulated'] == True
    assert result['pattern_type'] == 'entertainment_overload'
    print("✅ Entertainment overload pattern detected correctly!")

def test_cognitive_overload():
    """Test cognitive overload pattern"""
    print("\n" + "="*60)
    print("Test 3: Cognitive Overload Pattern")
    print("="*60)
    
    detector = PatternDetector()
    
    # High switching + high entertainment ratio
    usage_data = []
    base_time = datetime.utcnow() - timedelta(hours=1)
    
    for i in range(18):  # 18 switches
        usage_data.append({
            'app_name': 'Instagram' if i % 2 == 0 else 'YouTube',
            'category': 'entertainment',
            'duration_minutes': 3,
            'timestamp': (base_time + timedelta(minutes=i*3)).isoformat()
        })
    
    result = detector.detect_overstimulation(1, usage_data)
    
    print(f"Switches: {len(usage_data)}")
    print(f"Entertainment Ratio: High")
    print(f"Overstimulated: {result['is_overstimulated']}")
    print(f"Pattern Type: {result['pattern_type']}")
    print(f"Severity: {result['severity']}")
    
    assert result['is_overstimulated'] == True
    assert result['pattern_type'] == 'cognitive_overload'
    print("✅ Cognitive overload pattern detected correctly!")

def test_no_pattern():
    """Test normal usage (no pattern)"""
    print("\n" + "="*60)
    print("Test 4: Normal Usage (No Pattern)")
    print("="*60)
    
    detector = PatternDetector()
    
    # Normal productive usage
    usage_data = [
        {
            'app_name': 'Notion',
            'category': 'productivity',
            'duration_minutes': 60,
            'timestamp': (datetime.utcnow() - timedelta(hours=1)).isoformat()
        }
    ]
    
    result = detector.detect_overstimulation(1, usage_data)
    
    print(f"Usage: 60 minutes of productivity")
    print(f"Overstimulated: {result['is_overstimulated']}")
    print(f"Pattern Type: {result['pattern_type']}")
    
    assert result['is_overstimulated'] == False
    print("✅ No pattern detected for normal usage!")

def test_rapid_switching_detection():
    """Test rapid switching detection method"""
    print("\n" + "="*60)
    print("Test 5: Rapid Switching Detection Method")
    print("="*60)
    
    detector = PatternDetector()
    
    # Test with 20 switches in 1 hour
    result = detector.detect_rapid_switching(
        user_id=1,
        switch_count=20,
        time_window_minutes=60
    )
    
    print(f"Switches: 20 in 60 minutes")
    print(f"Overstimulated: {result['is_overstimulated']}")
    print(f"Severity: {result['severity']}")
    print(f"Context: {result['context']}")
    
    assert result['is_overstimulated'] == True
    print("✅ Rapid switching detected correctly!")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🧠 SpikeSense Pattern Detection Testing")
    print("="*60)
    
    try:
        test_rapid_switching()
        test_entertainment_overload()
        test_cognitive_overload()
        test_no_pattern()
        test_rapid_switching_detection()
        
        print("\n" + "="*60)
        print("✅ All pattern detection tests passed!")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()



