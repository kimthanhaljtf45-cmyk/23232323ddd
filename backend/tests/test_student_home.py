"""
Backend tests for STUDENT role restructure
Tests /api/student/home endpoint for JUNIOR and ADULT student types
"""
import pytest
import requests
import os

# Read from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return "https://code-docs-hub-1.preview.emergentagent.com"

BASE_URL = get_backend_url()

class TestStudentHome:
    """Test student home endpoint for both JUNIOR and ADULT tracks"""
    
    @pytest.fixture(scope="class")
    def junior_token(self):
        """Login as JUNIOR student and get token"""
        # Skip request-otp, go directly to verify-otp (OTP bypass)
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380991001010",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        return data["accessToken"]
    
    @pytest.fixture(scope="class")
    def adult_token(self):
        """Login as ADULT student and get token"""
        # Skip request-otp, go directly to verify-otp (OTP bypass)
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+380991001020",
            "code": "0000"
        })
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "accessToken" in data, "No accessToken in response"
        return data["accessToken"]
    
    def test_01_junior_student_home_returns_junior_data(self, junior_token):
        """GET /api/student/home for JUNIOR student returns junior-specific data"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ JUNIOR student home response: {data.keys()}")
        
        # Check student info
        assert "student" in data, "Missing student field"
        assert data["student"]["studentType"] == "JUNIOR", f"Expected JUNIOR, got {data['student'].get('studentType')}"
        print(f"✓ Student type: {data['student']['studentType']}")
        
        # Check JUNIOR-specific data
        assert "junior" in data, "Missing junior field for JUNIOR student"
        junior = data["junior"]
        
        # Belt data
        assert "belt" in junior, "Missing belt in junior data"
        assert "nextBelt" in junior, "Missing nextBelt in junior data"
        assert "progressPercent" in junior, "Missing progressPercent in junior data"
        print(f"✓ Belt: {junior['belt']}, Next: {junior['nextBelt']}, Progress: {junior['progressPercent']}%")
        
        # Coach data
        assert "coachName" in junior, "Missing coachName in junior data"
        assert "groupName" in junior, "Missing groupName in junior data"
        assert "coachComment" in junior, "Missing coachComment in junior data"
        print(f"✓ Coach: {junior['coachName']}, Group: {junior['groupName']}")
        print(f"✓ Coach comment: {junior['coachComment'][:50]}...")
        
        # Competitions
        assert "competitions" in junior, "Missing competitions in junior data"
        print(f"✓ Competitions: {len(junior['competitions'])} entries")
        
        # Discipline
        assert "discipline" in junior, "Missing discipline in junior data"
        print(f"✓ Discipline: {junior['discipline']}")
        
        # Common data
        assert "stats" in data, "Missing stats"
        assert "subscription" in data, "Missing subscription"
        assert "upcomingSchedule" in data, "Missing upcomingSchedule"
        print(f"✓ Stats: attendance={data['stats'].get('attendanceRate')}%, streak={data['stats'].get('streak')}")
        
        # Should NOT have adult data
        assert "adult" not in data, "JUNIOR student should not have adult data"
        print("✓ No adult data present (correct)")
    
    def test_02_adult_student_home_returns_adult_data(self, adult_token):
        """GET /api/student/home for ADULT student returns adult-specific data"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {adult_token}"}
        )
        assert resp.status_code == 200, f"Student home failed: {resp.status_code} {resp.text}"
        
        data = resp.json()
        print(f"✓ ADULT student home response: {data.keys()}")
        
        # Check student info
        assert "student" in data, "Missing student field"
        assert data["student"]["studentType"] == "ADULT", f"Expected ADULT, got {data['student'].get('studentType')}"
        print(f"✓ Student type: {data['student']['studentType']}")
        
        # Check ADULT-specific data
        assert "adult" in data, "Missing adult field for ADULT student"
        adult = data["adult"]
        
        # Streak
        assert "streak" in adult, "Missing streak in adult data"
        print(f"✓ Streak: {adult['streak']} trainings")
        
        # Monthly goal
        assert "monthlyGoal" in adult, "Missing monthlyGoal in adult data"
        assert "monthlyAttended" in adult, "Missing monthlyAttended in adult data"
        assert "monthlyProgressPct" in adult, "Missing monthlyProgressPct in adult data"
        print(f"✓ Monthly goal: {adult['monthlyAttended']}/{adult['monthlyGoal']} ({adult['monthlyProgressPct']}%)")
        
        # Skills
        assert "skills" in adult, "Missing skills in adult data"
        assert isinstance(adult["skills"], list), "Skills should be a list"
        print(f"✓ Skills: {len(adult['skills'])} skills tracked")
        if adult["skills"]:
            skill = adult["skills"][0]
            assert "name" in skill, "Skill missing name"
            assert "level" in skill, "Skill missing level"
            assert "maxLevel" in skill, "Skill missing maxLevel"
            print(f"  - {skill['name']}: {skill['level']}/{skill['maxLevel']}")
        
        # Coach recommendation
        assert "coachRecommendation" in adult, "Missing coachRecommendation in adult data"
        print(f"✓ Coach recommendation: {adult['coachRecommendation'][:50]}...")
        
        # Fitness goal
        assert "fitnessGoal" in adult, "Missing fitnessGoal in adult data"
        print(f"✓ Fitness goal: {adult['fitnessGoal']}")
        
        # Common data
        assert "stats" in data, "Missing stats"
        assert "subscription" in data, "Missing subscription"
        assert "upcomingSchedule" in data, "Missing upcomingSchedule"
        print(f"✓ Stats: attendance={data['stats'].get('attendanceRate')}%, streak={data['stats'].get('streak')}")
        
        # Should NOT have junior data
        assert "junior" not in data, "ADULT student should not have junior data"
        print("✓ No junior data present (correct)")
    
    def test_03_junior_student_has_common_fields(self, junior_token):
        """Verify JUNIOR student home has all common fields"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {junior_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Subscription
        if data.get("subscription"):
            sub = data["subscription"]
            assert "planName" in sub, "Subscription missing planName"
            assert "price" in sub, "Subscription missing price"
            assert "status" in sub, "Subscription missing status"
            print(f"✓ Subscription: {sub['planName']} - {sub['price']} ₴ ({sub['status']})")
        
        # Upcoming schedule
        assert isinstance(data["upcomingSchedule"], list), "upcomingSchedule should be a list"
        print(f"✓ Upcoming schedule: {len(data['upcomingSchedule'])} sessions")
        
        # Stats
        stats = data["stats"]
        assert "attendanceRate" in stats, "Stats missing attendanceRate"
        assert "totalTrainings" in stats, "Stats missing totalTrainings"
        assert "streak" in stats, "Stats missing streak"
        print(f"✓ Stats complete: {stats}")
        
        # Alerts
        assert "alerts" in data, "Missing alerts field"
        print(f"✓ Alerts: {len(data['alerts'])} alerts")
    
    def test_04_adult_student_has_common_fields(self, adult_token):
        """Verify ADULT student home has all common fields"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"Authorization": f"Bearer {adult_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Subscription
        if data.get("subscription"):
            sub = data["subscription"]
            assert "planName" in sub, "Subscription missing planName"
            assert "price" in sub, "Subscription missing price"
            assert "status" in sub, "Subscription missing status"
            print(f"✓ Subscription: {sub['planName']} - {sub['price']} ₴ ({sub['status']})")
        
        # Upcoming schedule
        assert isinstance(data["upcomingSchedule"], list), "upcomingSchedule should be a list"
        print(f"✓ Upcoming schedule: {len(data['upcomingSchedule'])} sessions")
        
        # Stats
        stats = data["stats"]
        assert "attendanceRate" in stats, "Stats missing attendanceRate"
        assert "totalTrainings" in stats, "Stats missing totalTrainings"
        assert "streak" in stats, "Stats missing streak"
        print(f"✓ Stats complete: {stats}")
        
        # Alerts
        assert "alerts" in data, "Missing alerts field"
        print(f"✓ Alerts: {len(data['alerts'])} alerts")
    
    def test_05_unauthorized_access_blocked(self):
        """Verify /api/student/home requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/student/home")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized access correctly blocked")
