"""
COACH X10 Iteration 4 Backend Tests
Tests for:
- 5th bottom tab "Результат" backend integration
- Performance screen loads 3 endpoints in parallel: /api/coach/panel, /api/coach/kpi, /api/coach/leaderboard
- Regression: All previous endpoints still work (panel, kpi, leaderboard, mass-message)
- Data structure validation for performance screen
"""

import pytest
import requests
import os

# Try to get URL from environment, fallback to reading from frontend/.env
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    # Try reading from frontend/.env
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                    break
    except:
        pass

if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)


class TestCoachX10Iteration4:
    """Test COACH X10 iteration 4 backend endpoints"""

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

    def test_01_coach_panel_endpoint(self, coach_token):
        """Test GET /api/coach/panel returns all required fields for performance screen"""
        print(f"\n[TEST] GET /api/coach/panel")
        response = requests.get(
            f"{BASE_URL}/api/coach/panel",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields for performance screen
        required_fields = [
            "myEffectiveness",  # Used for KPI cards
            "summary",          # Used for students by status
            "actionLog"         # Used for actions → result
        ]
        
        for field in required_fields:
            assert field in data, f"Missing '{field}' field in panel response"
        
        # Validate myEffectiveness structure
        eff = data["myEffectiveness"]
        assert "returnedStudents" in eff, "Missing returnedStudents in myEffectiveness"
        assert "conversionRate" in eff, "Missing conversionRate in myEffectiveness"
        assert "upsellCount" in eff, "Missing upsellCount in myEffectiveness"
        assert "retentionScore" in eff, "Missing retentionScore in myEffectiveness"
        
        # Validate summary structure (for students by status)
        summary = data["summary"]
        assert "risk" in summary, "Missing risk in summary"
        assert "rising" in summary, "Missing rising in summary"
        assert "stable" in summary, "Missing stable in summary"
        
        print(f"[TEST] ✓ Panel endpoint returns all required fields")
        print(f"[TEST] ✓ myEffectiveness: returnedStudents={eff.get('returnedStudents')}, conversionRate={eff.get('conversionRate')}%")
        print(f"[TEST] ✓ summary: risk={summary.get('risk')}, rising={summary.get('rising')}, stable={summary.get('stable')}")

    def test_02_coach_kpi_endpoint(self, coach_token):
        """Test GET /api/coach/kpi returns sales data for performance screen"""
        print(f"\n[TEST] GET /api/coach/kpi")
        response = requests.get(
            f"{BASE_URL}/api/coach/kpi",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check for sales data (used in money card)
        assert "sales" in data, "Missing 'sales' field in kpi response"
        
        sales = data["sales"]
        # These fields are used in performance.tsx lines 176-184
        assert "monthSales" in sales or "monthSales" in data.get("myEffectiveness", {}), "Missing monthSales"
        assert "monthBonus" in sales or "monthBonus" in data.get("myEffectiveness", {}), "Missing monthBonus"
        
        print(f"[TEST] ✓ KPI endpoint returns sales data")
        print(f"[TEST] ✓ sales: {sales}")

    def test_03_coach_leaderboard_endpoint(self, coach_token):
        """Test GET /api/coach/leaderboard returns leaderboard data for performance screen"""
        print(f"\n[TEST] GET /api/coach/leaderboard")
        response = requests.get(
            f"{BASE_URL}/api/coach/leaderboard",
            headers={"Authorization": f"Bearer {coach_token}"},
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields for leaderboard preview
        assert "leaderboard" in data, "Missing 'leaderboard' field"
        assert "myRank" in data, "Missing 'myRank' field"
        assert "totalCoaches" in data, "Missing 'totalCoaches' field"
        
        leaderboard = data["leaderboard"]
        assert isinstance(leaderboard, list), "leaderboard must be a list"
        
        # Validate top 3 structure (if exists)
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            assert "rank" in entry, "Missing 'rank' in leaderboard entry"
            assert "name" in entry, "Missing 'name' in leaderboard entry"
            assert "score" in entry, "Missing 'score' in leaderboard entry"
            assert "studentsCount" in entry, "Missing 'studentsCount' in leaderboard entry"
            assert "fillRate" in entry, "Missing 'fillRate' in leaderboard entry"
            print(f"[TEST] ✓ Leaderboard entry structure valid: {entry}")
        
        my_rank = data["myRank"]
        total_coaches = data["totalCoaches"]
        
        print(f"[TEST] ✓ Leaderboard endpoint returns all required fields")
        print(f"[TEST] ✓ myRank={my_rank}, totalCoaches={total_coaches}, leaderboard entries={len(leaderboard)}")

    def test_04_parallel_fetch_simulation(self, coach_token):
        """Test that all 3 endpoints can be fetched in parallel (as done in performance.tsx)"""
        print(f"\n[TEST] Parallel fetch simulation (panel + kpi + leaderboard)")
        
        import concurrent.futures
        
        def fetch_endpoint(endpoint):
            response = requests.get(
                f"{BASE_URL}/api/{endpoint}",
                headers={"Authorization": f"Bearer {coach_token}"},
                timeout=10
            )
            return endpoint, response.status_code, response.json() if response.status_code == 200 else None
        
        endpoints = ["coach/panel", "coach/kpi", "coach/leaderboard"]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(fetch_endpoint, ep) for ep in endpoints]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # Verify all 3 succeeded
        for endpoint, status, data in results:
            print(f"[TEST] {endpoint}: status={status}, data_keys={list(data.keys()) if data else 'None'}")
            assert status == 200, f"{endpoint} failed with status {status}"
            assert data is not None, f"{endpoint} returned no data"
        
        print(f"[TEST] ✓ All 3 endpoints fetched successfully in parallel")

    def test_05_regression_mass_message_endpoint(self, coach_token):
        """Regression: POST /api/coach/mass-message still works"""
        print(f"\n[TEST] Regression: POST /api/coach/mass-message")
        
        # Test validation (text required) to verify endpoint still works
        response = requests.post(
            f"{BASE_URL}/api/coach/mass-message",
            headers={"Authorization": f"Bearer {coach_token}"},
            json={
                "groupId": "test_group",
                "text": "",  # Empty text should trigger validation
                "target": "both"
            },
            timeout=10
        )
        print(f"[TEST] Response status: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400 for empty text, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Missing 'error' field"
        
        print(f"[TEST] ✓ Mass message endpoint still works (validation active)")

    def test_06_performance_screen_data_completeness(self, coach_token):
        """Test that performance screen has all data needed for UI rendering"""
        print(f"\n[TEST] Performance screen data completeness check")
        
        # Fetch all 3 endpoints
        panel_res = requests.get(f"{BASE_URL}/api/coach/panel", headers={"Authorization": f"Bearer {coach_token}"}, timeout=10)
        kpi_res = requests.get(f"{BASE_URL}/api/coach/kpi", headers={"Authorization": f"Bearer {coach_token}"}, timeout=10)
        lb_res = requests.get(f"{BASE_URL}/api/coach/leaderboard", headers={"Authorization": f"Bearer {coach_token}"}, timeout=10)
        
        assert panel_res.status_code == 200, "Panel endpoint failed"
        assert kpi_res.status_code == 200, "KPI endpoint failed"
        assert lb_res.status_code == 200, "Leaderboard endpoint failed"
        
        panel = panel_res.json()
        kpi = kpi_res.json()
        lb = lb_res.json()
        
        # Verify data needed for each section of performance screen
        
        # 1. KPI section (4 cards)
        eff = panel.get("myEffectiveness", {})
        assert eff.get("returnedStudents") is not None, "Missing returnedStudents for KPI"
        assert eff.get("conversionRate") is not None, "Missing conversionRate for KPI"
        assert eff.get("upsellCount") is not None, "Missing upsellCount for KPI"
        assert eff.get("retentionScore") is not None, "Missing retentionScore for KPI"
        print(f"[TEST] ✓ KPI data complete")
        
        # 2. Money card (Дохід + Бонус)
        sales = kpi.get("sales", {})
        # Accept either from sales or from myEffectiveness
        has_month_sales = "monthSales" in sales or "monthSales" in eff
        has_month_bonus = "monthBonus" in sales or "monthBonus" in eff
        assert has_month_sales, "Missing monthSales for money card"
        assert has_month_bonus, "Missing monthBonus for money card"
        print(f"[TEST] ✓ Money card data complete")
        
        # 3. Динаміка (actionLog for written messages)
        action_log = panel.get("actionLog", [])
        assert isinstance(action_log, list), "actionLog must be a list"
        print(f"[TEST] ✓ Dynamics data complete (actionLog length: {len(action_log)})")
        
        # 4. Students by status
        summary = panel.get("summary", {})
        assert "risk" in summary, "Missing risk count"
        assert "rising" in summary, "Missing rising count"
        assert "stable" in summary, "Missing stable count"
        print(f"[TEST] ✓ Students by status data complete")
        
        # 5. Leaderboard preview
        leaderboard = lb.get("leaderboard", [])
        my_rank = lb.get("myRank")
        total_coaches = lb.get("totalCoaches")
        assert isinstance(leaderboard, list), "leaderboard must be a list"
        assert my_rank is not None, "Missing myRank"
        assert total_coaches is not None, "Missing totalCoaches"
        print(f"[TEST] ✓ Leaderboard preview data complete")
        
        print(f"[TEST] ✓ All performance screen data complete and valid")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
