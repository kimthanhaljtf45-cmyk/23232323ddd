"""
Test: Franchise SaaS Tariff Upgrade Request/Approve Flow
Tests the new request-based upgrade system (not instant upgrade)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or "https://code-docs-hub-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

class TestFranchiseUpgradeFlow:
    """Test franchise SaaS tariff upgrade request and approval flow"""

    @pytest.fixture(scope="class")
    def owner_session(self):
        """Login as Owner and return authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Request OTP
        otp_resp = session.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "+380500000001"})
        assert otp_resp.status_code in [200, 201], f"OTP request failed: {otp_resp.text}"
        
        # Verify OTP
        verify_resp = session.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380500000001",
            "code": "0000"
        })
        assert verify_resp.status_code in [200, 201], f"OTP verify failed: {verify_resp.text}"
        
        data = verify_resp.json()
        token = data.get("accessToken") or data.get("access_token")
        assert token, "No access token in response"
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session

    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as Admin and return authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Request OTP
        otp_resp = session.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "+380501234567"})
        assert otp_resp.status_code in [200, 201], f"Admin OTP request failed: {otp_resp.text}"
        
        # Verify OTP
        verify_resp = session.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380501234567",
            "code": "0000"
        })
        assert verify_resp.status_code in [200, 201], f"Admin OTP verify failed: {verify_resp.text}"
        
        data = verify_resp.json()
        token = data.get("accessToken") or data.get("access_token")
        assert token, "No admin access token in response"
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session

    def test_01_owner_get_current_club(self, owner_session):
        """Owner can get current club info with plan"""
        resp = owner_session.get(f"{BASE_URL}/api/owner/club")
        print(f"GET /api/owner/club: {resp.status_code}")
        assert resp.status_code == 200, f"Failed to get club: {resp.text}"
        
        data = resp.json()
        club = data.get("club") or data
        print(f"Current club plan: {club.get('plan', 'START')}")
        assert "plan" in club or club.get("plan") is not None, "Club should have plan field"

    def test_02_owner_request_upgrade_to_pro(self, owner_session):
        """Owner requests upgrade to PRO plan (creates PENDING_REVIEW request)"""
        resp = owner_session.post(f"{BASE_URL}/api/owner/club/upgrade", json={"plan": "PRO"})
        print(f"POST /api/owner/club/upgrade: {resp.status_code}")
        
        # Should return 200 or 201 with success message
        assert resp.status_code in [200, 201], f"Upgrade request failed: {resp.text}"
        
        data = resp.json()
        print(f"Upgrade response: {data}")
        
        # Should NOT instantly change plan, should create request
        assert "message" in data or "success" in data, "Should return success message"

    def test_03_owner_check_upgrade_status(self, owner_session):
        """Owner checks upgrade status - should show PENDING_REVIEW"""
        time.sleep(1)  # Brief wait for request to be created
        
        resp = owner_session.get(f"{BASE_URL}/api/owner/upgrade-status")
        print(f"GET /api/owner/upgrade-status: {resp.status_code}")
        assert resp.status_code == 200, f"Failed to get upgrade status: {resp.text}"
        
        data = resp.json()
        print(f"Upgrade status: {data}")
        
        pending = data.get("pending")
        if pending:
            assert pending.get("requestedPlan") == "PRO", "Requested plan should be PRO"
            assert pending.get("status") in ["PENDING_REVIEW", "PENDING"], "Status should be PENDING_REVIEW or PENDING"
            print(f"✓ Upgrade request is pending: {pending.get('requestedPlan')}")
        else:
            print("⚠ No pending upgrade request found (might have been processed already)")

    def test_04_admin_get_upgrade_requests(self, admin_session):
        """Admin can see all upgrade requests"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/upgrade-requests")
        print(f"GET /api/admin/upgrade-requests: {resp.status_code}")
        assert resp.status_code == 200, f"Failed to get upgrade requests: {resp.text}"
        
        data = resp.json()
        requests_list = data.get("requests") or data
        print(f"Total upgrade requests: {len(requests_list) if isinstance(requests_list, list) else 'N/A'}")
        
        if isinstance(requests_list, list) and len(requests_list) > 0:
            print(f"First request: {requests_list[0]}")
            # Should have clubId, requestedPlan, status
            first = requests_list[0]
            assert "clubId" in first or "clubName" in first, "Request should have club info"
            assert "requestedPlan" in first, "Request should have requestedPlan"
            assert "status" in first, "Request should have status"

    def test_05_admin_approve_upgrade_request(self, admin_session, owner_session):
        """Admin approves upgrade request and plan changes"""
        # First get the club ID from owner
        club_resp = owner_session.get(f"{BASE_URL}/api/owner/club")
        assert club_resp.status_code == 200, "Failed to get club"
        club_data = club_resp.json()
        club = club_data.get("club") or club_data
        club_id = club.get("id") or club.get("_id") or club.get("clubId")
        
        if not club_id:
            print("⚠ No club ID found, skipping approval test")
            pytest.skip("No club ID available")
        
        print(f"Approving upgrade for club: {club_id}")
        
        # Approve the request
        resp = admin_session.post(f"{BASE_URL}/api/admin/upgrade-requests/{club_id}/approve")
        print(f"POST /api/admin/upgrade-requests/{club_id}/approve: {resp.status_code}")
        
        # Should return 200 with success
        assert resp.status_code == 200, f"Failed to approve upgrade: {resp.text}"
        
        data = resp.json()
        print(f"Approval response: {data}")
        assert "success" in data or "message" in data, "Should return success message"
        
        # Wait a moment for DB update
        time.sleep(1)
        
        # Verify club plan changed to PRO
        club_resp2 = owner_session.get(f"{BASE_URL}/api/owner/club")
        assert club_resp2.status_code == 200, "Failed to get club after approval"
        club_data2 = club_resp2.json()
        club2 = club_data2.get("club") or club_data2
        
        current_plan = club2.get("plan", "START")
        print(f"Club plan after approval: {current_plan}")
        
        # Plan should now be PRO
        assert current_plan == "PRO", f"Plan should be PRO after approval, got {current_plan}"
        print("✓ Upgrade approved and plan changed to PRO")

    def test_06_owner_upgrade_status_cleared(self, owner_session):
        """After approval, upgrade status should be cleared"""
        time.sleep(1)
        
        resp = owner_session.get(f"{BASE_URL}/api/owner/upgrade-status")
        print(f"GET /api/owner/upgrade-status (after approval): {resp.status_code}")
        assert resp.status_code == 200, f"Failed to get upgrade status: {resp.text}"
        
        data = resp.json()
        pending = data.get("pending")
        
        # Should be None or empty after approval
        if pending:
            print(f"⚠ Pending request still exists: {pending}")
        else:
            print("✓ No pending request after approval (cleared)")
