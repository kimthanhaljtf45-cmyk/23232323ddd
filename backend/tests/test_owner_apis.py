"""
ATAKA OWNER Power Layer API Tests
Tests for OWNER dashboard APIs: cashflow, debtors, conversion, clubs, team management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL', 'https://code-docs-hub-1.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def admin_token():
    """Get ADMIN token (ADMIN can access owner endpoints)"""
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
def api_client(admin_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


class TestOwnerCashflow:
    """Test GET /api/owner/cashflow"""

    def test_cashflow_returns_200(self, api_client):
        """GET /api/owner/cashflow should return 200 with cashflow data"""
        response = api_client.get(f"{BASE_URL}/api/owner/cashflow", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "today" in data, "Response should contain 'today' field"
        assert "yesterday" in data, "Response should contain 'yesterday' field"
        assert "week" in data, "Response should contain 'week' field"
        assert "todayTransactions" in data, "Response should contain 'todayTransactions' field"
        
        # Validate data types
        assert isinstance(data["today"], (int, float)), "today should be a number"
        assert isinstance(data["yesterday"], (int, float)), "yesterday should be a number"
        assert isinstance(data["week"], (int, float)), "week should be a number"
        assert isinstance(data["todayTransactions"], int), "todayTransactions should be an integer"
        
        print(f"✓ Cashflow API passed: today={data['today']}, yesterday={data['yesterday']}, week={data['week']}, transactions={data['todayTransactions']}")

    def test_cashflow_daily_breakdown(self, api_client):
        """Cashflow should include daily breakdown for last 7 days"""
        response = api_client.get(f"{BASE_URL}/api/owner/cashflow", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "daily" in data, "Response should contain 'daily' field"
        assert isinstance(data["daily"], list), "daily should be a list"
        assert len(data["daily"]) == 7, f"daily should have 7 entries, got {len(data['daily'])}"
        
        # Validate daily structure
        for day in data["daily"]:
            assert "date" in day, "Each daily entry should have 'date'"
            assert "amount" in day, "Each daily entry should have 'amount'"
        
        print(f"✓ Cashflow daily breakdown passed: {len(data['daily'])} days")


class TestOwnerDebtors:
    """Test GET /api/owner/debtors"""

    def test_debtors_returns_200(self, api_client):
        """GET /api/owner/debtors should return 200 with debtors list"""
        response = api_client.get(f"{BASE_URL}/api/owner/debtors", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "debtors" in data, "Response should contain 'debtors' field"
        assert "totalDebt" in data, "Response should contain 'totalDebt' field"
        assert isinstance(data["debtors"], list), "debtors should be a list"
        assert isinstance(data["totalDebt"], (int, float)), "totalDebt should be a number"
        
        print(f"✓ Debtors API passed: {len(data['debtors'])} debtors, total debt={data['totalDebt']}")

    def test_debtors_structure(self, api_client):
        """Each debtor should have required fields"""
        response = api_client.get(f"{BASE_URL}/api/owner/debtors", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["debtors"]) > 0:
            debtor = data["debtors"][0]
            assert "childId" in debtor, "Debtor should have 'childId'"
            assert "childName" in debtor, "Debtor should have 'childName'"
            assert "debt" in debtor, "Debtor should have 'debt'"
            assert isinstance(debtor["debt"], (int, float)), "debt should be a number"
            print(f"✓ Debtor structure valid: {debtor['childName']} owes {debtor['debt']}")
        else:
            print("✓ No debtors found (valid state)")


class TestOwnerConversion:
    """Test GET /api/owner/conversion"""

    def test_conversion_returns_200(self, api_client):
        """GET /api/owner/conversion should return 200 with conversion stats"""
        response = api_client.get(f"{BASE_URL}/api/owner/conversion", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "totalLeads" in data, "Response should contain 'totalLeads'"
        assert "converted" in data, "Response should contain 'converted'"
        assert "conversionRate" in data, "Response should contain 'conversionRate'"
        
        # Validate data types
        assert isinstance(data["totalLeads"], int), "totalLeads should be an integer"
        assert isinstance(data["converted"], int), "converted should be an integer"
        assert isinstance(data["conversionRate"], (int, float)), "conversionRate should be a number"
        
        print(f"✓ Conversion API passed: {data['totalLeads']} leads, {data['converted']} converted, rate={data['conversionRate']}%")


class TestOwnerClubs:
    """Test GET /api/owner/clubs (multi-club support)"""

    def test_clubs_returns_200(self, api_client):
        """GET /api/owner/clubs should return 200 with clubs array"""
        response = api_client.get(f"{BASE_URL}/api/owner/clubs", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "clubs" in data, "Response should contain 'clubs' field"
        assert isinstance(data["clubs"], list), "clubs should be a list"
        assert len(data["clubs"]) > 0, "Should have at least one club"
        
        print(f"✓ Clubs API passed: {len(data['clubs'])} clubs found")

    def test_club_structure(self, api_client):
        """Each club should have required fields"""
        response = api_client.get(f"{BASE_URL}/api/owner/clubs", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["clubs"]) > 0:
            club = data["clubs"][0]
            assert "id" in club, "Club should have 'id'"
            assert "name" in club, "Club should have 'name'"
            assert "plan" in club, "Club should have 'plan'"
            assert "saasStatus" in club, "Club should have 'saasStatus'"
            assert "revenue" in club, "Club should have 'revenue'"
            assert "students" in club, "Club should have 'students'"
            assert "coaches" in club, "Club should have 'coaches'"
            print(f"✓ Club structure valid: {club['name']}, plan={club['plan']}, students={club['students']}")


class TestOwnerTeamManagement:
    """Test OWNER team management APIs"""

    def test_get_team_returns_200(self, api_client):
        """GET /api/owner/team should return 200 with team members"""
        response = api_client.get(f"{BASE_URL}/api/owner/team", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "members" in data, "Response should contain 'members' field"
        assert isinstance(data["members"], list), "members should be a list"
        
        print(f"✓ Team API passed: {len(data['members'])} team members")

    def test_invite_team_member(self, api_client):
        """POST /api/owner/team/invite should create new team member"""
        test_phone = "+380999999999"
        payload = {
            "phone": test_phone,
            "role": "COACH",
            "firstName": "TEST_Coach"
        }
        
        response = api_client.post(f"{BASE_URL}/api/owner/team/invite", json=payload, timeout=10)
        
        # Should return 201 (created) or 409 (already exists)
        assert response.status_code in [200, 201, 409], f"Expected 200/201/409, got {response.status_code}: {response.text}"
        
        data = response.json()
        if response.status_code in [200, 201]:
            assert "success" in data, "Response should contain 'success'"
            assert data["success"] is True, "success should be True"
            assert "userId" in data, "Response should contain 'userId'"
            print(f"✓ Team invite passed: userId={data.get('userId')}, isNew={data.get('isNew')}")
        else:
            # Already exists
            assert "error" in data or "alreadyMember" in data
            print(f"✓ Team invite: user already exists (expected)")

    def test_change_member_role(self, api_client):
        """PATCH /api/owner/team/{member_id}/role should change role"""
        # First get team to find a member
        team_response = api_client.get(f"{BASE_URL}/api/owner/team", timeout=10)
        if team_response.status_code != 200:
            pytest.skip("Cannot get team members")
        
        team_data = team_response.json()
        members = team_data.get("members", [])
        
        # Find a non-OWNER member
        test_member = None
        for m in members:
            if m.get("role") != "OWNER":
                test_member = m
                break
        
        if not test_member:
            pytest.skip("No non-OWNER members to test role change")
        
        member_id = test_member.get("id")
        current_role = test_member.get("role")
        new_role = "MANAGER" if current_role != "MANAGER" else "COACH"
        
        response = api_client.patch(
            f"{BASE_URL}/api/owner/team/{member_id}/role",
            json={"role": new_role},
            timeout=10
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True, "success should be True"
        assert data.get("newRole") == new_role, f"newRole should be {new_role}"
        print(f"✓ Role change passed: {member_id} changed from {current_role} to {new_role}")

    def test_remove_team_member(self, api_client):
        """DELETE /api/owner/team/{member_id} should remove member"""
        # First invite a test member
        test_phone = "+380888888888"
        invite_response = api_client.post(
            f"{BASE_URL}/api/owner/team/invite",
            json={"phone": test_phone, "role": "COACH", "firstName": "TEST_ToRemove"},
            timeout=10
        )
        
        if invite_response.status_code not in [200, 201, 409]:
            pytest.skip("Cannot create test member")
        
        # Get the member ID
        team_response = api_client.get(f"{BASE_URL}/api/owner/team", timeout=10)
        if team_response.status_code != 200:
            pytest.skip("Cannot get team")
        
        members = team_response.json().get("members", [])
        test_member = None
        for m in members:
            if m.get("phone") == test_phone and m.get("role") != "OWNER":
                test_member = m
                break
        
        if not test_member:
            pytest.skip("Test member not found")
        
        member_id = test_member.get("id")
        
        # Remove the member
        response = api_client.delete(f"{BASE_URL}/api/owner/team/{member_id}", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "success should be True"
        print(f"✓ Remove member passed: {member_id} removed")


class TestOwnerCreateBranch:
    """Test POST /api/owner/clubs/create"""

    def test_create_branch(self, api_client):
        """POST /api/owner/clubs/create should create new branch"""
        payload = {
            "name": "TEST_ATAKA_Branch",
            "city": "TEST_City"
        }
        
        response = api_client.post(f"{BASE_URL}/api/owner/clubs/create", json=payload, timeout=10)
        
        # Should return 200 or 201
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data or "clubId" in data or "message" in data, "Response should indicate success"
        print(f"✓ Create branch passed: {data}")


class TestOwnerUnauthorized:
    """Test that OWNER endpoints require authentication"""

    def test_cashflow_unauthorized(self):
        """GET /api/owner/cashflow without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/cashflow", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Cashflow unauthorized check passed")

    def test_debtors_unauthorized(self):
        """GET /api/owner/debtors without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/debtors", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Debtors unauthorized check passed")

    def test_conversion_unauthorized(self):
        """GET /api/owner/conversion without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/conversion", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Conversion unauthorized check passed")
