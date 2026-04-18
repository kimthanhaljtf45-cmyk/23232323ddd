"""
ATAKA Backend Tests - SaaS Business Logic Overhaul
Tests for:
- GET /api/owner/club-plans (3 default plans)
- POST /api/owner/club-plans (create new plan)
- DELETE /api/owner/club-plans/{planId} (delete plan)
- GET /api/owner/financial-breakdown (financial breakdown with 7% commission for PRO)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL', 'https://code-docs-hub-1.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture(scope="session")
def owner_token():
    """Login as OWNER and get token (session-scoped to avoid rate limiting)"""
    # Request OTP
    otp_res = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "+380500000001"})
    assert otp_res.status_code in [200, 201], f"OTP request failed: {otp_res.text}"
    
    # Verify OTP
    verify_res = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "+380500000001", "code": "0000"})
    assert verify_res.status_code in [200, 201], f"OTP verify failed: {verify_res.text}"
    
    data = verify_res.json()
    token = data.get("accessToken") or data.get("token")
    assert token, "No token in response"
    return token

class TestClubPlans:
    """Test club plans (абонементі) CRUD"""
    
    def test_get_club_plans_returns_3_defaults(self, owner_token):
        """GET /api/owner/club-plans returns 3 default plans"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/club-plans", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        assert "plans" in data, "No plans field"
        plans = data["plans"]
        assert len(plans) >= 1, f"Expected at least 1 plan, got {len(plans)}"
        
        # Check plan structure
        for plan in plans:
            assert "id" in plan, "Plan missing id"
            assert "name" in plan, "Plan missing name"
            assert "price" in plan, "Plan missing price"
            assert "sessions" in plan, "Plan missing sessions"
        
        print(f"✓ GET /api/owner/club-plans returns {len(plans)} plans")
    
    def test_get_club_plans_returns_commission_percent(self, owner_token):
        """GET /api/owner/club-plans returns commissionPercent"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/club-plans", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        assert "commissionPercent" in data, "No commissionPercent field"
        commission = data["commissionPercent"]
        assert commission in [5, 7, 10], f"Invalid commission: {commission}"
        
        print(f"✓ Commission percent: {commission}%")
    
    def test_create_club_plan(self, owner_token):
        """POST /api/owner/club-plans creates new plan"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        payload = {
            "name": "TEST_16_тренувань",
            "price": 3500,
            "sessions": 16,
            "durationDays": 30
        }
        res = requests.post(f"{BASE_URL}/api/owner/club-plans", json=payload, headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True, "Success not true"
        assert "planId" in data, "No planId in response"
        
        # Verify plan was created
        get_res = requests.get(f"{BASE_URL}/api/owner/club-plans", headers=headers)
        assert get_res.status_code == 200
        plans = get_res.json().get("plans", [])
        created_plan = next((p for p in plans if p.get("name") == "TEST_16_тренувань"), None)
        assert created_plan is not None, "Created plan not found"
        assert created_plan["price"] == 3500, "Price mismatch"
        assert created_plan["sessions"] == 16, "Sessions mismatch"
        
        print(f"✓ POST /api/owner/club-plans created plan: {data.get('planId')}")
    
    def test_delete_club_plan(self, owner_token):
        """DELETE /api/owner/club-plans/{planId} deletes plan"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        
        # Create a plan to delete
        payload = {"name": "TEST_DELETE_план", "price": 1000, "sessions": 4}
        create_res = requests.post(f"{BASE_URL}/api/owner/club-plans", json=payload, headers=headers)
        assert create_res.status_code == 200
        plan_id = create_res.json().get("planId")
        
        # Delete the plan
        del_res = requests.delete(f"{BASE_URL}/api/owner/club-plans/{plan_id}", headers=headers)
        assert del_res.status_code == 200, f"Failed: {del_res.text}"
        
        data = del_res.json()
        assert data.get("success") == True, "Success not true"
        
        # Verify plan was deleted
        get_res = requests.get(f"{BASE_URL}/api/owner/club-plans", headers=headers)
        plans = get_res.json().get("plans", [])
        deleted_plan = next((p for p in plans if p.get("id") == plan_id), None)
        assert deleted_plan is None, "Plan still exists after delete"
        
        print(f"✓ DELETE /api/owner/club-plans/{plan_id} deleted successfully")

class TestFinancialBreakdown:
    """Test financial breakdown endpoint"""
    
    def test_financial_breakdown_returns_200(self, owner_token):
        """GET /api/owner/financial-breakdown returns 200"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/financial-breakdown", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        print(f"✓ GET /api/owner/financial-breakdown returns 200")
    
    def test_financial_breakdown_structure(self, owner_token):
        """GET /api/owner/financial-breakdown has correct structure"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/financial-breakdown", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        required_fields = [
            "grossTotal", "platformCommission", "netIncome", 
            "saasFee", "afterSaas", "commissionPercent", "plan"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Validate data types
        assert isinstance(data["grossTotal"], (int, float)), "grossTotal not numeric"
        assert isinstance(data["platformCommission"], (int, float)), "platformCommission not numeric"
        assert isinstance(data["netIncome"], (int, float)), "netIncome not numeric"
        assert isinstance(data["saasFee"], (int, float)), "saasFee not numeric"
        assert isinstance(data["afterSaas"], (int, float)), "afterSaas not numeric"
        assert isinstance(data["commissionPercent"], (int, float)), "commissionPercent not numeric"
        assert isinstance(data["plan"], str), "plan not string"
        
        print(f"✓ Financial breakdown structure valid: {list(data.keys())}")
    
    def test_financial_breakdown_commission_for_pro_plan(self, owner_token):
        """GET /api/owner/financial-breakdown shows 7% commission for PRO plan"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/financial-breakdown", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        plan = data.get("plan", "")
        commission = data.get("commissionPercent", 0)
        
        # Check commission mapping
        commission_map = {"START": 10, "PRO": 7, "ENTERPRISE": 5}
        expected_commission = commission_map.get(plan, 10)
        assert commission == expected_commission, f"Expected {expected_commission}% for {plan}, got {commission}%"
        
        print(f"✓ Plan: {plan}, Commission: {commission}% (expected: {expected_commission}%)")
    
    def test_financial_breakdown_calculations(self, owner_token):
        """Verify financial breakdown calculations are correct"""
        headers = {"Authorization": f"Bearer {owner_token}"}
        res = requests.get(f"{BASE_URL}/api/owner/financial-breakdown", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        
        data = res.json()
        gross = data["grossTotal"]
        commission_pct = data["commissionPercent"]
        platform_commission = data["platformCommission"]
        net_income = data["netIncome"]
        saas_fee = data["saasFee"]
        after_saas = data["afterSaas"]
        
        # Verify calculations
        expected_commission = round(gross * commission_pct / 100)
        assert platform_commission == expected_commission, f"Commission calc wrong: {platform_commission} != {expected_commission}"
        
        expected_net = gross - platform_commission
        assert net_income == expected_net, f"Net income calc wrong: {net_income} != {expected_net}"
        
        expected_after_saas = net_income - saas_fee
        assert after_saas == expected_after_saas, f"After SaaS calc wrong: {after_saas} != {expected_after_saas}"
        
        print(f"✓ Financial calculations correct: Gross={gross}, Commission={platform_commission}, Net={net_income}, SaaS={saas_fee}, AfterSaaS={after_saas}")
