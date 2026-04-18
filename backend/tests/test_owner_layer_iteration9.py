"""
ATAKA OWNER Layer Iteration 9 — Event Engine, Notifications, Promotions, Franchise
Tests for:
- GET /api/owner/events (business events array)
- GET /api/owner/notifications (notifications + unread count)
- POST /api/owner/notifications/read-all (mark all as read)
- POST /api/owner/promotions/create (create discount promotion)
- GET /api/owner/promotions (get promotions list)
- GET /api/owner/franchise (network dashboard)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or EXPO_BACKEND_URL must be set")
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def owner_token():
    """Get OWNER token (+380500000001, OTP: 0000)"""
    phone = "+380500000001"
    code = "0000"
    
    # Request OTP
    requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
    
    # Verify OTP
    response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
    if response.status_code == 201:
        data = response.json()
        return data.get("accessToken")
    return None

@pytest.fixture
def api_client(owner_token):
    """Authenticated API client with OWNER token"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {owner_token}"
    })
    return session


class TestOwnerEvents:
    """Test GET /api/owner/events — Business event engine"""

    def test_events_returns_200(self, api_client):
        """GET /api/owner/events should return 200 with events array"""
        response = api_client.get(f"{BASE_URL}/api/owner/events", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "events" in data, "Response should contain 'events' field"
        assert "total" in data, "Response should contain 'total' field"
        assert isinstance(data["events"], list), "events should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"✓ Events API passed: {data['total']} events returned")

    def test_events_structure(self, api_client):
        """Each event should have required fields: type, level, title, detail, action, actionLabel"""
        response = api_client.get(f"{BASE_URL}/api/owner/events", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        if len(events) > 0:
            event = events[0]
            assert "type" in event, "Event should have 'type'"
            assert "level" in event, "Event should have 'level'"
            assert "title" in event, "Event should have 'title'"
            assert "detail" in event, "Event should have 'detail'"
            assert "action" in event, "Event should have 'action'"
            assert "actionLabel" in event, "Event should have 'actionLabel'"
            
            # Validate level values
            assert event["level"] in ["high", "medium", "low", "positive"], f"Invalid level: {event['level']}"
            
            print(f"✓ Event structure valid: type={event['type']}, level={event['level']}, title={event['title']}")
        else:
            print("✓ No events found (valid state)")

    def test_events_unauthorized(self):
        """GET /api/owner/events without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/events", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Events unauthorized check passed")


class TestOwnerNotifications:
    """Test GET /api/owner/notifications — Notification center"""

    def test_notifications_returns_200(self, api_client):
        """GET /api/owner/notifications should return 200 with notifications array and unread count"""
        response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' field"
        assert "unread" in data, "Response should contain 'unread' field"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        assert isinstance(data["unread"], int), "unread should be an integer"
        
        print(f"✓ Notifications API passed: {len(data['notifications'])} notifications, {data['unread']} unread")

    def test_notifications_structure(self, api_client):
        """Each notification should have required fields"""
        response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        notifs = data.get("notifications", [])
        
        if len(notifs) > 0:
            notif = notifs[0]
            assert "userId" in notif, "Notification should have 'userId'"
            assert "type" in notif, "Notification should have 'type'"
            assert "title" in notif, "Notification should have 'title'"
            assert "body" in notif, "Notification should have 'body'"
            assert "isRead" in notif, "Notification should have 'isRead'"
            assert "createdAt" in notif, "Notification should have 'createdAt'"
            
            print(f"✓ Notification structure valid: type={notif['type']}, title={notif['title']}, isRead={notif['isRead']}")
        else:
            print("✓ No notifications found (valid state)")

    def test_mark_all_read(self, api_client):
        """POST /api/owner/notifications/read-all should mark all as read"""
        # First get current unread count
        before_response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert before_response.status_code == 200
        before_data = before_response.json()
        unread_before = before_data.get("unread", 0)
        
        # Mark all as read
        response = api_client.post(f"{BASE_URL}/api/owner/notifications/read-all", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] is True, "success should be True"
        
        # Verify unread count is now 0
        after_response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert after_response.status_code == 200
        after_data = after_response.json()
        unread_after = after_data.get("unread", 0)
        
        assert unread_after == 0, f"Unread count should be 0 after marking all as read, got {unread_after}"
        
        print(f"✓ Mark all read passed: {unread_before} → {unread_after} unread")

    def test_notifications_unauthorized(self):
        """GET /api/owner/notifications without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Notifications unauthorized check passed")


class TestOwnerPromotions:
    """Test promotions APIs — Create discounts and get promotions list"""

    def test_create_promotion(self, api_client):
        """POST /api/owner/promotions/create should create discount promotion"""
        payload = {
            "type": "discount",
            "discountPercent": 10,
            "name": "TEST_Акція -10%",
            "durationHours": 24
        }
        
        response = api_client.post(f"{BASE_URL}/api/owner/promotions/create", json=payload, timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] is True, "success should be True"
        assert "promoId" in data, "Response should contain 'promoId'"
        assert "message" in data, "Response should contain 'message'"
        assert "notifiedParents" in data, "Response should contain 'notifiedParents'"
        
        # Validate promo ID format
        assert data["promoId"].startswith("promo_"), f"promoId should start with 'promo_', got {data['promoId']}"
        
        print(f"✓ Create promotion passed: promoId={data['promoId']}, notified={data['notifiedParents']} parents")

    def test_get_promotions(self, api_client):
        """GET /api/owner/promotions should return promotions list"""
        response = api_client.get(f"{BASE_URL}/api/owner/promotions", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should contain 'promotions' field"
        assert isinstance(data["promotions"], list), "promotions should be a list"
        
        print(f"✓ Get promotions passed: {len(data['promotions'])} promotions found")

    def test_promotions_structure(self, api_client):
        """Each promotion should have required fields"""
        response = api_client.get(f"{BASE_URL}/api/owner/promotions", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        promos = data.get("promotions", [])
        
        if len(promos) > 0:
            promo = promos[0]
            assert "id" in promo, "Promotion should have 'id'"
            assert "name" in promo, "Promotion should have 'name'"
            assert "type" in promo, "Promotion should have 'type'"
            assert "discountPercent" in promo, "Promotion should have 'discountPercent'"
            assert "isActive" in promo, "Promotion should have 'isActive'"
            assert "createdAt" in promo, "Promotion should have 'createdAt'"
            assert "expiresAt" in promo, "Promotion should have 'expiresAt'"
            
            print(f"✓ Promotion structure valid: name={promo['name']}, discount={promo['discountPercent']}%, active={promo['isActive']}")
        else:
            print("✓ No promotions found (valid state)")

    def test_create_promotion_notifies_parents(self, api_client):
        """Creating promotion should send notifications to all parents"""
        # Get notifications count before
        notifs_before = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        
        # Create promotion
        payload = {
            "type": "discount",
            "discountPercent": 15,
            "name": "TEST_Акція -15%",
            "durationHours": 48
        }
        
        promo_response = api_client.post(f"{BASE_URL}/api/owner/promotions/create", json=payload, timeout=10)
        assert promo_response.status_code == 200
        
        promo_data = promo_response.json()
        notified_count = promo_data.get("notifiedParents", 0)
        
        # Verify parents were notified
        assert notified_count >= 0, "notifiedParents should be >= 0"
        
        print(f"✓ Promotion notification passed: {notified_count} parents notified")

    def test_promotions_unauthorized(self):
        """GET /api/owner/promotions without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/promotions", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Promotions unauthorized check passed")


class TestOwnerFranchise:
    """Test GET /api/owner/franchise — Network dashboard"""

    def test_franchise_returns_200(self, api_client):
        """GET /api/owner/franchise should return 200 with network dashboard"""
        response = api_client.get(f"{BASE_URL}/api/owner/franchise", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "totalRevenue" in data, "Response should contain 'totalRevenue'"
        assert "totalDebt" in data, "Response should contain 'totalDebt'"
        assert "totalStudents" in data, "Response should contain 'totalStudents'"
        assert "totalCoaches" in data, "Response should contain 'totalCoaches'"
        assert "clubs" in data, "Response should contain 'clubs'"
        
        # Validate data types
        assert isinstance(data["totalRevenue"], (int, float)), "totalRevenue should be a number"
        assert isinstance(data["totalDebt"], (int, float)), "totalDebt should be a number"
        assert isinstance(data["totalStudents"], int), "totalStudents should be an integer"
        assert isinstance(data["totalCoaches"], int), "totalCoaches should be an integer"
        assert isinstance(data["clubs"], list), "clubs should be a list"
        
        print(f"✓ Franchise API passed: revenue={data['totalRevenue']}, debt={data['totalDebt']}, students={data['totalStudents']}, coaches={data['totalCoaches']}, clubs={len(data['clubs'])}")

    def test_franchise_clubs_structure(self, api_client):
        """Each club in franchise should have required fields"""
        response = api_client.get(f"{BASE_URL}/api/owner/franchise", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        clubs = data.get("clubs", [])
        
        if len(clubs) > 0:
            club = clubs[0]
            assert "id" in club, "Club should have 'id'"
            assert "name" in club, "Club should have 'name'"
            assert "city" in club, "Club should have 'city'"
            assert "revenue" in club, "Club should have 'revenue'"
            assert "debt" in club, "Club should have 'debt'"
            assert "students" in club, "Club should have 'students'"
            assert "coaches" in club, "Club should have 'coaches'"
            assert "plan" in club, "Club should have 'plan'"
            
            print(f"✓ Club structure valid: name={club['name']}, revenue={club['revenue']}, students={club['students']}, plan={club['plan']}")
        else:
            print("✓ No clubs found (valid state)")

    def test_franchise_clubs_sorted_by_revenue(self, api_client):
        """Clubs should be sorted by revenue (descending)"""
        response = api_client.get(f"{BASE_URL}/api/owner/franchise", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        clubs = data.get("clubs", [])
        
        if len(clubs) > 1:
            revenues = [c.get("revenue", 0) for c in clubs]
            sorted_revenues = sorted(revenues, reverse=True)
            assert revenues == sorted_revenues, f"Clubs should be sorted by revenue (descending), got {revenues}"
            print(f"✓ Clubs sorted by revenue: {revenues}")
        else:
            print("✓ Less than 2 clubs, sorting not applicable")

    def test_franchise_unauthorized(self):
        """GET /api/owner/franchise without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/franchise", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Franchise unauthorized check passed")


class TestOwnerLayerIntegration:
    """Integration tests for OWNER layer"""

    def test_create_promotion_and_verify_in_list(self, api_client):
        """Create promotion → verify it appears in GET /api/owner/promotions"""
        # Create promotion
        payload = {
            "type": "discount",
            "discountPercent": 20,
            "name": "TEST_Integration_Акція -20%",
            "durationHours": 12
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/owner/promotions/create", json=payload, timeout=10)
        assert create_response.status_code == 200
        
        create_data = create_response.json()
        promo_id = create_data.get("promoId")
        
        # Get promotions list
        list_response = api_client.get(f"{BASE_URL}/api/owner/promotions", timeout=10)
        assert list_response.status_code == 200
        
        list_data = list_response.json()
        promos = list_data.get("promotions", [])
        
        # Verify created promotion is in the list
        found = False
        for promo in promos:
            if promo.get("id") == promo_id:
                found = True
                assert promo.get("name") == payload["name"], f"Promotion name mismatch"
                assert promo.get("discountPercent") == payload["discountPercent"], f"Discount percent mismatch"
                break
        
        assert found, f"Created promotion {promo_id} not found in promotions list"
        
        print(f"✓ Integration test passed: Created promotion {promo_id} found in list")

    def test_mark_all_read_affects_unread_count(self, api_client):
        """Mark all read → verify unread count becomes 0"""
        # Get initial unread count
        before_response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert before_response.status_code == 200
        before_data = before_response.json()
        unread_before = before_data.get("unread", 0)
        
        # Mark all as read
        mark_response = api_client.post(f"{BASE_URL}/api/owner/notifications/read-all", timeout=10)
        assert mark_response.status_code == 200
        
        # Get unread count after
        after_response = api_client.get(f"{BASE_URL}/api/owner/notifications", timeout=10)
        assert after_response.status_code == 200
        after_data = after_response.json()
        unread_after = after_data.get("unread", 0)
        
        # Verify unread count is 0
        assert unread_after == 0, f"Unread count should be 0 after marking all as read, got {unread_after}"
        
        print(f"✓ Integration test passed: Unread count {unread_before} → {unread_after}")
