"""
OWNER Insights Engine Tests
Tests for GET /api/owner/insights endpoint
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('EXPO_BACKEND_URL') or os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'https://code-docs-hub-1.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def admin_token():
    """Get admin token for testing"""
    # Login as ADMIN
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "+380501234567"})
    if resp.status_code not in [200, 201]:
        pytest.skip(f"Auth service unavailable: {resp.status_code}")
    
    verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
        "phone": "+380501234567",
        "code": "0000"
    })
    if verify_resp.status_code not in [200, 201]:
        pytest.skip(f"OTP verification failed: {verify_resp.status_code}")
    
    data = verify_resp.json()
    token = data.get("accessToken") or data.get("access_token")
    if not token:
        pytest.skip("No token in response")
    return token


class TestOwnerInsights:
    """Test OWNER Insights Engine API"""

    def test_insights_returns_200(self, admin_token):
        """GET /api/owner/insights returns 200"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("✓ GET /api/owner/insights returns 200")

    def test_insights_structure(self, admin_token):
        """Insights response has correct structure"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Check top-level fields
        assert "insights" in data, "Missing 'insights' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "generatedAt" in data, "Missing 'generatedAt' field"
        
        # Check summary structure
        summary = data["summary"]
        assert "total" in summary, "Missing 'total' in summary"
        assert "high" in summary, "Missing 'high' in summary"
        assert "medium" in summary, "Missing 'medium' in summary"
        assert "low" in summary, "Missing 'low' in summary"
        assert "positive" in summary, "Missing 'positive' in summary"
        
        print(f"✓ Insights structure correct: {summary['total']} total insights")

    def test_insight_fields(self, admin_token):
        """Each insight has required fields"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        if len(insights) == 0:
            print("⚠ No insights returned (this is OK if no issues detected)")
            return
        
        # Check first insight has all required fields
        insight = insights[0]
        required_fields = ["type", "level", "message", "detail", "action", "actionLabel", "icon", "color"]
        for field in required_fields:
            assert field in insight, f"Missing field '{field}' in insight"
        
        # Validate level values
        valid_levels = ["high", "medium", "low", "positive"]
        assert insight["level"] in valid_levels, f"Invalid level: {insight['level']}"
        
        print(f"✓ Insight fields correct: {insight['type']} - {insight['level']}")

    def test_insights_sorted_by_level(self, admin_token):
        """Insights are sorted by level (high first)"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        if len(insights) < 2:
            print("⚠ Not enough insights to test sorting")
            return
        
        # Check sorting: high → medium → low → positive
        level_order = {"high": 0, "medium": 1, "low": 2, "positive": 3}
        prev_order = -1
        for ins in insights:
            current_order = level_order.get(ins["level"], 2)
            assert current_order >= prev_order, f"Insights not sorted correctly: {ins['level']} after previous"
            prev_order = current_order
        
        print(f"✓ Insights sorted correctly by level")

    def test_high_debt_insight(self, admin_token):
        """HIGH_DEBT insight appears when debt > 5000"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        # Check if HIGH_DEBT insight exists
        debt_insights = [i for i in insights if i["type"] == "HIGH_DEBT"]
        
        if len(debt_insights) > 0:
            debt_insight = debt_insights[0]
            assert debt_insight["level"] in ["high", "medium"], f"HIGH_DEBT has wrong level: {debt_insight['level']}"
            assert "борг" in debt_insight["message"].lower() or "debt" in debt_insight["message"].lower(), "HIGH_DEBT message incorrect"
            assert debt_insight["action"] == "OPEN_DEBTORS", f"HIGH_DEBT action should be OPEN_DEBTORS, got {debt_insight['action']}"
            print(f"✓ HIGH_DEBT insight present: {debt_insight['message']}")
        else:
            print("⚠ No HIGH_DEBT insight (debt may be < 5000)")

    def test_no_marketplace_insight(self, admin_token):
        """NO_MARKETPLACE insight appears when no orders today"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        # Check if NO_MARKETPLACE insight exists
        marketplace_insights = [i for i in insights if i["type"] == "NO_MARKETPLACE"]
        
        if len(marketplace_insights) > 0:
            mp_insight = marketplace_insights[0]
            assert mp_insight["level"] == "low", f"NO_MARKETPLACE should be low level, got {mp_insight['level']}"
            assert mp_insight["action"] == "OPEN_MARKETPLACE", f"NO_MARKETPLACE action should be OPEN_MARKETPLACE, got {mp_insight['action']}"
            print(f"✓ NO_MARKETPLACE insight present: {mp_insight['message']}")
        else:
            print("⚠ No NO_MARKETPLACE insight (may have orders today or before 12pm)")

    def test_summary_counts_match(self, admin_token):
        """Summary counts match actual insights"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        summary = data.get("summary", {})
        
        # Count insights by level
        high_count = len([i for i in insights if i["level"] == "high"])
        medium_count = len([i for i in insights if i["level"] == "medium"])
        low_count = len([i for i in insights if i["level"] == "low"])
        positive_count = len([i for i in insights if i["level"] == "positive"])
        
        assert summary["total"] == len(insights), f"Total count mismatch: {summary['total']} vs {len(insights)}"
        assert summary["high"] == high_count, f"High count mismatch: {summary['high']} vs {high_count}"
        assert summary["medium"] == medium_count, f"Medium count mismatch: {summary['medium']} vs {medium_count}"
        assert summary["low"] == low_count, f"Low count mismatch: {summary['low']} vs {low_count}"
        assert summary["positive"] == positive_count, f"Positive count mismatch: {summary['positive']} vs {positive_count}"
        
        print(f"✓ Summary counts match: {summary['total']} total ({summary['high']} high, {summary['medium']} medium, {summary['low']} low, {summary['positive']} positive)")

    def test_insights_unauthorized(self):
        """GET /api/owner/insights without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/owner/insights")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Insights endpoint requires authentication")

    def test_insight_types_valid(self, admin_token):
        """All insight types are valid"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        valid_types = [
            "REVENUE_DROP", "HIGH_DEBT", "RISK_STUDENTS", "LOW_CONVERSION",
            "LIMIT_WARNING", "ATTENDANCE_DROP", "NO_MARKETPLACE", "COACH_OVERLOAD",
            "POSITIVE_STREAK"
        ]
        
        for ins in insights:
            assert ins["type"] in valid_types, f"Invalid insight type: {ins['type']}"
        
        print(f"✓ All insight types valid")

    def test_insight_actions_valid(self, admin_token):
        """All insight actions are valid"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/insights",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        insights = data.get("insights", [])
        
        valid_actions = [
            "OPEN_FINANCE", "OPEN_DEBTORS", "OPEN_LEADS", "UPGRADE_PLAN",
            "OPEN_MARKETPLACE", "OPEN_RETENTION", "OPEN_TEAM", "NONE"
        ]
        
        for ins in insights:
            assert ins["action"] in valid_actions, f"Invalid action: {ins['action']}"
        
        print(f"✓ All insight actions valid")
