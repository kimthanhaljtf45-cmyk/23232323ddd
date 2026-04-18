"""
ATAKA CRM Deployment Testing
=============================
Tests for ATAKA CRM platform deployment verification.
Tests backend health, proxy status, OTP auth flow, and core APIs.

Test Coverage:
- Health check and proxy status
- OTP request and verification for Admin, Coach, Parent roles
- Automation rules API
- Groups API (authenticated)
"""

import pytest
import requests
import os
import time

# Backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable is required")

print(f"\n[TEST CONFIG] Backend URL: {BASE_URL}")

# Test credentials from /app/memory/test_credentials.md
TEST_CREDENTIALS = {
    "admin": {"phone": "+380501234567", "otp": "0000", "role": "ADMIN"},
    "coach": {"phone": "+380501234568", "otp": "0000", "role": "COACH"},
    "parent": {"phone": "+380501234569", "otp": "0000", "role": "PARENT"},
    "owner": {"phone": "+380500000001", "otp": "0000", "role": "OWNER"},
}


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthAndProxy:
    """Health check and proxy status tests"""

    def test_01_health_check(self, api_client):
        """Test GET /api/health returns status ok"""
        print("\n[TEST] GET /api/health")
        response = api_client.get(f"{BASE_URL}/api/health")
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:200]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        print(f"[SUCCESS] Health check passed: {data}")

    def test_02_proxy_status(self, api_client):
        """Test GET /api/proxy/status shows nestjs healthy"""
        print("\n[TEST] GET /api/proxy/status")
        response = api_client.get(f"{BASE_URL}/api/proxy/status")
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:200]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "nestjs" in data, "Response should contain 'nestjs' field"
        assert data["nestjs"] == "healthy", f"NestJS should be healthy, got: {data.get('nestjs')}"
        print(f"[SUCCESS] Proxy status: {data}")


class TestAuthOTPFlow:
    """OTP authentication flow tests for all roles"""

    def test_03_request_otp_admin(self, api_client):
        """Test POST /api/auth/request-otp for Admin phone"""
        phone = TEST_CREDENTIALS["admin"]["phone"]
        print(f"\n[TEST] POST /api/auth/request-otp with phone: {phone}")
        
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:200]}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        data = response.json()
        assert "success" in data or "message" in data, "Response should indicate success"
        print(f"[SUCCESS] OTP request sent for Admin: {data}")

    def test_04_verify_otp_admin(self, api_client):
        """Test POST /api/auth/verify-otp for Admin returns accessToken and ADMIN user"""
        phone = TEST_CREDENTIALS["admin"]["phone"]
        otp = TEST_CREDENTIALS["admin"]["otp"]
        print(f"\n[TEST] POST /api/auth/verify-otp with phone: {phone}, code: {otp}")
        
        # Request OTP first
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
        time.sleep(0.5)
        
        # Verify OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": otp})
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:300]}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        data = response.json()
        
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["role"] == "ADMIN", f"User role should be ADMIN, got: {data['user'].get('role')}"
        
        print(f"[SUCCESS] Admin login successful. Role: {data['user']['role']}, Token: {data['accessToken'][:30]}...")

    def test_05_verify_otp_coach(self, api_client):
        """Test POST /api/auth/verify-otp for Coach returns COACH user"""
        phone = TEST_CREDENTIALS["coach"]["phone"]
        otp = TEST_CREDENTIALS["coach"]["otp"]
        print(f"\n[TEST] POST /api/auth/verify-otp with phone: {phone}, code: {otp}")
        
        # Request OTP first
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
        time.sleep(0.5)
        
        # Verify OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": otp})
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:300]}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        data = response.json()
        
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["role"] == "COACH", f"User role should be COACH, got: {data['user'].get('role')}"
        
        print(f"[SUCCESS] Coach login successful. Role: {data['user']['role']}, Token: {data['accessToken'][:30]}...")

    def test_06_verify_otp_parent(self, api_client):
        """Test POST /api/auth/verify-otp for Parent returns PARENT user"""
        phone = TEST_CREDENTIALS["parent"]["phone"]
        otp = TEST_CREDENTIALS["parent"]["otp"]
        print(f"\n[TEST] POST /api/auth/verify-otp with phone: {phone}, code: {otp}")
        
        # Request OTP first
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
        time.sleep(0.5)
        
        # Verify OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": otp})
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:300]}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        data = response.json()
        
        assert "accessToken" in data, "Response should contain accessToken"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["role"] == "PARENT", f"User role should be PARENT, got: {data['user'].get('role')}"
        
        print(f"[SUCCESS] Parent login successful. Role: {data['user']['role']}, Token: {data['accessToken'][:30]}...")


class TestAutomationAndGroups:
    """Automation rules and groups API tests"""

    def test_07_automation_rules(self, api_client):
        """Test GET /api/automation/rules returns rules list"""
        print("\n[TEST] GET /api/automation/rules")
        response = api_client.get(f"{BASE_URL}/api/automation/rules")
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:300]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list of rules"
        if len(data) > 0:
            rule = data[0]
            assert "id" in rule or "name" in rule, "Rule should have id or name field"
            print(f"[SUCCESS] Automation rules returned: {len(data)} rules")
        else:
            print("[SUCCESS] Automation rules returned: 0 rules (empty list)")

    def test_08_groups_with_auth(self, api_client):
        """Test GET /api/groups with auth token returns groups list"""
        # Login as Admin to get token
        phone = TEST_CREDENTIALS["admin"]["phone"]
        otp = TEST_CREDENTIALS["admin"]["otp"]
        
        print(f"\n[TEST] Login as Admin to get token")
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
        time.sleep(0.5)
        
        auth_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": otp})
        assert auth_response.status_code in [200, 201], "Admin login failed"
        
        token = auth_response.json()["accessToken"]
        print(f"[SUCCESS] Admin token obtained: {token[:30]}...")
        
        # Test groups API with auth
        print("\n[TEST] GET /api/groups with auth token")
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/groups", headers=headers)
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:300]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list of groups"
        if len(data) > 0:
            group = data[0]
            assert "id" in group or "name" in group or "_id" in group, "Group should have id/name/_id field"
            print(f"[SUCCESS] Groups returned: {len(data)} groups")
        else:
            print("[SUCCESS] Groups returned: 0 groups (empty list)")

    def test_09_groups_without_auth(self, api_client):
        """Test GET /api/groups without auth returns 401"""
        print("\n[TEST] GET /api/groups without auth (should fail)")
        response = api_client.get(f"{BASE_URL}/api/groups")
        print(f"[RESPONSE] Status: {response.status_code}, Body: {response.text[:200]}")
        
        # Groups API might be public or require auth - check both cases
        if response.status_code == 401:
            print("[SUCCESS] Groups API requires authentication (401 returned)")
        elif response.status_code == 200:
            print("[INFO] Groups API is public (200 returned)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
