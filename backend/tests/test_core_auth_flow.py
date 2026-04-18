"""
ATAKA Core Auth Flow Tests
Tests for basic health checks and authentication flow for ADMIN, COACH, PARENT roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestHealthChecks:
    """Health check endpoints"""

    def test_backend_health(self):
        """GET /api/health should return 200 with status 'ok'"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        print(f"✓ Backend health check passed: {data}")

    def test_proxy_status(self):
        """GET /api/proxy/status should return nestjs 'healthy'"""
        response = requests.get(f"{BASE_URL}/api/proxy/status", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "nestjs" in data, "Response should contain 'nestjs' field"
        assert data["nestjs"] == "healthy", f"Expected nestjs='healthy', got {data.get('nestjs')}"
        print(f"✓ Proxy status check passed: {data}")


class TestAuthFlow:
    """Authentication flow tests for ADMIN, COACH, PARENT roles"""

    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    def test_admin_request_otp(self, api_client):
        """POST /api/auth/request-otp with ADMIN phone should return success"""
        phone = "+380501234567"
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        print(f"✓ ADMIN request OTP passed: {data}")

    def test_admin_verify_otp(self, api_client):
        """POST /api/auth/verify-otp with ADMIN phone and code '0000' should return accessToken and ADMIN role"""
        phone = "+380501234567"
        code = "0000"
        
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        
        # Then verify
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accessToken" in data, "Response should contain 'accessToken'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["role"] == "ADMIN", f"Expected role=ADMIN, got {data['user'].get('role')}"
        print(f"✓ ADMIN verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")

    def test_coach_request_otp(self, api_client):
        """POST /api/auth/request-otp with COACH phone should return success"""
        phone = "+380501234568"
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        print(f"✓ COACH request OTP passed: {data}")

    def test_coach_verify_otp(self, api_client):
        """POST /api/auth/verify-otp with COACH phone and code '0000' should return accessToken and COACH role"""
        phone = "+380501234568"
        code = "0000"
        
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        
        # Then verify
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accessToken" in data, "Response should contain 'accessToken'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["role"] == "COACH", f"Expected role=COACH, got {data['user'].get('role')}"
        print(f"✓ COACH verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")

    def test_parent_request_otp(self, api_client):
        """POST /api/auth/request-otp with PARENT phone should return success"""
        phone = "+380501234569"
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        print(f"✓ PARENT request OTP passed: {data}")

    def test_parent_verify_otp(self, api_client):
        """POST /api/auth/verify-otp with PARENT phone and code '0000' should return accessToken and PARENT role"""
        phone = "+380501234569"
        code = "0000"
        
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone}, timeout=10)
        
        # Then verify
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accessToken" in data, "Response should contain 'accessToken'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["role"] == "PARENT", f"Expected role=PARENT, got {data['user'].get('role')}"
        print(f"✓ PARENT verify OTP passed: role={data['user']['role']}, token={data['accessToken'][:20]}...")
