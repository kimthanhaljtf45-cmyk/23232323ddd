"""
ATAKA Comprehensive Test Suite
Tests all features requested:
- Backend health checks
- Auth flow for all 4 roles (ADMIN, COACH, PARENT, OWNER)
- GET /api/users/me with valid token
- Marketplace bundles
- Automation rules
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestHealthChecks:
    """Health check endpoints"""

    def test_backend_health(self):
        """GET /api/health should return 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        print(f"✓ Backend health check passed: {data}")

    def test_proxy_status(self):
        """GET /api/proxy/status should show nestjs healthy"""
        response = requests.get(f"{BASE_URL}/api/proxy/status", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "nestjs" in data, "Response should contain 'nestjs' field"
        assert data["nestjs"] == "healthy", f"Expected nestjs='healthy', got {data.get('nestjs')}"
        print(f"✓ Proxy status check passed: {data}")


class TestAuthFlowAllRoles:
    """Authentication flow tests for all 4 roles"""

    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    def test_admin_auth_flow(self, api_client):
        """Admin: +380501234567, OTP: 0000 → role=ADMIN"""
        phone = "+380501234567"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        print(f"✓ ADMIN request OTP passed")
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "ADMIN", f"Expected role=ADMIN, got {data['user'].get('role')}"
        print(f"✓ ADMIN verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")

    def test_coach_auth_flow(self, api_client):
        """Coach: +380501234568, OTP: 0000 → role=COACH"""
        phone = "+380501234568"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        print(f"✓ COACH request OTP passed")
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "COACH", f"Expected role=COACH, got {data['user'].get('role')}"
        print(f"✓ COACH verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")

    def test_parent_auth_flow(self, api_client):
        """Parent: +380501234569, OTP: 0000 → role=PARENT"""
        phone = "+380501234569"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        print(f"✓ PARENT request OTP passed")
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "PARENT", f"Expected role=PARENT, got {data['user'].get('role')}"
        print(f"✓ PARENT verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")

    def test_owner_auth_flow(self, api_client):
        """Owner: +380500000001, OTP: 0000 → role=OWNER"""
        phone = "+380500000001"
        code = "0000"
        
        # Request OTP
        otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert otp_response.status_code == 201, f"Request OTP failed: {otp_response.status_code} {otp_response.text}"
        assert otp_response.json().get("success") is True
        print(f"✓ OWNER request OTP passed")
        
        # Verify OTP
        verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert verify_response.status_code == 201, f"Verify OTP failed: {verify_response.status_code} {verify_response.text}"
        
        data = verify_response.json()
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "OWNER", f"Expected role=OWNER, got {data['user'].get('role')}"
        print(f"✓ OWNER verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")


class TestUsersMe:
    """Test GET /api/users/me with valid token"""

    @pytest.fixture
    def admin_token(self):
        """Get ADMIN token"""
        phone = "+380501234567"
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
    def api_client(self, admin_token):
        """Authenticated API client with ADMIN token"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session

    def test_users_me_with_valid_token(self, api_client):
        """GET /api/users/me with valid token should return user data"""
        response = api_client.get(f"{BASE_URL}/api/users/me", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data or "_id" in data, "Response should contain user id"
        assert "role" in data, "Response should contain role"
        assert "phone" in data, "Response should contain phone"
        assert data["role"] == "ADMIN", f"Expected role=ADMIN, got {data.get('role')}"
        print(f"✓ GET /api/users/me passed: role={data['role']}, phone={data['phone']}")


class TestMarketplaceBundles:
    """Test GET /api/marketplace/bundles"""

    def test_marketplace_bundles_returns_200(self):
        """GET /api/marketplace/bundles should return 200"""
        response = requests.get(f"{BASE_URL}/api/marketplace/bundles", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/marketplace/bundles returns 200")

    def test_marketplace_bundles_structure(self):
        """Bundles response should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/marketplace/bundles", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert "bundles" in data, "Response should contain 'bundles' field"
        bundles = data["bundles"]
        assert isinstance(bundles, list), "bundles should be a list"
        assert len(bundles) > 0, "bundles list should not be empty"
        
        # Check first bundle structure
        bundle = bundles[0]
        required_fields = ["id", "name", "bundlePrice", "originalPrice", "discountPercent", "products"]
        for field in required_fields:
            assert field in bundle, f"Bundle missing required field: {field}"
        
        print(f"✓ Marketplace bundles structure validated: {len(bundles)} bundles found")
        print(f"  - First bundle: {bundle['name']}, price: {bundle['bundlePrice']} ₴")


class TestAutomationRules:
    """Test GET /api/automation/rules"""

    def test_automation_rules_returns_200(self):
        """GET /api/automation/rules should return 200"""
        response = requests.get(f"{BASE_URL}/api/automation/rules", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/automation/rules returns 200")

    def test_automation_rules_structure(self):
        """Automation rules response should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/automation/rules", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list of rules"
        assert len(data) > 0, "Rules list should not be empty"
        
        # Check first rule structure
        rule = data[0]
        required_fields = ["id", "name", "description", "trigger", "condition", "actions", "isActive"]
        for field in required_fields:
            assert field in rule, f"Rule missing required field: {field}"
        
        print(f"✓ Automation rules structure validated: {len(data)} rules found")
        print(f"  - First rule: {rule['name']}, active: {rule['isActive']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
