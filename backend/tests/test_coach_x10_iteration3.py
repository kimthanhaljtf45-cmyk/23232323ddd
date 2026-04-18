"""
COACH X10 Iteration 3 Backend Tests
Tests for:
- POST /api/coach/mass-message (mass messaging endpoint)
- Auth checks (COACH/ADMIN only, 401/403 for others)
- Validation (text required, no recipients error)
- Regression: /api/coach/panel still returns all fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)


class TestCoachX10Iteration3:
    """Test COACH X10 iteration 3 backend endpoints"""

    @pytest.fixture(scope="class")
    def coach_token(self):
        """Login as COACH and return token"""
        print(f"\n[AUTH] Logging in as COACH: +380501234568")
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": "+380501234568", "code": "0000"},
            timeout=10
        )
        assert response.status_code in (200, 201), f"Login failed: {response.status_code} {response.text}"
        data = response.json()
        assert "accessToken" in data, "No accessToken in response"
        print(f"[AUTH] COACH login successful")
        return data["accessToken"]

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as ADMIN and return token"""
        print(f"\n[AUTH] Logging in as ADMIN: +380501234567")
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": "+380501234567", "code": "0000"},
            timeout=10
        )
        assert response.status_code in (200, 201), f"Login failed: {response.status_code} {response.text}"
        data = response.json()
        assert "accessToken" in data, "No accessToken in response"
        print(f"[AUTH] ADMIN login successful")
        return data["accessToken"]

    @pytest.fixture(scope="class")
    def parent_token(self):
        """Login as PARENT and return token"""
        print(f"\n[AUTH] Logging in as PARENT: +380501234569")
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": "+380501234569", "code": "0000"},
            timeout=10
        )
        if response.status_code not in (200, 201):
            print(f"[AUTH] PARENT login failed (expected for 403 test): {response.status_code}")
            return None
        data = response.json()
        token = data.get("accessToken")
        print(f"[AUTH] PARENT login successful")
        return token

    @pytest.fixture(scope="class")
    def test_group_id(self, coach_token):
        """Get a test group ID for mass message tests"""
        print(f"\n[SETUP] Fetching coach groups")
        response = requests.get(
            f"{BASE_URL}/api/coach/groups",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        if response.status_code == 200:
            groups = response.json()
            if groups and len(groups) > 0:
                group_id = groups[0].get("id") or groups[0].get("_id")
                print(f"[SETUP] Using group ID: {group_id}")
                return str(group_id)
        print(f"[SETUP] No groups found, will use mock ID")
        return "mock_group_id_for_validation_test"

    def test_01_mass_message_with_groupid_success(self, coach_token, test_group_id):
        """Test POST /api/coach/mass-message with groupId"""
        print(f"\n[TEST] POST /api/coach/mass-message with groupId")
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={
                "groupId": test_group_id,
                "text": "Тестове повідомлення для групи",
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        # Accept 200 or 400 (if no children in group)
        assert response.status_code in (200, 400), f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data, "Missing 'success' field"
            assert "sent" in data, "Missing 'sent' field"
            assert "pushSent" in data, "Missing 'pushSent' field"
            assert "recipientsCount" in data, "Missing 'recipientsCount' field"
            
            assert data["success"] is True, "success should be True"
            assert isinstance(data["sent"], int), "sent must be int"
            assert isinstance(data["pushSent"], int), "pushSent must be int"
            assert isinstance(data["recipientsCount"], int), "recipientsCount must be int"
            
            print(f"[TEST] ✓ Mass message sent: {data['sent']} messages, {data['recipientsCount']} recipients")
        else:
            # 400 with "no recipients" is acceptable if group is empty
            data = response.json()
            assert "error" in data
            assert "no recipients" in data["error"].lower() or "not found" in data["error"].lower()
            print(f"[TEST] ✓ Validation working: {data['error']}")

    def test_02_mass_message_with_scheduleid_success(self, coach_token):
        """Test POST /api/coach/mass-message with scheduleId (resolves to groupId)"""
        print(f"\n[TEST] POST /api/coach/mass-message with scheduleId")
        
        # Try to get a schedule ID
        today = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        schedule_id = None
        if today.status_code == 200:
            panel_data = today.json()
            upcoming = panel_data.get("upcomingTrainings", [])
            if upcoming and len(upcoming) > 0:
                schedule_id = upcoming[0].get("id")
        
        if not schedule_id:
            print(f"[TEST] ⚠ No schedule found, using mock ID for validation test")
            schedule_id = "mock_schedule_id"
        
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={
                "scheduleId": schedule_id,
                "text": "Нагадування про тренування",
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        # Accept 200 or 400 (if schedule not found or no children)
        assert response.status_code in (200, 400), f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            assert "sent" in data
            assert "recipientsCount" in data
            print(f"[TEST] ✓ Mass message via scheduleId: {data['sent']} messages")
        else:
            data = response.json()
            assert "error" in data
            print(f"[TEST] ✓ Validation working: {data['error']}")

    def test_03_mass_message_validation_text_required(self, coach_token, test_group_id):
        """Test POST /api/coach/mass-message validation: text required"""
        print(f"\n[TEST] POST /api/coach/mass-message - text required validation")
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={
                "groupId": test_group_id,
                "text": "",  # Empty text
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.text}")
        
        assert response.status_code == 400, f"Expected 400 for empty text, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Missing 'error' field"
        assert "text required" in data["error"].lower(), f"Expected 'text required' error, got: {data['error']}"
        print(f"[TEST] ✓ Validation working: text required")

    def test_04_mass_message_validation_no_recipients(self, coach_token):
        """Test POST /api/coach/mass-message validation: no recipients error"""
        print(f"\n[TEST] POST /api/coach/mass-message - no recipients validation")
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={
                "text": "Test message",
                "target": "both"
                # No groupId, scheduleId, or childIds
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.text}")
        
        assert response.status_code == 400, f"Expected 400 for no recipients, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Missing 'error' field"
        assert "no recipients" in data["error"].lower(), f"Expected 'no recipients' error, got: {data['error']}"
        print(f"[TEST] ✓ Validation working: no recipients")

    def test_05_mass_message_auth_401_no_token(self):
        """Test POST /api/coach/mass-message returns 401 without token"""
        print(f"\n[TEST] POST /api/coach/mass-message - 401 without token")
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            json={
                "groupId": "test_group",
                "text": "Test message",
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print(f"[TEST] ✓ Auth check: 401 without token")

    def test_06_mass_message_auth_403_parent_role(self, parent_token):
        """Test POST /api/coach/mass-message returns 403 for PARENT role"""
        print(f"\n[TEST] POST /api/coach/mass-message - 403 for PARENT role")
        
        if not parent_token:
            print(f"[TEST] ⚠ PARENT token not available, skipping 403 test")
            pytest.skip("PARENT token not available")
        
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={
                "groupId": "test_group",
                "text": "Test message",
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code in (401, 403), f"Expected 401/403 for PARENT role, got {response.status_code}"
        print(f"[TEST] ✓ Auth check: {response.status_code} for PARENT role")

    def test_07_mass_message_admin_role_allowed(self, admin_token, test_group_id):
        """Test POST /api/coach/mass-message allows ADMIN role"""
        print(f"\n[TEST] POST /api/coach/mass-message - ADMIN role allowed")
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "groupId": test_group_id,
                "text": "Admin test message",
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        # Accept 200 or 400 (if no children in group)
        assert response.status_code in (200, 400), f"Expected 200 or 400 for ADMIN, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            print(f"[TEST] ✓ ADMIN role allowed: {data.get('sent', 0)} messages sent")
        else:
            data = response.json()
            assert "error" in data
            print(f"[TEST] ✓ ADMIN role allowed (validation error expected): {data['error']}")

    def test_08_coach_panel_regression(self, coach_token):
        """Regression: /api/coach/panel still returns all fields"""
        print(f"\n[TEST] GET /api/coach/panel - regression check")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check all required fields from previous iterations
        required_fields = [
            "today", "needsReaction", "whatToDoNow", "upcomingTrainings", 
            "myEffectiveness", "summary", "atRisk", "upsellReady", "allStudents"
        ]
        
        for field in required_fields:
            assert field in data, f"REGRESSION FAIL: Missing '{field}' field"
        
        print(f"[TEST] ✓ All panel fields present (regression passed)")
        
        # Validate today structure
        today = data["today"]
        assert "trainingsCount" in today
        assert "studentsCount" in today
        assert "riskCount" in today
        assert "upsellReadyCount" in today
        
        print(f"[TEST] ✓ Panel regression passed: today={today}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
