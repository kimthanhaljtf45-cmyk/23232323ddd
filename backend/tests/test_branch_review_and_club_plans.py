"""
ATAKA Branch Review Flow + Per-Club Plans Tests (Iteration 11)
Tests for:
- POST /api/owner/clubs/create → PENDING_REVIEW
- GET /api/owner/branches → reviewStatus field
- GET /api/admin/branches/pending
- POST /api/admin/branches/{id}/approve
- POST /api/admin/branches/{id}/reject
- GET /api/owner/club-plans?clubId=xxx
- POST /api/owner/club-plans with clubId
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL', 'https://code-docs-hub-1.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def owner_token():
    """Get OWNER token"""
    phone = "+380500000001"
    code = "0000"
    
    # Skip send-otp, go directly to verify-otp (OTP bypass)
    response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
    if response.status_code == 201:
        data = response.json()
        return data.get("accessToken")
    pytest.skip(f"Cannot get OWNER token: {response.status_code} {response.text}")

@pytest.fixture
def admin_token():
    """Get ADMIN token"""
    phone = "+380501234567"
    code = "0000"
    
    response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code}, timeout=10)
    if response.status_code == 201:
        data = response.json()
        return data.get("accessToken")
    pytest.skip(f"Cannot get ADMIN token: {response.status_code} {response.text}")

@pytest.fixture
def owner_client(owner_token):
    """Authenticated OWNER API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {owner_token}"
    })
    return session

@pytest.fixture
def admin_client(admin_token):
    """Authenticated ADMIN API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


class TestBranchCreationFlow:
    """Test branch creation returns PENDING_REVIEW"""

    def test_create_branch_returns_pending_review(self, owner_client):
        """POST /api/owner/clubs/create should return status=PENDING_REVIEW"""
        payload = {
            "name": "TEST_ATAKA_Iteration11",
            "city": "TEST_Kyiv",
            "address": "TEST_Address 123"
        }
        
        response = owner_client.post(f"{BASE_URL}/api/owner/clubs/create", json=payload, timeout=10)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should have success=True"
        assert "clubId" in data, "Response should contain clubId"
        assert data.get("status") == "PENDING_REVIEW", f"Expected status=PENDING_REVIEW, got {data.get('status')}"
        assert "message" in data, "Response should contain message"
        
        print(f"✓ PASSED: Branch created with status=PENDING_REVIEW, clubId={data.get('clubId')}")
        return data.get("clubId")

    def test_create_branch_requires_name(self, owner_client):
        """POST /api/owner/clubs/create without name should return 400"""
        payload = {"city": "TEST_City"}
        
        response = owner_client.post(f"{BASE_URL}/api/owner/clubs/create", json=payload, timeout=10)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ PASSED: Create branch without name returns 400")


class TestOwnerBranchesAPI:
    """Test GET /api/owner/branches returns reviewStatus"""

    def test_owner_branches_returns_200(self, owner_client):
        """GET /api/owner/branches should return 200"""
        response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "branches" in data, "Response should contain 'branches' field"
        assert isinstance(data["branches"], list), "branches should be a list"
        
        print(f"✓ PASSED: GET /api/owner/branches returns {len(data['branches'])} branches")

    def test_owner_branches_have_review_status(self, owner_client):
        """Each branch should have reviewStatus field"""
        response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        branches = data.get("branches", [])
        
        if len(branches) > 0:
            branch = branches[0]
            assert "reviewStatus" in branch, "Branch should have 'reviewStatus' field"
            assert branch["reviewStatus"] in ["PENDING", "APPROVED", "REJECTED"], \
                f"reviewStatus should be PENDING/APPROVED/REJECTED, got {branch['reviewStatus']}"
            assert "status" in branch, "Branch should have 'status' field"
            assert "name" in branch, "Branch should have 'name' field"
            assert "id" in branch, "Branch should have 'id' field"
            
            print(f"✓ PASSED: Branch '{branch['name']}' has reviewStatus={branch['reviewStatus']}, status={branch['status']}")
        else:
            print("✓ PASSED: No branches found (valid state)")


class TestAdminBranchReview:
    """Test admin branch review endpoints"""

    def test_admin_pending_branches_returns_200(self, admin_client):
        """GET /api/admin/branches/pending should return 200"""
        response = admin_client.get(f"{BASE_URL}/api/admin/branches/pending", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "branches" in data, "Response should contain 'branches' field"
        assert "total" in data, "Response should contain 'total' field"
        assert isinstance(data["branches"], list), "branches should be a list"
        
        print(f"✓ PASSED: GET /api/admin/branches/pending returns {data['total']} pending branches")

    def test_admin_pending_branches_structure(self, admin_client):
        """Pending branches should have required fields"""
        response = admin_client.get(f"{BASE_URL}/api/admin/branches/pending", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        branches = data.get("branches", [])
        
        if len(branches) > 0:
            branch = branches[0]
            assert "id" in branch, "Branch should have 'id'"
            assert "name" in branch, "Branch should have 'name'"
            assert "city" in branch, "Branch should have 'city'"
            assert "ownerName" in branch, "Branch should have 'ownerName'"
            assert "plan" in branch, "Branch should have 'plan'"
            
            print(f"✓ PASSED: Pending branch structure valid: {branch['name']} by {branch['ownerName']}")
        else:
            print("✓ PASSED: No pending branches (valid state)")

    def test_admin_pending_requires_admin_role(self, owner_client):
        """GET /api/admin/branches/pending with OWNER token should return 403"""
        response = owner_client.get(f"{BASE_URL}/api/admin/branches/pending", timeout=10)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ PASSED: Admin endpoint requires ADMIN role (403 for OWNER)")


class TestBranchApprovalFlow:
    """Test branch approval and rejection"""

    def test_approve_branch_flow(self, owner_client, admin_client):
        """Full flow: Create branch → Admin approves → Status changes to ACTIVE"""
        # Step 1: Create branch as OWNER
        create_payload = {
            "name": "TEST_ATAKA_Approve_Flow",
            "city": "TEST_Lviv"
        }
        create_response = owner_client.post(f"{BASE_URL}/api/owner/clubs/create", json=create_payload, timeout=10)
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        
        create_data = create_response.json()
        club_id = create_data.get("clubId")
        assert club_id, "clubId should be returned"
        assert create_data.get("status") == "PENDING_REVIEW", "Initial status should be PENDING_REVIEW"
        
        print(f"✓ Step 1: Branch created with clubId={club_id}, status=PENDING_REVIEW")
        
        # Step 2: Admin approves
        approve_response = admin_client.post(f"{BASE_URL}/api/admin/branches/{club_id}/approve", timeout=10)
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.status_code} {approve_response.text}"
        
        approve_data = approve_response.json()
        assert approve_data.get("success") is True, "Approve should return success=True"
        
        print(f"✓ Step 2: Branch approved by admin")
        
        # Step 3: Verify branch status changed to ACTIVE and reviewStatus=APPROVED
        branches_response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        assert branches_response.status_code == 200
        
        branches_data = branches_response.json()
        approved_branch = None
        for b in branches_data.get("branches", []):
            if b.get("id") == club_id:
                approved_branch = b
                break
        
        assert approved_branch is not None, f"Branch {club_id} not found in owner branches"
        assert approved_branch.get("status") == "ACTIVE", f"Expected status=ACTIVE, got {approved_branch.get('status')}"
        assert approved_branch.get("reviewStatus") == "APPROVED", f"Expected reviewStatus=APPROVED, got {approved_branch.get('reviewStatus')}"
        
        print(f"✓ Step 3: Branch status verified: status=ACTIVE, reviewStatus=APPROVED")
        print(f"✓ PASSED: Full approval flow completed successfully")

    def test_reject_branch_flow(self, owner_client, admin_client):
        """Full flow: Create branch → Admin rejects → Status changes to REJECTED"""
        # Step 1: Create branch as OWNER
        create_payload = {
            "name": "TEST_ATAKA_Reject_Flow",
            "city": "TEST_Odesa"
        }
        create_response = owner_client.post(f"{BASE_URL}/api/owner/clubs/create", json=create_payload, timeout=10)
        assert create_response.status_code in [200, 201]
        
        create_data = create_response.json()
        club_id = create_data.get("clubId")
        assert club_id, "clubId should be returned"
        
        print(f"✓ Step 1: Branch created with clubId={club_id}")
        
        # Step 2: Admin rejects
        reject_payload = {"reason": "TEST: Invalid location"}
        reject_response = admin_client.post(f"{BASE_URL}/api/admin/branches/{club_id}/reject", json=reject_payload, timeout=10)
        assert reject_response.status_code == 200, f"Reject failed: {reject_response.status_code} {reject_response.text}"
        
        reject_data = reject_response.json()
        assert reject_data.get("success") is True, "Reject should return success=True"
        
        print(f"✓ Step 2: Branch rejected by admin")
        
        # Step 3: Verify branch status changed to REJECTED
        branches_response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        assert branches_response.status_code == 200
        
        branches_data = branches_response.json()
        rejected_branch = None
        for b in branches_data.get("branches", []):
            if b.get("id") == club_id:
                rejected_branch = b
                break
        
        assert rejected_branch is not None, f"Branch {club_id} not found"
        assert rejected_branch.get("reviewStatus") == "REJECTED", f"Expected reviewStatus=REJECTED, got {rejected_branch.get('reviewStatus')}"
        
        print(f"✓ Step 3: Branch status verified: reviewStatus=REJECTED")
        print(f"✓ PASSED: Full rejection flow completed successfully")

    def test_approve_requires_admin_role(self, owner_client):
        """POST /api/admin/branches/{id}/approve with OWNER token should return 403"""
        response = owner_client.post(f"{BASE_URL}/api/admin/branches/fake_id/approve", timeout=10)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ PASSED: Approve endpoint requires ADMIN role (403 for OWNER)")

    def test_reject_requires_admin_role(self, owner_client):
        """POST /api/admin/branches/{id}/reject with OWNER token should return 403"""
        response = owner_client.post(f"{BASE_URL}/api/admin/branches/fake_id/reject", json={"reason": "test"}, timeout=10)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ PASSED: Reject endpoint requires ADMIN role (403 for OWNER)")


class TestPerClubPlans:
    """Test per-club tariff plans"""

    def test_get_club_plans_returns_200(self, owner_client):
        """GET /api/owner/club-plans should return 200"""
        response = owner_client.get(f"{BASE_URL}/api/owner/club-plans", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' field"
        assert isinstance(data["plans"], list), "plans should be a list"
        assert "commissionPercent" in data, "Response should contain 'commissionPercent'"
        
        print(f"✓ PASSED: GET /api/owner/club-plans returns {len(data['plans'])} plans, commission={data['commissionPercent']}%")

    def test_get_club_plans_with_club_id(self, owner_client):
        """GET /api/owner/club-plans?clubId=xxx should filter by clubId"""
        # First get branches to get a valid clubId
        branches_response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        assert branches_response.status_code == 200
        
        branches = branches_response.json().get("branches", [])
        if len(branches) == 0:
            pytest.skip("No branches available to test club-specific plans")
        
        club_id = branches[0].get("id")
        
        # Get plans for specific club
        response = owner_client.get(f"{BASE_URL}/api/owner/club-plans?clubId={club_id}", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans'"
        
        print(f"✓ PASSED: GET /api/owner/club-plans?clubId={club_id} returns {len(data['plans'])} plans")

    def test_create_club_plan_for_specific_club(self, owner_client):
        """POST /api/owner/club-plans with clubId should create plan for specific club"""
        # First get a valid clubId
        branches_response = owner_client.get(f"{BASE_URL}/api/owner/branches", timeout=10)
        assert branches_response.status_code == 200
        
        branches = branches_response.json().get("branches", [])
        if len(branches) == 0:
            pytest.skip("No branches available to test club-specific plan creation")
        
        club_id = branches[0].get("id")
        
        # Create plan for specific club
        plan_payload = {
            "name": "TEST_Plan_Iteration11",
            "price": 2500,
            "sessions": 10,
            "durationDays": 30,
            "clubId": club_id
        }
        
        response = owner_client.post(f"{BASE_URL}/api/owner/club-plans", json=plan_payload, timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should have success=True"
        assert "planId" in data, "Response should contain planId"
        
        plan_id = data.get("planId")
        print(f"✓ PASSED: Created club plan for clubId={club_id}, planId={plan_id}")
        
        # Verify plan appears in GET /api/owner/club-plans?clubId=xxx
        get_response = owner_client.get(f"{BASE_URL}/api/owner/club-plans?clubId={club_id}", timeout=10)
        assert get_response.status_code == 200
        
        get_data = get_response.json()
        plans = get_data.get("plans", [])
        
        # Check if our plan is in the list
        found_plan = None
        for p in plans:
            if p.get("id") == plan_id or p.get("name") == "TEST_Plan_Iteration11":
                found_plan = p
                break
        
        assert found_plan is not None, f"Created plan {plan_id} not found in GET response"
        assert found_plan.get("clubId") == club_id, f"Plan clubId should be {club_id}, got {found_plan.get('clubId')}"
        
        print(f"✓ PASSED: Plan verified in GET response with clubId={club_id}")

    def test_create_club_plan_requires_name_and_price(self, owner_client):
        """POST /api/owner/club-plans without name or price should return 400"""
        # Missing name
        response1 = owner_client.post(f"{BASE_URL}/api/owner/club-plans", json={"price": 2000}, timeout=10)
        assert response1.status_code == 400, f"Expected 400 for missing name, got {response1.status_code}"
        
        # Missing price
        response2 = owner_client.post(f"{BASE_URL}/api/owner/club-plans", json={"name": "Test"}, timeout=10)
        assert response2.status_code == 400, f"Expected 400 for missing price, got {response2.status_code}"
        
        print("✓ PASSED: Create club plan requires name and price (400 validation)")

    def test_club_plans_require_auth(self):
        """GET /api/owner/club-plans without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/owner/club-plans", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ PASSED: Club plans endpoint requires authentication (401)")


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_branches(self, admin_client):
        """Clean up test branches created during testing"""
        # Get all pending branches
        response = admin_client.get(f"{BASE_URL}/api/admin/branches/pending", timeout=10)
        if response.status_code != 200:
            pytest.skip("Cannot get pending branches for cleanup")
        
        data = response.json()
        branches = data.get("branches", [])
        
        # Reject all TEST_ branches
        cleaned = 0
        for branch in branches:
            if branch.get("name", "").startswith("TEST_"):
                club_id = branch.get("id")
                reject_response = admin_client.post(
                    f"{BASE_URL}/api/admin/branches/{club_id}/reject",
                    json={"reason": "Test cleanup"},
                    timeout=10
                )
                if reject_response.status_code == 200:
                    cleaned += 1
        
        print(f"✓ Cleanup: Rejected {cleaned} test branches")
