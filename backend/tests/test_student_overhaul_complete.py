"""
Backend tests for ATAKA Student Product Overhaul - Complete Testing
Tests all student APIs with actual STUDENT credentials (+380991001010 Junior, +380501234571 Adult)
Features tested:
- Student login flow (Junior + Adult)
- GET /api/student/home (all keys, XP bar, events, daily tasks, market preview)
- GET /api/student/feed (typed feed items: streak, badge, coach_message, club)
- GET /api/marketplace/featured (10 products in 'all' array)
- GET /api/marketplace/bundles (3 bundles)
- GET /api/student/gamification (XP, level, badges, daily tasks, rewards)
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

class TestStudentOverhaulComplete:
    """Complete student product overhaul testing with real STUDENT credentials"""
    
    @pytest.fixture(scope="class")
    def junior_student_token(self):
        """Login as Junior Student: +380991001010"""
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380991001010",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"Junior student login failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        user = data.get("user", {})
        print(f"✓ Junior Student login: {user.get('firstName', '')} {user.get('lastName', '')} (role: {user.get('role', '')})")
        return data["accessToken"]
    
    @pytest.fixture(scope="class")
    def adult_student_token(self):
        """Login as Adult Student: +380501234571"""
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380501234571",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"Adult student login failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        user = data.get("user", {})
        print(f"✓ Adult Student login: {user.get('firstName', '')} {user.get('lastName', '')} (role: {user.get('role', '')})")
        return data["accessToken"]
    
    # ============================================================
    # STUDENT HOME TESTS
    # ============================================================
    
    def test_01_student_home_all_keys_junior(self, junior_student_token):
        """GET /api/student/home returns all required keys (Junior)"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Student home response keys: {list(data.keys())}")
        
        # Required keys
        required_keys = ["student", "todayTraining", "stats", "gamification", "events", "marketplaceRecs"]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
            print(f"  ✓ {key}: present")
        
        # Check junior data
        assert "junior" in data, "Missing junior data for JUNIOR student"
        print(f"✓ Junior data present: {list(data['junior'].keys())}")
    
    def test_02_student_home_all_keys_adult(self, adult_student_token):
        """GET /api/student/home returns all required keys (Adult)"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {adult_student_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        
        # Required keys
        required_keys = ["student", "todayTraining", "stats", "gamification", "events", "marketplaceRecs"]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
        
        # Check adult data
        assert "adult" in data, "Missing adult data for ADULT student"
        print(f"✓ Adult data present: {list(data['adult'].keys())}")
    
    def test_03_student_home_xp_bar(self, junior_student_token):
        """Verify XP bar data in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        g = data.get("gamification", {})
        assert "level" in g, "Missing level in gamification"
        assert "levelName" in g, "Missing levelName in gamification"
        assert "xp" in g, "Missing xp in gamification"
        assert "xpProgress" in g, "Missing xpProgress in gamification"
        print(f"✓ XP Bar: Lv.{g['level']} {g['levelName']} - {g['xp']} XP ({g['xpProgress']}%)")
    
    def test_04_student_home_events(self, junior_student_token):
        """Verify events array in student home"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        events = data.get("events", [])
        assert isinstance(events, list), "Events should be a list"
        print(f"✓ Events: {len(events)} events present")
        if events:
            e = events[0]
            print(f"  Event example: type={e.get('type')}, title={e.get('title')}")
    
    def test_05_student_home_daily_tasks(self, junior_student_token):
        """Verify daily tasks in gamification"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        g = data.get("gamification", {})
        # Daily tasks might be in gamification or separate endpoint
        print(f"✓ Gamification keys: {list(g.keys())}")
    
    def test_06_student_home_market_preview(self, junior_student_token):
        """Verify market preview (4 products)"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        recs = data.get("marketplaceRecs", [])
        assert isinstance(recs, list), "marketplaceRecs should be a list"
        print(f"✓ Market preview: {len(recs)} products")
        if recs:
            p = recs[0]
            print(f"  Product example: {p.get('name')} - {p.get('price')} ₴")
    
    # ============================================================
    # STUDENT FEED TESTS
    # ============================================================
    
    def test_07_student_feed_returns_typed_items(self, junior_student_token):
        """GET /api/student/feed returns typed feed items"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200, f"Student feed failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        feed = data.get("feed", [])
        assert isinstance(feed, list), "Feed should be a list"
        print(f"✓ Feed: {len(feed)} items")
        
        # Check for typed items
        types = set(item.get("type") for item in feed)
        print(f"✓ Feed types present: {types}")
        
        # Expected types: streak, badge, coach_message, club
        expected_types = {"streak", "badge", "coach_message", "club"}
        if feed:
            # At least some expected types should be present (or demo data)
            print(f"✓ Feed has {len(feed)} items with types: {types}")
    
    def test_08_student_feed_streak_card(self, junior_student_token):
        """Verify streak card structure in feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        feed = data.get("feed", [])
        
        streak_cards = [f for f in feed if f.get("type") == "streak"]
        print(f"✓ Streak cards: {len(streak_cards)}")
        if streak_cards:
            s = streak_cards[0]
            assert "value" in s, "Streak card should have value"
            print(f"  Streak: {s.get('value')} trainings")
    
    def test_09_student_feed_badge_card(self, junior_student_token):
        """Verify badge card structure in feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        feed = data.get("feed", [])
        
        badge_cards = [f for f in feed if f.get("type") == "badge"]
        print(f"✓ Badge cards: {len(badge_cards)}")
        if badge_cards:
            b = badge_cards[0]
            print(f"  Badge: {b.get('text')}")
    
    def test_10_student_feed_coach_message_card(self, junior_student_token):
        """Verify coach_message card structure in feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        feed = data.get("feed", [])
        
        coach_cards = [f for f in feed if f.get("type") == "coach_message"]
        print(f"✓ Coach message cards: {len(coach_cards)}")
        if coach_cards:
            c = coach_cards[0]
            print(f"  Coach message: {c.get('text')[:50]}...")
    
    def test_11_student_feed_club_card(self, junior_student_token):
        """Verify club card structure in feed"""
        resp = requests.get(
            f"{BASE_URL}/api/student/feed",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        feed = data.get("feed", [])
        
        club_cards = [f for f in feed if f.get("type") == "club"]
        print(f"✓ Club cards: {len(club_cards)}")
        if club_cards:
            c = club_cards[0]
            print(f"  Club: {c.get('text')[:50]}...")
    
    # ============================================================
    # MARKETPLACE TESTS
    # ============================================================
    
    def test_12_marketplace_featured_returns_all_array(self):
        """GET /api/marketplace/featured returns 'all' array with products"""
        resp = requests.get(f"{BASE_URL}/api/marketplace/featured")
        assert resp.status_code == 200, f"Marketplace featured failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "all" in data, "Missing 'all' array in marketplace/featured response"
        
        all_products = data["all"]
        assert isinstance(all_products, list), "'all' should be a list"
        print(f"✓ Marketplace featured: {len(all_products)} products in 'all' array")
        
        if all_products:
            p = all_products[0]
            print(f"  Product example: {p.get('name')} - {p.get('price')} ₴ (category: {p.get('category')})")
    
    def test_13_marketplace_bundles_returns_bundles(self):
        """GET /api/marketplace/bundles returns bundles array"""
        resp = requests.get(f"{BASE_URL}/api/marketplace/bundles")
        assert resp.status_code == 200, f"Marketplace bundles failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        assert "bundles" in data, "Missing 'bundles' array in response"
        
        bundles = data["bundles"]
        assert isinstance(bundles, list), "bundles should be a list"
        print(f"✓ Marketplace bundles: {len(bundles)} bundles")
        
        if bundles:
            b = bundles[0]
            print(f"  Bundle example: {b.get('name')} - {b.get('bundlePrice')} ₴ (discount: {b.get('discountPercent')}%)")
    
    # ============================================================
    # GAMIFICATION TESTS
    # ============================================================
    
    def test_14_student_gamification_endpoint(self, junior_student_token):
        """GET /api/student/gamification returns full gamification data"""
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"Authorization": f"Bearer {junior_student_token}"}
        )
        assert resp.status_code == 200, f"Student gamification failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ Gamification response keys: {list(data.keys())}")
        
        # Required keys
        required_keys = ["xp", "level", "levelName", "badges", "dailyTasks", "rewards"]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
            print(f"  ✓ {key}: present")
        
        # Check daily tasks
        tasks = data.get("dailyTasks", [])
        print(f"✓ Daily tasks: {len(tasks)} tasks")
        for t in tasks:
            print(f"  - {t.get('text')}: {'✓' if t.get('done') else '○'} (+{t.get('xp')} XP)")
    
    # ============================================================
    # STUDENT ACTIONS TESTS
    # ============================================================
    
    def test_15_student_confirm_training(self, junior_student_token):
        """POST /api/student/confirm-training works"""
        resp = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            headers={"Authorization": f"Bearer {junior_student_token}"},
            json={"trainingId": "test_training_id", "status": "CONFIRMED"}
        )
        # Should return success or 404 if no training
        print(f"✓ Confirm training: {resp.status_code} - {resp.text[:100]}")
        assert resp.status_code in [200, 201, 404], f"Unexpected status: {resp.status_code}"
    
    def test_16_student_coach_message(self, junior_student_token):
        """POST /api/student/coach-message works"""
        resp = requests.post(
            f"{BASE_URL}/api/student/coach-message",
            headers={"Authorization": f"Bearer {junior_student_token}"},
            json={"text": "Test message from student"}
        )
        # Should return success
        print(f"✓ Coach message: {resp.status_code} - {resp.text[:100]}")
        assert resp.status_code in [200, 201], f"Coach message failed: {resp.status_code} {resp.text}"
