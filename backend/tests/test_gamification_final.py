"""
АТАКА CRM - Gamification Engine Tests (Final Layer)
Tests: XP system, Levels, Badges, Daily Tasks, Rewards, Behavior detection, Owner analytics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or "https://code-docs-hub-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

class TestGamificationBackend:
    """Test gamification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as JUNIOR student"""
        # Login JUNIOR student
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "+380991001010", "code": "0000"})
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.text}"
        data = resp.json()
        self.junior_token = data.get("accessToken") or data.get("access_token")
        assert self.junior_token, "No access token for JUNIOR"
        
        # Login ADULT student
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "+380991001020", "code": "0000"})
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.text}"
        data = resp.json()
        self.adult_token = data.get("accessToken") or data.get("access_token")
        assert self.adult_token, "No access token for ADULT"
        
        # Login OWNER for analytics
        resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "+380500000001", "code": "0000"})
        assert resp.status_code in [200, 201], f"OTP verify failed: {resp.text}"
        data = resp.json()
        self.owner_token = data.get("accessToken") or data.get("access_token")
        assert self.owner_token, "No access token for OWNER"
    
    def test_01_student_home_includes_gamification_object(self):
        """GET /api/student/home includes gamification object"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        assert "gamification" in data, "Missing gamification object"
        gam = data["gamification"]
        
        # Check required fields
        assert "xp" in gam, "Missing xp"
        assert "level" in gam, "Missing level"
        assert "levelName" in gam, "Missing levelName"
        assert "xpProgress" in gam, "Missing xpProgress"
        assert "behavior" in gam, "Missing behavior"
        assert "newBadges" in gam, "Missing newBadges"
        
        # Validate types
        assert isinstance(gam["xp"], int), "xp should be int"
        assert isinstance(gam["level"], int), "level should be int"
        assert isinstance(gam["levelName"], str), "levelName should be str"
        assert isinstance(gam["xpProgress"], (int, float)), "xpProgress should be number"
        assert isinstance(gam["behavior"], str), "behavior should be str"
        assert isinstance(gam["newBadges"], list), "newBadges should be list"
        
        # Validate behavior is one of expected types
        assert gam["behavior"] in ["active", "disciplined", "lazy", "dropping"], f"Invalid behavior: {gam['behavior']}"
        
        print(f"✓ Gamification object: xp={gam['xp']}, level={gam['level']} ({gam['levelName']}), behavior={gam['behavior']}, progress={gam['xpProgress']}%")
    
    def test_02_student_home_includes_rewards_array(self):
        """GET /api/student/home includes rewards array"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        assert "rewards" in data, "Missing rewards array"
        rewards = data["rewards"]
        assert isinstance(rewards, list), "rewards should be list"
        
        # If rewards exist, validate structure
        if len(rewards) > 0:
            r = rewards[0]
            assert "id" in r, "Reward missing id"
            assert "name" in r, "Reward missing name"
            assert "xpCost" in r, "Reward missing xpCost"
            print(f"✓ Rewards array: {len(rewards)} rewards available (e.g., {r['name']} - {r['xpCost']} XP)")
        else:
            print(f"✓ Rewards array: 0 rewards (student may not have enough XP yet)")
    
    def test_03_student_gamification_full_data(self):
        """GET /api/student/gamification returns full data"""
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Check all required fields
        assert "xp" in data, "Missing xp"
        assert "level" in data, "Missing level"
        assert "levelName" in data, "Missing levelName"
        assert "dailyTasks" in data, "Missing dailyTasks"
        assert "badges" in data, "Missing badges"
        assert "rewards" in data, "Missing rewards"
        assert "behavior" in data, "Missing behavior"
        
        # Validate types
        assert isinstance(data["xp"], int), "xp should be int"
        assert isinstance(data["level"], int), "level should be int"
        assert isinstance(data["dailyTasks"], list), "dailyTasks should be list"
        assert isinstance(data["badges"], list), "badges should be list"
        assert isinstance(data["rewards"], list), "rewards should be list"
        
        print(f"✓ Full gamification: xp={data['xp']}, level={data['level']}, {len(data['dailyTasks'])} tasks, {len(data['badges'])} badges, {len(data['rewards'])} rewards")
    
    def test_04_daily_tasks_structure(self):
        """GET /api/student/gamification dailyTasks has 3 tasks with done boolean and xp"""
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        tasks = data.get("dailyTasks", [])
        assert len(tasks) == 3, f"Expected 3 daily tasks, got {len(tasks)}"
        
        # Check each task structure
        for task in tasks:
            assert "id" in task, "Task missing id"
            assert "text" in task, "Task missing text"
            assert "done" in task, "Task missing done"
            assert "xp" in task, "Task missing xp"
            
            assert isinstance(task["done"], bool), f"Task {task['id']} done should be bool"
            assert isinstance(task["xp"], int), f"Task {task['id']} xp should be int"
        
        # Check expected task IDs
        task_ids = [t["id"] for t in tasks]
        assert "open_app" in task_ids, "Missing open_app task"
        assert "confirm_training" in task_ids, "Missing confirm_training task"
        assert "write_coach" in task_ids, "Missing write_coach task"
        
        done_count = sum(1 for t in tasks if t["done"])
        print(f"✓ Daily tasks: 3 tasks found, {done_count} completed")
        for t in tasks:
            print(f"  - {t['text']}: {'✓' if t['done'] else '✗'} (+{t['xp']} XP)")
    
    def test_05_claim_reward_deducts_xp(self):
        """POST /api/student/claim-reward deducts XP and creates coupon"""
        # First get current XP
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200
        initial_xp = resp.json().get("xp", 0)
        
        # Try to claim a reward (discount_5 costs 50 XP)
        resp = requests.post(
            f"{BASE_URL}/api/student/claim-reward",
            headers={"authorization": f"Bearer {self.junior_token}"},
            json={"rewardId": "discount_5"}
        )
        
        # If student doesn't have enough XP, expect 400
        if initial_xp < 50:
            assert resp.status_code == 400, f"Expected 400 for insufficient XP, got {resp.status_code}"
            data = resp.json()
            assert "error" in data or "Недостатньо" in str(data), "Should return error for insufficient XP"
            print(f"✓ Claim reward: Correctly rejected (insufficient XP: {initial_xp} < 50)")
        else:
            # If enough XP, should succeed
            assert resp.status_code == 200, f"Failed: {resp.text}"
            data = resp.json()
            
            assert "success" in data or "discount" in data, "Missing success/discount in response"
            assert "xpLeft" in data or "xpSpent" in data, "Missing XP info in response"
            
            if "xpLeft" in data:
                assert data["xpLeft"] == initial_xp - 50, f"XP not deducted correctly: {data['xpLeft']} != {initial_xp - 50}"
            
            print(f"✓ Claim reward: Success! XP: {initial_xp} → {data.get('xpLeft', 'N/A')}, discount: {data.get('discount', 'N/A')}%")
    
    def test_06_owner_student_analytics(self):
        """GET /api/owner/student-analytics returns analytics"""
        resp = requests.get(
            f"{BASE_URL}/api/owner/student-analytics",
            headers={"authorization": f"Bearer {self.owner_token}"}
        )
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Check required fields
        assert "totalStudents" in data, "Missing totalStudents"
        assert "avgStreak" in data, "Missing avgStreak"
        assert "avgXp" in data, "Missing avgXp"
        assert "behaviorDistribution" in data, "Missing behaviorDistribution"
        assert "xpDistribution" in data, "Missing xpDistribution"
        
        # Validate types
        assert isinstance(data["totalStudents"], int), "totalStudents should be int"
        assert isinstance(data["avgStreak"], (int, float)), "avgStreak should be number"
        assert isinstance(data["avgXp"], int), "avgXp should be int"
        assert isinstance(data["behaviorDistribution"], dict), "behaviorDistribution should be dict"
        assert isinstance(data["xpDistribution"], dict), "xpDistribution should be dict"
        
        # Check behavior distribution keys
        behavior_dist = data["behaviorDistribution"]
        assert "active" in behavior_dist, "Missing 'active' in behaviorDistribution"
        assert "disciplined" in behavior_dist, "Missing 'disciplined' in behaviorDistribution"
        assert "lazy" in behavior_dist, "Missing 'lazy' in behaviorDistribution"
        assert "dropping" in behavior_dist, "Missing 'dropping' in behaviorDistribution"
        
        # Check XP distribution keys
        xp_dist = data["xpDistribution"]
        assert "0-50" in xp_dist, "Missing '0-50' in xpDistribution"
        assert "50-150" in xp_dist, "Missing '50-150' in xpDistribution"
        assert "150-500" in xp_dist, "Missing '150-500' in xpDistribution"
        assert "500+" in xp_dist, "Missing '500+' in xpDistribution"
        
        print(f"✓ Owner analytics: {data['totalStudents']} students, avgStreak={data['avgStreak']}, avgXp={data['avgXp']}")
        print(f"  Behavior: active={behavior_dist['active']}, disciplined={behavior_dist['disciplined']}, lazy={behavior_dist['lazy']}, dropping={behavior_dist['dropping']}")
        print(f"  XP ranges: 0-50={xp_dist['0-50']}, 50-150={xp_dist['50-150']}, 150-500={xp_dist['150-500']}, 500+={xp_dist['500+']}")
    
    def test_07_behavior_detection_active(self):
        """Behavior detection returns valid type"""
        resp = requests.get(
            f"{BASE_URL}/api/student/gamification",
            headers={"authorization": f"Bearer {self.junior_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        behavior = data.get("behavior", "")
        assert behavior in ["active", "disciplined", "lazy", "dropping"], f"Invalid behavior: {behavior}"
        
        behavior_label = data.get("behaviorLabel", "")
        assert isinstance(behavior_label, str), "behaviorLabel should be string"
        
        print(f"✓ Behavior detection: {behavior} ({behavior_label})")
    
    def test_08_adult_student_gamification(self):
        """ADULT student also has gamification"""
        resp = requests.get(
            f"{BASE_URL}/api/student/home",
            headers={"authorization": f"Bearer {self.adult_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        assert "gamification" in data, "ADULT missing gamification"
        gam = data["gamification"]
        assert "xp" in gam and "level" in gam and "behavior" in gam
        
        print(f"✓ ADULT gamification: xp={gam['xp']}, level={gam['level']}, behavior={gam['behavior']}")
    
    def test_09_unauthorized_gamification(self):
        """Unauthorized access returns 401"""
        resp = requests.get(f"{BASE_URL}/api/student/gamification")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized access correctly blocked")
    
    def test_10_unauthorized_claim_reward(self):
        """Unauthorized claim-reward returns 401"""
        resp = requests.post(
            f"{BASE_URL}/api/student/claim-reward",
            json={"rewardId": "discount_5"}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ Unauthorized claim-reward correctly blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
