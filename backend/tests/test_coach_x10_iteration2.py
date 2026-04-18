"""
COACH X10 Iteration 2 Backend Tests
Regression tests for:
- /api/coach/panel (all fields still present)
- /api/coach/kpi (analytics endpoint)
- /api/coach/leaderboard (leaderboard endpoint)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)


class TestCoachX10Iteration2:
    """Test COACH X10 iteration 2 backend endpoints"""

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
        print(f"[AUTH] Login successful")
        return data["accessToken"]

    def test_01_coach_panel_regression(self, coach_token):
        """Regression: /api/coach/panel returns all fields"""
        print(f"\n[TEST] GET /api/coach/panel - regression check")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check all required fields from iteration 1
        required_fields = [
            "today", "needsReaction", "whatToDoNow", "upcomingTrainings", 
            "myEffectiveness", "summary", "criticalToday", "atRisk", 
            "upsellReady", "allStudents", "actionLog"
        ]
        
        for field in required_fields:
            assert field in data, f"REGRESSION FAIL: Missing '{field}' field"
        
        print(f"[TEST] ✓ All fields present")
        
        # Validate today structure
        today = data["today"]
        assert "trainingsCount" in today
        assert "studentsCount" in today
        assert "riskCount" in today
        assert "upsellReadyCount" in today
        
        # Validate myEffectiveness structure
        eff = data["myEffectiveness"]
        assert "returnedStudents" in eff
        assert "conversionRate" in eff
        assert "upsellCount" in eff
        assert "retentionScore" in eff
        assert "monthSales" in eff
        assert "monthBonus" in eff
        
        # Validate summary structure
        summary = data["summary"]
        assert "total" in summary
        assert "rising" in summary
        assert "stable" in summary
        assert "risk" in summary
        
        print(f"[TEST] ✓ Panel regression passed: today={today}, summary={summary}")

    def test_02_coach_kpi_endpoint(self, coach_token):
        """Test GET /api/coach/kpi returns analytics data"""
        print(f"\n[TEST] GET /api/coach/kpi")
        response = requests.get(
            f"{BASE_URL}/api/coach/kpi",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"[TEST] KPI data: {data}")
        
        # Check sales field
        assert "sales" in data, "Missing 'sales' field in KPI response"
        sales = data["sales"]
        
        # Validate sales structure
        assert "monthSales" in sales, "Missing 'monthSales' in sales"
        assert "monthBonus" in sales, "Missing 'monthBonus' in sales"
        
        # Validate types
        assert isinstance(sales["monthSales"], (int, float)), "monthSales must be number"
        assert isinstance(sales["monthBonus"], (int, float)), "monthBonus must be number"
        
        print(f"[TEST] ✓ KPI endpoint working: monthSales={sales['monthSales']}, monthBonus={sales['monthBonus']}")

    def test_03_coach_leaderboard_endpoint(self, coach_token):
        """Test GET /api/coach/leaderboard returns leaderboard data"""
        print(f"\n[TEST] GET /api/coach/leaderboard")
        response = requests.get(
            f"{BASE_URL}/api/coach/leaderboard",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"[TEST] Leaderboard data keys: {data.keys()}")
        
        # Check required fields
        assert "leaderboard" in data, "Missing 'leaderboard' field"
        assert "myRank" in data, "Missing 'myRank' field"
        assert "totalCoaches" in data, "Missing 'totalCoaches' field"
        
        leaderboard = data["leaderboard"]
        my_rank = data["myRank"]
        total_coaches = data["totalCoaches"]
        
        # Validate types
        assert isinstance(leaderboard, list), "leaderboard must be list"
        assert isinstance(total_coaches, int), "totalCoaches must be int"
        
        print(f"[TEST] ✓ Leaderboard endpoint working: {len(leaderboard)} coaches, myRank={my_rank}, total={total_coaches}")
        
        # If leaderboard not empty, validate structure
        if leaderboard:
            first = leaderboard[0]
            print(f"[TEST] First entry: {first}")
            assert "rank" in first, "Missing 'rank' in leaderboard entry"
            assert "name" in first, "Missing 'name' in leaderboard entry"
            assert "score" in first, "Missing 'score' in leaderboard entry"
            assert "level" in first, "Missing 'level' in leaderboard entry"
            print(f"[TEST] ✓ Leaderboard structure valid")

    def test_04_coach_panel_risk_logic(self, coach_token):
        """Test panel C-block logic: if risk>0, should have data in needsReaction or atRisk"""
        print(f"\n[TEST] Panel C-block risk logic")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        today = data.get("today", {})
        summary = data.get("summary", {})
        needs_reaction = data.get("needsReaction", [])
        at_risk = data.get("atRisk", [])
        
        risk_count_today = today.get("riskCount", 0)
        risk_count_summary = summary.get("risk", 0)
        
        print(f"[TEST] Risk counts: today={risk_count_today}, summary={risk_count_summary}")
        print(f"[TEST] needsReaction count: {len(needs_reaction)}")
        print(f"[TEST] atRisk count: {len(at_risk)}")
        
        # If there's risk, we should have either needsReaction or atRisk data
        has_risk = risk_count_today > 0 or risk_count_summary > 0
        if has_risk:
            assert len(needs_reaction) > 0 or len(at_risk) > 0, \
                "LOGIC ERROR: risk>0 but both needsReaction and atRisk are empty"
            print(f"[TEST] ✓ Risk logic valid: risk exists and data available for fallback")
        else:
            print(f"[TEST] ✓ No risk detected, logic check skipped")

    def test_05_unauthorized_access(self):
        """Test all endpoints return 401 without token"""
        print(f"\n[TEST] Unauthorized access checks")
        
        endpoints = [
            "/api/coach/panel",
            "/api/coach/kpi",
            "/api/coach/leaderboard"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            assert response.status_code in (401, 403), \
                f"Endpoint {endpoint} should return 401/403 without token, got {response.status_code}"
            print(f"[TEST] ✓ {endpoint} blocked without auth (status={response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
