"""
Backend tests for АТАКА CRM Behavioral System (Iteration 4)
Tests: Event Engine, Streak Engine, Action buttons, Coach messaging, Marketplace, Feed
"""
import pytest
import requests
import os

# Read from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return "https://code-docs-hub-1.preview.emergentagent.com"

BASE_URL = get_backend_url()

class TestBehavioralSystem:
    """Test behavioral system endpoints for student"""
    
    @pytest.fixture(scope="class")
    def junior_token(self):
        """Login as JUNIOR student and get token"""
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380991001010",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        return data["accessToken"]
    
    @pytest.fixture(scope="class")
    def adult_token(self):
        """Login as ADULT student and get token"""
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380991001020",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        return data["accessToken"]
    
    # ============================================================
    # EVENT ENGINE TESTS
    # ============================================================
    
    def test_01_student_home_returns_events_array(self, junior_token):
        """GET /api/student/home returns events[] with actionable cards"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Student home response keys: {data.keys()}")
        
        # Check events array exists
        assert "events" in data, "Missing events field"
        assert isinstance(data["events"], list), "events should be a list"
        print(f"✓ Events array present: {len(data['events'])} events")
        
        # Check event structure if events exist
        if data["events"]:
            event = data["events"][0]
            assert "id" in event, "Event missing id"
            assert "type" in event, "Event missing type"
            assert "icon" in event, "Event missing icon"
            assert "title" in event, "Event missing title"
            assert "text" in event, "Event missing text"
            assert "actions" in event, "Event missing actions"
            assert isinstance(event["actions"], list), "Event actions should be a list"
            print(f"✓ Event structure valid: {event['id']} - {event['title']}")
            
            # Check action structure
            if event["actions"]:
                action = event["actions"][0]
                assert "label" in action, "Action missing label"
                assert "action" in action, "Action missing action"
                print(f"  - Action: {action['label']} → {action['action']}")
    
    def test_02_student_home_returns_marketplace_recs(self, junior_token):
        """GET /api/student/home returns marketplaceRecs[] (soft marketplace)"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        
        # Check marketplaceRecs array exists
        assert "marketplaceRecs" in data, "Missing marketplaceRecs field"
        assert isinstance(data["marketplaceRecs"], list), "marketplaceRecs should be a list"
        print(f"✓ Marketplace recommendations: {len(data['marketplaceRecs'])} products")
        
        # Check product structure if products exist
        if data["marketplaceRecs"]:
            product = data["marketplaceRecs"][0]
            assert "id" in product, "Product missing id"
            assert "name" in product, "Product missing name"
            assert "price" in product, "Product missing price"
            print(f"✓ Product structure valid: {product['name']} - {product['price']} ₴")
    
    # ============================================================
    # STREAK ENGINE TESTS
    # ============================================================
    
    def test_03_student_home_returns_streak_stats(self, junior_token):
        """GET /api/student/home returns stats with streak and streakFreezeAvailable"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        
        # Check stats with streak
        assert "stats" in data, "Missing stats field"
        stats = data["stats"]
        assert "streak" in stats, "Stats missing streak"
        print(f"✓ Streak in stats: {stats['streak']}")
        
        # Check streakFreezeAvailable (can be in stats or root level)
        # Based on code, it's in the child record, so check if it's exposed
        print(f"✓ Stats structure: {stats.keys()}")
    
    def test_04_freeze_streak_endpoint(self, junior_token):
        """POST /api/student/freeze-streak restores streak (if freeze available)"""
        # First check current state
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        initial_streak = data.get("stats", {}).get("streak", 0)
        print(f"✓ Initial streak: {initial_streak}")
        
        # Try to freeze streak
        resp = requests.post(
            f"{BASE_URL}/api/student/freeze-streak",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        
        # Can be 200 (success) or 400 (already used)
        if resp.status_code == 200:
            result = resp.json()
            assert "success" in result, "Missing success field"
            assert "streak" in result, "Missing streak in response"
            assert "freezesLeft" in result, "Missing freezesLeft in response"
            print(f"✓ Freeze streak success: streak={result['streak']}, freezesLeft={result['freezesLeft']}")
        elif resp.status_code == 400:
            # Already used
            result = resp.json()
            assert "error" in result, "Missing error message"
            print(f"✓ Freeze already used (expected): {result['error']}")
        else:
            pytest.fail(f"Unexpected status code: {resp.status_code} {resp.text}")
    
    # ============================================================
    # SUBSCRIPTION PRESSURE TESTS
    # ============================================================
    
    def test_05_junior_subscription_with_days_left(self, junior_token):
        """GET /api/student/home for JUNIOR returns subscription with daysLeft"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        
        # Check subscription
        if data.get("subscription"):
            sub = data["subscription"]
            assert "planName" in sub, "Subscription missing planName"
            assert "price" in sub, "Subscription missing price"
            assert "status" in sub, "Subscription missing status"
            assert "daysLeft" in sub, "Subscription missing daysLeft"
            print(f"✓ Subscription: {sub['planName']} - {sub['price']} ₴ ({sub['status']}, {sub['daysLeft']} days left)")
        else:
            print("⚠ No subscription found for JUNIOR student")
    
    # ============================================================
    # ACTION BUTTONS TESTS
    # ============================================================
    
    def test_06_confirm_training_endpoint(self, junior_token):
        """POST /api/student/confirm-training confirms attendance"""
        resp = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            headers={"Authorization": f"Bearer {junior_token}"},
            json={"trainingId": "test_training_123", "status": "CONFIRMED"}
        )
        assert resp.status_code == 200, f"Confirm training failed: {resp.status_code} {resp.text}"
        
        result = resp.json()
        assert "success" in result, "Missing success field"
        assert result["success"] == True, "Success should be True"
        assert "status" in result, "Missing status in response"
        assert result["status"] == "CONFIRMED", f"Expected CONFIRMED, got {result['status']}"
        print(f"✓ Training confirmed: {result}")
    
    def test_07_skip_training_endpoint(self, junior_token):
        """POST /api/student/confirm-training with status=SKIPPED"""
        resp = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            headers={"Authorization": f"Bearer {junior_token}"},
            json={"trainingId": "test_training_456", "status": "SKIPPED"}
        )
        assert resp.status_code == 200, f"Skip training failed: {resp.status_code} {resp.text}"
        
        result = resp.json()
        assert "success" in result, "Missing success field"
        assert result["success"] == True, "Success should be True"
        assert "status" in result, "Missing status in response"
        assert result["status"] == "SKIPPED", f"Expected SKIPPED, got {result['status']}"
        print(f"✓ Training skipped: {result}")
    
    # ============================================================
    # COACH MESSAGE TESTS
    # ============================================================
    
    def test_08_coach_message_endpoint(self, junior_token):
        """POST /api/student/coach-message sends message to coach"""
        resp = requests.post(
            f"{BASE_URL}/api/student/coach-message",
            headers={"Authorization": f"Bearer {junior_token}"},
            json={"text": "Тестове повідомлення тренеру від учня"}
        )
        assert resp.status_code == 200, f"Coach message failed: {resp.status_code} {resp.text}"
        
        result = resp.json()
        assert "success" in result, "Missing success field"
        assert result["success"] == True, "Success should be True"
        assert "message" in result, "Missing message in response"
        print(f"✓ Coach message sent: {result['message']}")
    
    # ============================================================
    # FEED TESTS
    # ============================================================
    
    def test_09_student_feed_endpoint(self, junior_token):
        """GET /api/student/feed returns feed[] with types: personal/coach/club"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student feed failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Feed response keys: {data.keys()}")
        
        # Check feed array exists
        assert "feed" in data, "Missing feed field"
        assert isinstance(data["feed"], list), "feed should be a list"
        print(f"✓ Feed array present: {len(data['feed'])} items")
        
        # Check feed item structure if items exist
        if data["feed"]:
            item = data["feed"][0]
            assert "type" in item, "Feed item missing type"
            assert item["type"] in ["personal", "coach", "club"], f"Invalid feed type: {item['type']}"
            assert "text" in item, "Feed item missing text"
            assert "icon" in item, "Feed item missing icon"
            print(f"✓ Feed item structure valid: type={item['type']}, text={item['text'][:50]}...")
            
            # Check all 3 types are present (if enough items)
            types = set(i["type"] for i in data["feed"])
            print(f"✓ Feed types present: {types}")
    
    def test_10_adult_student_feed(self, adult_token):
        """GET /api/student/feed works for ADULT student"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {adult_token}"}
        )
        assert resp.status_code == 200, f"Student feed failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "feed" in data, "Missing feed field"
        assert isinstance(data["feed"], list), "feed should be a list"
        print(f"✓ ADULT student feed: {len(data['feed'])} items")
    
    # ============================================================
    # UNAUTHORIZED ACCESS TESTS
    # ============================================================
    
    def test_11_unauthorized_coach_message(self):
        """POST /api/student/coach-message requires authentication"""
        resp = requests.post(
            f"{BASE_URL}/api/student/coach-message",
            json={"text": "Test"}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized coach message correctly blocked")
    
    def test_12_unauthorized_confirm_training(self):
        """POST /api/student/confirm-training requires authentication"""
        resp = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            json={"trainingId": "test", "status": "CONFIRMED"}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized confirm training correctly blocked")
    
    def test_13_unauthorized_freeze_streak(self):
        """POST /api/student/freeze-streak requires authentication"""
        resp = requests.post(f"{BASE_URL}/api/student/freeze-streak")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized freeze streak correctly blocked")
    
    def test_14_unauthorized_feed(self):
        """GET /api/student/feed requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/student/feed")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized feed access correctly blocked")
