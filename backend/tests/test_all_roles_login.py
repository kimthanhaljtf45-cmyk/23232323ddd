"""
ATAKA All Roles Login & Dashboard Routing Tests
Tests for all 5 roles: ADMIN, OWNER, COACH, PARENT, STUDENT
Verifies OTP login flow and correct role assignment
Also tests ownerUserId bug fix in GET /api/owner/club
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL', 'https://code-docs-hub-1.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

class TestAllRolesLogin:
    """Test login flow for all 5 roles"""

    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    def test_admin_login_flow(self, api_client):
        """ADMIN: +380501234567 → OTP 0000 → role=ADMIN"""
        phone = "+380501234567"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "ADMIN", f"Expected role=ADMIN, got {data['user'].get('role')}"
        assert data["user"]["phone"] == phone, f"Expected phone={phone}, got {data['user'].get('phone')}"
        
        print(f"✓ ADMIN login passed: role={data['user']['role']}, phone={data['user']['phone']}, token={data['accessToken'][:20]}...")

    def test_owner_login_flow(self, api_client):
        """OWNER: +380500000001 → OTP 0000 → role=OWNER"""
        phone = "+380500000001"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "OWNER", f"Expected role=OWNER, got {data['user'].get('role')}"
        assert data["user"]["phone"] == phone, f"Expected phone={phone}, got {data['user'].get('phone')}"
        
        print(f"✓ OWNER login passed: role={data['user']['role']}, phone={data['user']['phone']}, token={data['accessToken'][:20]}...")

    def test_coach_login_flow(self, api_client):
        """COACH: +380501234568 → OTP 0000 → role=COACH"""
        phone = "+380501234568"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "COACH", f"Expected role=COACH, got {data['user'].get('role')}"
        assert data["user"]["phone"] == phone, f"Expected phone={phone}, got {data['user'].get('phone')}"
        
        print(f"✓ COACH login passed: role={data['user']['role']}, phone={data['user']['phone']}, token={data['accessToken'][:20]}...")

    def test_parent_login_flow(self, api_client):
        """PARENT: +380501234569 → OTP 0000 → role=PARENT"""
        phone = "+380501234569"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "PARENT", f"Expected role=PARENT, got {data['user'].get('role')}"
        assert data["user"]["phone"] == phone, f"Expected phone={phone}, got {data['user'].get('phone')}"
        
        print(f"✓ PARENT login passed: role={data['user']['role']}, phone={data['user']['phone']}, token={data['accessToken'][:20]}...")

    def test_student_login_flow(self, api_client):
        """STUDENT: +380991001010 → OTP 0000 → role=STUDENT"""
        phone = "+380991001010"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "STUDENT", f"Expected role=STUDENT, got {data['user'].get('role')}"
        assert data["user"]["phone"] == phone, f"Expected phone={phone}, got {data['user'].get('phone')}"
        
        print(f"✓ STUDENT login passed: role={data['user']['role']}, phone={data['user']['phone']}, token={data['accessToken'][:20]}...")


class TestOwnerClubOwnerUserId:
    """Test GET /api/owner/club includes ownerUserId field (bug fix from iteration 3)"""

    @pytest.fixture
    def owner_token(self):
        """Get OWNER token"""
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
    def api_client(self, owner_token):
        """Authenticated API client with OWNER token"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {owner_token}"
        })
        return session

    def test_owner_club_includes_ownerUserId(self, api_client):
        """GET /api/owner/club should include ownerUserId field in club object"""
        response = api_client.get(f"{BASE_URL}/api/owner/club", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "club" in data, "Response should contain 'club' field"
        assert "ownerUserId" in data["club"], "club object should contain 'ownerUserId' field (bug fix from iteration 3)"
        assert data["club"]["ownerUserId"] is not None, "ownerUserId should not be None"
        assert isinstance(data["club"]["ownerUserId"], str), "ownerUserId should be a string"
        assert len(data["club"]["ownerUserId"]) > 0, "ownerUserId should not be empty"
        
        print(f"✓ GET /api/owner/club includes ownerUserId: {data['club']['ownerUserId']}")

    def test_owner_club_structure(self, api_client):
        """Verify complete club structure"""
        response = api_client.get(f"{BASE_URL}/api/owner/club", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        # Top-level fields
        assert "club" in data, "Response should contain 'club' field"
        assert "plan" in data, "Response should contain 'plan' field"
        assert "stats" in data, "Response should contain 'stats' field"
        
        # Club object fields
        club = data["club"]
        required_club_fields = ["id", "name", "plan", "ownerUserId"]
        for field in required_club_fields:
            assert field in club, f"club object should contain '{field}' field"
        
        print(f"✓ Club structure valid: id={club.get('id')}, name={club.get('name')}, plan={club.get('plan')}, ownerUserId={club.get('ownerUserId')}")


class TestOwnerInsightsEngine:
    """Test GET /api/owner/insights (already tested in iteration 6, quick verification)"""

    @pytest.fixture
    def owner_token(self):
        """Get OWNER token"""
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
    def api_client(self, owner_token):
        """Authenticated API client with OWNER token"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {owner_token}"
        })
        return session

    def test_owner_insights_returns_200(self, api_client):
        """GET /api/owner/insights should return 200 with insights"""
        response = api_client.get(f"{BASE_URL}/api/owner/insights", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "insights" in data, "Response should contain 'insights' field"
        assert "summary" in data, "Response should contain 'summary' field"
        assert isinstance(data["insights"], list), "insights should be a list"
        
        print(f"✓ Insights API passed: {len(data['insights'])} insights, summary={data['summary']}")
