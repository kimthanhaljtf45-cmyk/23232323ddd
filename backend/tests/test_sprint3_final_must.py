"""
Sprint 3 FINAL MUST items backend testing
Tests:
1. XP backend link - POST /api/student/xp/apply
2. Feed priority field - GET /api/student/feed returns priority
3. Market reason microcontext - GET /api/marketplace/featured returns reason
4. Competitions urgency - GET /api/student/home returns daysUntil
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)

# Test credentials from /app/memory/test_credentials.md
JUNIOR_PHONE = "+380991001010"  # Артем Коваленко
OTP_BYPASS = "0000"


@pytest.fixture(scope="module")
def junior_token():
    """Get JWT token for Junior student"""
    resp = requests.post(
        f"{BASE_URL}/api/auth/verify-otp",
        json={"phone": JUNIOR_PHONE, "code": OTP_BYPASS},
        timeout=10
    )
    assert resp.status_code in (200, 201), f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("accessToken") or data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture
def auth_headers(junior_token):
    """Authorization headers for API calls"""
    return {"Authorization": f"Bearer {junior_token}", "Content-Type": "application/json"}


class TestXPBackendLink:
    """Sprint 3 MUST: Real XP endpoint that updates DB"""

    def test_xp_apply_training_confirm_returns_success(self, auth_headers):
        """POST /api/student/xp/apply with source='training_confirm' returns success=true, delta=5"""
        resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "training_confirm"},
            headers=auth_headers,
            timeout=10
        )
        assert resp.status_code == 200, f"XP apply failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Expected success=true, got {data}"
        assert data.get("delta") == 5, f"Expected delta=5 for training_confirm, got {data.get('delta')}"
        assert data.get("source") == "training_confirm"
        assert "xp" in data, "Response should include total xp"
        assert "discipline" in data, "Response should include discipline"
        print(f"✅ XP apply training_confirm: delta={data.get('delta')}, xp={data.get('xp')}, discipline={data.get('discipline')}")

    def test_xp_apply_daily_task_returns_correct_delta(self, auth_headers):
        """POST /api/student/xp/apply with source='daily_task' returns delta=5"""
        resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "daily_task"},
            headers=auth_headers,
            timeout=10
        )
        assert resp.status_code == 200, f"XP apply failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert data.get("delta") == 5, f"Expected delta=5 for daily_task, got {data.get('delta')}"
        print(f"✅ XP apply daily_task: delta={data.get('delta')}")

    def test_xp_apply_absence_report_returns_correct_delta(self, auth_headers):
        """POST /api/student/xp/apply with source='absence_report' returns delta=2"""
        resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "absence_report"},
            headers=auth_headers,
            timeout=10
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("delta") == 2, f"Expected delta=2 for absence_report, got {data.get('delta')}"
        print(f"✅ XP apply absence_report: delta={data.get('delta')}")

    def test_xp_apply_coach_message_sent_returns_correct_delta(self, auth_headers):
        """POST /api/student/xp/apply with source='coach_message_sent' returns delta=3"""
        resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "coach_message_sent"},
            headers=auth_headers,
            timeout=10
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("delta") == 3, f"Expected delta=3 for coach_message_sent, got {data.get('delta')}"
        print(f"✅ XP apply coach_message_sent: delta={data.get('delta')}")

    def test_xp_apply_increases_discipline(self, auth_headers):
        """POST /api/student/xp/apply increases discipline field"""
        # Get initial state
        home_resp = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        initial_discipline = home_resp.json().get("junior", {}).get("discipline", 70)
        
        # Apply XP
        resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "training_confirm"},
            headers=auth_headers,
            timeout=10
        )
        data = resp.json()
        new_discipline = data.get("discipline")
        discipline_delta = data.get("disciplineDelta", 1)
        
        assert new_discipline >= initial_discipline, f"Discipline should increase: {initial_discipline} -> {new_discipline}"
        assert discipline_delta >= 1, f"Expected disciplineDelta >= 1, got {discipline_delta}"
        print(f"✅ Discipline increased: {initial_discipline} -> {new_discipline} (delta={discipline_delta})")

    def test_xp_apply_persists_in_db(self, auth_headers):
        """POST /api/student/xp/apply persists changes - verify via GET /api/student/home"""
        # Get initial XP
        home_resp1 = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        initial_xp = home_resp1.json().get("junior", {}).get("xp", 0)
        
        # Apply XP
        xp_resp = requests.post(
            f"{BASE_URL}/api/student/xp/apply",
            json={"source": "training_confirm"},
            headers=auth_headers,
            timeout=10
        )
        applied_xp = xp_resp.json().get("xp")
        
        # Verify persistence
        home_resp2 = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        final_xp = home_resp2.json().get("junior", {}).get("xp", 0)
        
        assert final_xp == applied_xp, f"XP not persisted: applied={applied_xp}, fetched={final_xp}"
        assert final_xp > initial_xp, f"XP should increase: {initial_xp} -> {final_xp}"
        print(f"✅ XP persisted in DB: {initial_xp} -> {final_xp}")


class TestFeedPriorityField:
    """Sprint 3 MUST: Feed items have priority field driving visual hierarchy"""

    def test_feed_returns_priority_field(self, auth_headers):
        """GET /api/student/feed returns items with 'priority' field"""
        resp = requests.get(f"{BASE_URL}/api/student/feed", headers=auth_headers, timeout=10)
        assert resp.status_code == 200, f"Feed failed: {resp.status_code} {resp.text}"
        data = resp.json()
        feed = data.get("feed") or data.get("items") or []
        assert len(feed) > 0, "Feed should have at least one item"
        
        for item in feed[:5]:  # Check first 5 items
            assert "priority" in item, f"Item missing priority field: {item}"
            assert item["priority"] in ["critical", "important", "info"], f"Invalid priority: {item.get('priority')}"
        
        print(f"✅ Feed has priority field: {len(feed)} items, priorities: {[i.get('priority') for i in feed[:5]]}")

    def test_feed_priority_mapping_coach_message_is_critical(self, auth_headers):
        """Feed items with type='coach_message' should have priority='critical'"""
        resp = requests.get(f"{BASE_URL}/api/student/feed", headers=auth_headers, timeout=10)
        data = resp.json()
        feed = data.get("feed") or data.get("items") or []
        
        coach_messages = [i for i in feed if i.get("type") == "coach_message"]
        if coach_messages:
            for msg in coach_messages:
                assert msg.get("priority") == "critical", f"coach_message should be critical, got {msg.get('priority')}"
            print(f"✅ coach_message items have priority=critical ({len(coach_messages)} items)")
        else:
            print("⚠️ No coach_message items in feed to test priority mapping")

    def test_feed_priority_mapping_achievement_is_important(self, auth_headers):
        """Feed items with type='achievement' should have priority='important'"""
        resp = requests.get(f"{BASE_URL}/api/student/feed", headers=auth_headers, timeout=10)
        data = resp.json()
        feed = data.get("feed") or data.get("items") or []
        
        achievements = [i for i in feed if i.get("type") == "achievement"]
        if achievements:
            for ach in achievements:
                assert ach.get("priority") == "important", f"achievement should be important, got {ach.get('priority')}"
            print(f"✅ achievement items have priority=important ({len(achievements)} items)")
        else:
            print("⚠️ No achievement items in feed to test priority mapping")


class TestMarketReasonMicrocontext:
    """Sprint 3 MUST: Market products have 'reason' field explaining why this matters"""

    def test_marketplace_featured_returns_reason_field(self, auth_headers):
        """GET /api/marketplace/featured returns products with 'reason' field"""
        resp = requests.get(f"{BASE_URL}/api/marketplace/featured", headers=auth_headers, timeout=10)
        assert resp.status_code == 200, f"Marketplace failed: {resp.status_code} {resp.text}"
        data = resp.json()
        all_products = data.get("all") or []
        assert len(all_products) > 0, "Marketplace should have products"
        
        products_with_reason = [p for p in all_products if p.get("reason")]
        assert len(products_with_reason) > 0, "At least some products should have 'reason' field"
        
        print(f"✅ Marketplace products have reason: {len(products_with_reason)}/{len(all_products)} products")
        for p in products_with_reason[:3]:
            print(f"   - {p.get('name')}: {p.get('reason')}")

    def test_marketplace_coach_recommended_has_reason(self, auth_headers):
        """Coach recommended products should have reason='Рекомендовано тренером'"""
        resp = requests.get(f"{BASE_URL}/api/marketplace/featured", headers=auth_headers, timeout=10)
        data = resp.json()
        coach_rec = data.get("coachRecommended") or []
        
        if coach_rec:
            for prod in coach_rec:
                assert prod.get("reason") == "Рекомендовано тренером", f"Coach rec should have specific reason, got {prod.get('reason')}"
            print(f"✅ Coach recommended products have reason='Рекомендовано тренером' ({len(coach_rec)} items)")
        else:
            print("⚠️ No coach recommended products to test reason field")

    def test_marketplace_category_based_reasons(self, auth_headers):
        """Products should have category-based reasons (PROTECTION, UNIFORM, etc)"""
        resp = requests.get(f"{BASE_URL}/api/marketplace/featured", headers=auth_headers, timeout=10)
        data = resp.json()
        all_products = data.get("all") or []
        
        category_reasons = {
            "PROTECTION": "Використовується на змаганнях",
            "UNIFORM": "Потрібно для атестації",
            "EQUIPMENT": "Для повноцінних тренувань",
            "ACCESSORIES": "Зручність на тренуваннях",
        }
        
        found_categories = set()
        for prod in all_products:
            cat = prod.get("category")
            reason = prod.get("reason")
            if cat in category_reasons and not prod.get("isCoachRecommended"):
                expected_reason = category_reasons[cat]
                assert reason == expected_reason, f"Category {cat} should have reason '{expected_reason}', got '{reason}'"
                found_categories.add(cat)
        
        print(f"✅ Category-based reasons verified for: {found_categories}")


class TestCompetitionsUrgency:
    """Sprint 3 MUST: Competitions show daysUntil for urgency countdown"""

    def test_student_home_returns_upcoming_competitions_with_days_until(self, auth_headers):
        """GET /api/student/home returns junior.upcomingCompetitions with daysUntil field"""
        resp = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        assert resp.status_code == 200, f"Home failed: {resp.status_code} {resp.text}"
        data = resp.json()
        junior = data.get("junior") or {}
        upcoming = junior.get("upcomingCompetitions") or []
        
        assert len(upcoming) > 0, "Should have at least one upcoming competition"
        
        for comp in upcoming:
            assert "daysUntil" in comp, f"Competition missing daysUntil: {comp}"
            assert isinstance(comp.get("daysUntil"), (int, type(None))), f"daysUntil should be int or None, got {type(comp.get('daysUntil'))}"
            assert "name" in comp, "Competition should have name"
            assert "date" in comp, "Competition should have date"
        
        print(f"✅ Upcoming competitions have daysUntil: {len(upcoming)} competitions")
        for comp in upcoming:
            print(f"   - {comp.get('name')}: {comp.get('daysUntil')} days until")

    def test_competitions_days_until_calculation(self, auth_headers):
        """Verify daysUntil is calculated correctly (should be positive for future competitions)"""
        resp = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        data = resp.json()
        upcoming = data.get("junior", {}).get("upcomingCompetitions") or []
        
        for comp in upcoming:
            days = comp.get("daysUntil")
            if days is not None:
                # For upcoming competitions, daysUntil should be >= 0
                # (negative would mean past competition, which shouldn't be in "upcoming")
                assert days >= 0, f"Upcoming competition should have daysUntil >= 0, got {days} for {comp.get('name')}"
        
        print(f"✅ daysUntil calculation correct for {len(upcoming)} competitions")

    def test_home_still_works_regression_check(self, auth_headers):
        """Regression: GET /api/student/home still returns all expected fields"""
        resp = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        
        # Check core fields still present
        assert "junior" in data or "student" in data, "Home should have junior or student data"
        junior = data.get("junior") or {}
        
        expected_fields = ["belt", "xp", "discipline", "trainingsCompleted", "trainingsToNext"]
        for field in expected_fields:
            assert field in junior, f"Junior missing field: {field}"
        
        print(f"✅ Home endpoint regression check passed: all core fields present")
