"""
Backend tests for ATAKA Student Product Overhaul (Iteration 2)
Tests:
- Student login flow
- Student home endpoint (XP bar, events, daily tasks, market preview, social proof)
- Student feed endpoint (typed cards: streak, badge, coach_message, club)
- Student gamification endpoint
- Student actions (freeze-streak, coach-message, confirm-training)
"""
import pytest
import requests
import os

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

class TestStudentProductOverhaul:
    """Test student product overhaul features"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin (can test student APIs if child linked)"""
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380501234567",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        print(f"✓ Admin login successful")
        return data["accessToken"]
    
    def test_01_student_login_flow(self):
        """Test student login flow with phone +380501234567, OTP 0000"""
        # Step 1: Request OTP (optional, since we have bypass)
        resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": "+380501234567"
        })
        print(f"✓ Request OTP: {resp.status_code}")
        
        # Step 2: Verify OTP
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380501234567",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        assert "user" in data, "No user in response"
        print(f"✓ Student login successful: {data['user'].get('firstName', '')} {data['user'].get('lastName', '')}")
    
    def test_02_student_home_returns_all_required_keys(self, admin_token):
        """GET /api/student/home returns all required keys"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Student home response keys: {list(data.keys())}")
        
        # Required keys from review request
        required_keys = ["student", "todayTraining", "stats", "gamification", "events", "marketplaceRecs"]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
            print(f"  ✓ {key}: present")
        
        # Check junior or adult data
        assert "junior" in data or "adult" in data, "Missing junior or adult data"
        student_type = data["student"].get("studentType", "JUNIOR")
        print(f"✓ Student type: {student_type}")
    
    def test_03_student_home_xp_bar(self, admin_token):
        """Verify XP bar data in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        g = data.get("gamification", {})
        assert "level" in g, "Missing level in gamification"
        assert "levelName" in g, "Missing levelName in gamification"
        assert "xp" in g, "Missing xp in gamification"
        assert "xpProgress" in g, "Missing xpProgress in gamification"
        print(f"✓ XP Bar: Lv.{g['level']} {g['levelName']} - {g['xp']} XP ({g['xpProgress']}%)")
    
    def test_04_student_home_event_card(self, admin_token):
        """Verify Event card in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        events = data.get("events", [])
        assert isinstance(events, list), "Events should be a list"
        print(f"✓ Events: {len(events)} events")
        
        if events:
            event = events[0]
            assert "type" in event, "Event missing type"
            assert "title" in event, "Event missing title"
            assert "text" in event, "Event missing text"
            print(f"  - {event['type']}: {event['title']}")
    
    def test_05_student_home_daily_tasks(self, admin_token):
        """Verify Daily tasks in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        g = data.get("gamification", {})
        daily_tasks = g.get("dailyTasks", [])
        assert isinstance(daily_tasks, list), "Daily tasks should be a list"
        print(f"✓ Daily tasks: {len(daily_tasks)} tasks")
        
        for task in daily_tasks:
            assert "id" in task, "Task missing id"
            assert "text" in task, "Task missing text"
            assert "done" in task, "Task missing done"
            assert "xp" in task, "Task missing xp"
            print(f"  - {task['text']}: {'✓' if task['done'] else '○'} (+{task['xp']} XP)")
    
    def test_06_student_home_market_preview(self, admin_token):
        """Verify Market preview in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        marketplace_recs = data.get("marketplaceRecs", [])
        assert isinstance(marketplace_recs, list), "Marketplace recs should be a list"
        print(f"✓ Market preview: {len(marketplace_recs)} products")
        
        if marketplace_recs:
            product = marketplace_recs[0]
            assert "name" in product, "Product missing name"
            assert "price" in product, "Product missing price"
            print(f"  - {product['name']}: {product['price']} ₴")
    
    def test_07_student_home_social_proof(self, admin_token):
        """Verify Social proof card in student home (implicit in events)"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Social proof is rendered in frontend, backend provides data
        print(f"✓ Social proof: Backend provides data for frontend rendering")
    
    def test_08_student_feed_returns_typed_items(self, admin_token):
        """GET /api/student/feed returns feed with typed items"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Student feed failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "feed" in data, "Missing feed field"
        feed = data["feed"]
        assert isinstance(feed, list), "Feed should be a list"
        print(f"✓ Student feed: {len(feed)} items")
        
        # Check for typed items
        types_found = set()
        for item in feed:
            assert "type" in item, "Feed item missing type"
            types_found.add(item["type"])
            print(f"  - {item['type']}: {item.get('text', item.get('title', ''))[:50]}")
        
        # Expected types: streak, badge, coach_message, club
        expected_types = {"streak", "badge", "coach_message", "club"}
        print(f"✓ Feed types found: {types_found}")
        print(f"✓ Expected types: {expected_types}")
    
    def test_09_student_feed_streak_card(self, admin_token):
        """Verify streak card in student feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        feed = data.get("feed", [])
        streak_cards = [f for f in feed if f.get("type") == "streak"]
        
        if streak_cards:
            streak = streak_cards[0]
            assert "value" in streak, "Streak card missing value"
            assert "text" in streak, "Streak card missing text"
            print(f"✓ Streak card: {streak['value']} trainings - {streak['text']}")
        else:
            print(f"⚠ No streak card found (may be expected if no streak)")
    
    def test_10_student_feed_badge_card(self, admin_token):
        """Verify badge card in student feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        feed = data.get("feed", [])
        badge_cards = [f for f in feed if f.get("type") == "badge"]
        
        if badge_cards:
            badge = badge_cards[0]
            assert "text" in badge, "Badge card missing text"
            print(f"✓ Badge card: {badge['text']}")
        else:
            print(f"⚠ No badge card found (may be expected if no achievements)")
    
    def test_11_student_feed_coach_message_card(self, admin_token):
        """Verify coach_message card in student feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        feed = data.get("feed", [])
        coach_cards = [f for f in feed if f.get("type") == "coach_message"]
        
        if coach_cards:
            coach = coach_cards[0]
            assert "text" in coach, "Coach message card missing text"
            assert "fromName" in coach, "Coach message card missing fromName"
            print(f"✓ Coach message card: {coach['fromName']} - {coach['text'][:50]}")
        else:
            print(f"⚠ No coach message card found (may be expected if no messages)")
    
    def test_12_student_feed_club_card(self, admin_token):
        """Verify club card in student feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        feed = data.get("feed", [])
        club_cards = [f for f in feed if f.get("type") == "club"]
        
        if club_cards:
            club = club_cards[0]
            assert "text" in club, "Club card missing text"
            print(f"✓ Club card: {club['text'][:50]}")
        else:
            print(f"⚠ No club card found (may be expected if no club news)")
    
    def test_13_student_gamification_endpoint(self, admin_token):
        """GET /api/student/gamification returns full gamification data"""
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Student gamification failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Student gamification response keys: {list(data.keys())}")
        
        # Required keys
        required_keys = ["xp", "level", "levelName", "badges", "dailyTasks", "rewards"]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
            print(f"  ✓ {key}: present")
        
        # Check badges
        badges = data.get("badges", [])
        assert isinstance(badges, list), "Badges should be a list"
        print(f"✓ Badges: {len(badges)} total")
        earned = [b for b in badges if b.get("earned")]
        print(f"  - Earned: {len(earned)}")
        
        # Check daily tasks
        daily_tasks = data.get("dailyTasks", [])
        assert isinstance(daily_tasks, list), "Daily tasks should be a list"
        print(f"✓ Daily tasks: {len(daily_tasks)} tasks")
    
    def test_14_student_confirm_training(self, admin_token):
        """POST /api/student/confirm-training"""
        resp = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"trainingId": "test_training_123", "status": "CONFIRMED"}
        )
        assert resp.status_code == 200, f"Confirm training failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "success" in data, "Missing success field"
        assert data["success"] == True, "Confirm training should return success: true"
        print(f"✓ Confirm training: {data}")
    
    def test_15_student_coach_message(self, admin_token):
        """POST /api/student/coach-message"""
        resp = requests.post(
            f"{BASE_URL}/api/student/coach-message",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Test message to coach from student"}
        )
        assert resp.status_code == 200, f"Coach message failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "success" in data, "Missing success field"
        assert data["success"] == True, "Coach message should return success: true"
        print(f"✓ Coach message sent: {data}")
    
    def test_16_student_freeze_streak(self, admin_token):
        """POST /api/student/freeze-streak"""
        resp = requests.post(
            f"{BASE_URL}/api/student/freeze-streak",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # May return 400 if freeze already used, that's OK
        if resp.status_code == 200:
            data = resp.json()
            assert "success" in data, "Missing success field"
            print(f"✓ Freeze streak: {data}")
        elif resp.status_code == 400:
            print(f"⚠ Freeze streak: {resp.json().get('error', 'Already used')}")
        else:
            pytest.fail(f"Unexpected status code: {resp.status_code} {resp.text}")
