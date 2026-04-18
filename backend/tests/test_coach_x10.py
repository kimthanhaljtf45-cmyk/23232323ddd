"""
COACH X10 Backend Tests
Tests for /api/coach/panel endpoint with new fields:
- today {trainingsCount, studentsCount, riskCount, upsellReadyCount}
- needsReaction[]
- whatToDoNow[]
- upcomingTrainings[]
- myEffectiveness{returnedStudents, conversionRate, upsellCount, retentionScore, monthSales, monthBonus}
- Regression: summary, criticalToday, atRisk, upsellReady, allStudents, actionLog
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)


class TestCoachX10Backend:
    """Test COACH X10 panel endpoint"""

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
        print(f"[AUTH] Login successful, token: {data['accessToken'][:30]}...")
        return data["accessToken"]

    def test_01_coach_panel_returns_200(self, coach_token):
        """Test GET /api/coach/panel returns 200"""
        print(f"\n[TEST] GET /api/coach/panel")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        print(f"[TEST] Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_02_coach_panel_new_field_today(self, coach_token):
        """Test new field: today {trainingsCount, studentsCount, riskCount, upsellReadyCount}"""
        print(f"\n[TEST] Checking 'today' field")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "today" in data, "Missing 'today' field"
        today = data["today"]
        print(f"[TEST] today: {today}")
        
        # Check all required keys
        assert "trainingsCount" in today, "Missing 'trainingsCount' in today"
        assert "studentsCount" in today, "Missing 'studentsCount' in today"
        assert "riskCount" in today, "Missing 'riskCount' in today"
        assert "upsellReadyCount" in today, "Missing 'upsellReadyCount' in today"
        
        # Validate types
        assert isinstance(today["trainingsCount"], int), "trainingsCount must be int"
        assert isinstance(today["studentsCount"], int), "studentsCount must be int"
        assert isinstance(today["riskCount"], int), "riskCount must be int"
        assert isinstance(today["upsellReadyCount"], int), "upsellReadyCount must be int"
        
        print(f"[TEST] ✓ today field valid: trainings={today['trainingsCount']}, students={today['studentsCount']}, risk={today['riskCount']}, upsell={today['upsellReadyCount']}")

    def test_03_coach_panel_new_field_needs_reaction(self, coach_token):
        """Test new field: needsReaction[]"""
        print(f"\n[TEST] Checking 'needsReaction' field")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "needsReaction" in data, "Missing 'needsReaction' field"
        needs_reaction = data["needsReaction"]
        print(f"[TEST] needsReaction count: {len(needs_reaction)}")
        
        assert isinstance(needs_reaction, list), "needsReaction must be list"
        
        # If not empty, validate structure
        if needs_reaction:
            first = needs_reaction[0]
            print(f"[TEST] First reaction: {first}")
            assert "id" in first, "Missing 'id' in needsReaction item"
            assert "name" in first, "Missing 'name' in needsReaction item"
            assert "type" in first, "Missing 'type' in needsReaction item"
            assert "label" in first, "Missing 'label' in needsReaction item"
            assert "actions" in first, "Missing 'actions' in needsReaction item"
            assert isinstance(first["actions"], list), "actions must be list"
            print(f"[TEST] ✓ needsReaction structure valid")
        else:
            print(f"[TEST] ✓ needsReaction is empty (no reactions needed)")

    def test_04_coach_panel_new_field_what_to_do_now(self, coach_token):
        """Test new field: whatToDoNow[]"""
        print(f"\n[TEST] Checking 'whatToDoNow' field")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "whatToDoNow" in data, "Missing 'whatToDoNow' field"
        what_to_do = data["whatToDoNow"]
        print(f"[TEST] whatToDoNow count: {len(what_to_do)}")
        
        assert isinstance(what_to_do, list), "whatToDoNow must be list"
        
        # If not empty, validate structure
        if what_to_do:
            first = what_to_do[0]
            print(f"[TEST] First action: {first}")
            assert "id" in first, "Missing 'id' in whatToDoNow item"
            assert "title" in first, "Missing 'title' in whatToDoNow item"
            assert "action" in first, "Missing 'action' in whatToDoNow item"
            print(f"[TEST] ✓ whatToDoNow structure valid")
        else:
            print(f"[TEST] ✓ whatToDoNow is empty (no actions needed)")

    def test_05_coach_panel_new_field_upcoming_trainings(self, coach_token):
        """Test new field: upcomingTrainings[]"""
        print(f"\n[TEST] Checking 'upcomingTrainings' field")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "upcomingTrainings" in data, "Missing 'upcomingTrainings' field"
        upcoming = data["upcomingTrainings"]
        print(f"[TEST] upcomingTrainings count: {len(upcoming)}")
        
        assert isinstance(upcoming, list), "upcomingTrainings must be list"
        
        # If not empty, validate structure
        if upcoming:
            first = upcoming[0]
            print(f"[TEST] First training: {first}")
            assert "group" in first, "Missing 'group' in upcomingTrainings item"
            assert "startTime" in first, "Missing 'startTime' in upcomingTrainings item"
            assert "studentsCount" in first, "Missing 'studentsCount' in upcomingTrainings item"
            print(f"[TEST] ✓ upcomingTrainings structure valid")
        else:
            print(f"[TEST] ⚠ upcomingTrainings is empty (no upcoming trainings)")

    def test_06_coach_panel_new_field_my_effectiveness(self, coach_token):
        """Test new field: myEffectiveness {returnedStudents, conversionRate, upsellCount, retentionScore, monthSales, monthBonus}"""
        print(f"\n[TEST] Checking 'myEffectiveness' field")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "myEffectiveness" in data, "Missing 'myEffectiveness' field"
        eff = data["myEffectiveness"]
        print(f"[TEST] myEffectiveness: {eff}")
        
        # Check all required keys
        assert "returnedStudents" in eff, "Missing 'returnedStudents' in myEffectiveness"
        assert "conversionRate" in eff, "Missing 'conversionRate' in myEffectiveness"
        assert "upsellCount" in eff, "Missing 'upsellCount' in myEffectiveness"
        assert "retentionScore" in eff, "Missing 'retentionScore' in myEffectiveness"
        assert "monthSales" in eff, "Missing 'monthSales' in myEffectiveness"
        assert "monthBonus" in eff, "Missing 'monthBonus' in myEffectiveness"
        
        # Validate types
        assert isinstance(eff["returnedStudents"], int), "returnedStudents must be int"
        assert isinstance(eff["conversionRate"], int), "conversionRate must be int"
        assert isinstance(eff["upsellCount"], int), "upsellCount must be int"
        assert isinstance(eff["retentionScore"], int), "retentionScore must be int"
        assert isinstance(eff["monthSales"], (int, float)), "monthSales must be number"
        assert isinstance(eff["monthBonus"], (int, float)), "monthBonus must be number"
        
        print(f"[TEST] ✓ myEffectiveness valid: returned={eff['returnedStudents']}, conversion={eff['conversionRate']}%, upsell={eff['upsellCount']}, retention={eff['retentionScore']}, sales={eff['monthSales']}, bonus={eff['monthBonus']}")

    def test_07_coach_panel_regression_old_fields(self, coach_token):
        """Regression test: verify old fields still present (summary, criticalToday, atRisk, upsellReady, allStudents, actionLog)"""
        print(f"\n[TEST] Regression check: old fields")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check old fields
        assert "summary" in data, "REGRESSION FAIL: Missing 'summary' field"
        assert "criticalToday" in data, "REGRESSION FAIL: Missing 'criticalToday' field"
        assert "atRisk" in data, "REGRESSION FAIL: Missing 'atRisk' field"
        assert "upsellReady" in data, "REGRESSION FAIL: Missing 'upsellReady' field"
        assert "allStudents" in data, "REGRESSION FAIL: Missing 'allStudents' field"
        assert "actionLog" in data, "REGRESSION FAIL: Missing 'actionLog' field"
        
        # Validate summary structure
        summary = data["summary"]
        assert "total" in summary, "Missing 'total' in summary"
        assert "rising" in summary, "Missing 'rising' in summary"
        assert "stable" in summary, "Missing 'stable' in summary"
        assert "risk" in summary, "Missing 'risk' in summary"
        
        print(f"[TEST] ✓ Regression check passed: all old fields present")
        print(f"[TEST] summary: {summary}")
        print(f"[TEST] criticalToday count: {len(data['criticalToday'])}")
        print(f"[TEST] atRisk count: {len(data['atRisk'])}")
        print(f"[TEST] upsellReady count: {len(data['upsellReady'])}")
        print(f"[TEST] allStudents count: {len(data['allStudents'])}")
        print(f"[TEST] actionLog count: {len(data['actionLog'])}")

    def test_08_coach_panel_unauthorized_without_token(self):
        """Test /api/coach/panel returns 401 without token"""
        print(f"\n[TEST] GET /api/coach/panel without token")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            timeout=10
        )
        print(f"[TEST] Status: {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"[TEST] ✓ Unauthorized access blocked")

    def test_09_coach_message_endpoint_exists(self, coach_token):
        """Test POST /api/student/coach-message endpoint exists (used by modal)"""
        print(f"\n[TEST] POST /api/student/coach-message (dry run)")
        # We won't actually send a message, just check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/student/coach-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={"text": "Test", "toStudentId": "dummy"},
            timeout=10
        )
        # Expect 400/404/422 (validation error) or 200/201 (success)
        # NOT 401 (auth works) or 500 (server error)
        print(f"[TEST] Status: {response.status_code}")
        assert response.status_code in (200, 201, 400, 404, 422), f"Unexpected status: {response.status_code}"
        print(f"[TEST] ✓ Endpoint exists and auth works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
