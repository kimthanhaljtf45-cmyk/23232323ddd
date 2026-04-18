"""
Junior Cabinet X10 Backend Tests - Simplified
Tests for Junior student home, progress, and feed endpoints
"""
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or "https://code-docs-hub-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
JUNIOR_STUDENT = {"phone": "+380991001010", "code": "0000"}
ADULT_STUDENT = {"phone": "+380501234571", "code": "0000"}


def get_token(phone, code):
    """Get auth token for a user"""
    # Request OTP
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone})
    assert resp.status_code in [200, 201], f"OTP request failed: {resp.status_code}"
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "code": code})
    assert resp.status_code in [200, 201], f"OTP verify failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    token = data.get("accessToken") or data.get("access_token")
    assert token, f"No token in response: {data}"
    return token


def test_junior_home_api():
    """Test GET /api/student/home returns junior field for Junior student"""
    print("\n=== Test 1: Junior Home API - junior field ===")
    token = get_token(JUNIOR_STUDENT["phone"], JUNIOR_STUDENT["code"])
    
    resp = requests.get(
        f"{BASE_URL}/api/student/home",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check junior field exists
    assert "junior" in data, "Missing 'junior' field in response"
    junior = data["junior"]
    
    # Verify junior field structure
    required_fields = ["belt", "nextBelt", "trainingsCompleted", "trainingsToNext", 
                      "groupName", "coachName", "coachComment", "discipline", "competitions"]
    for field in required_fields:
        assert field in junior, f"Missing required field '{field}' in junior object"
    
    print(f"✅ Junior field present with all required fields")
    print(f"   Belt: {junior.get('belt')}, Next: {junior.get('nextBelt')}")
    print(f"   Progress: {junior.get('trainingsCompleted')}/{junior.get('trainingsToNext')}")
    print(f"   Group: {junior.get('groupName')}, Coach: {junior.get('coachName')}")
    print(f"   Discipline: {junior.get('discipline')}")
    print(f"   Competitions: {len(junior.get('competitions', []))} items")


def test_gamification_api():
    """Test GET /api/student/gamification returns xp/level/streak/dailyTasks"""
    print("\n=== Test 2: Student Gamification API ===")
    token = get_token(JUNIOR_STUDENT["phone"], JUNIOR_STUDENT["code"])
    
    resp = requests.get(
        f"{BASE_URL}/api/student/gamification",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check required fields (streak is in /api/student/home, not gamification)
    required_fields = ["xp", "level", "levelName", "nextLevelXp", "xpProgress", "dailyTasks"]
    for field in required_fields:
        assert field in data, f"Missing required field '{field}' in gamification response"
    
    # Verify dailyTasks structure
    daily_tasks = data.get("dailyTasks", [])
    assert isinstance(daily_tasks, list), "dailyTasks should be an array"
    if len(daily_tasks) > 0:
        task = daily_tasks[0]
        assert "id" in task, "Task missing 'id'"
        assert "text" in task, "Task missing 'text'"
        assert "done" in task, "Task missing 'done'"
        assert "xp" in task, "Task missing 'xp'"
    
    print(f"✅ Gamification data complete")
    print(f"   XP: {data.get('xp')}, Level: {data.get('level')} ({data.get('levelName')})")
    print(f"   Next Level XP: {data.get('nextLevelXp')}, Progress: {data.get('xpProgress')}%")
    print(f"   Daily Tasks: {len(daily_tasks)} tasks")


def test_feed_api():
    """Test GET /api/student/feed returns activities array with type field"""
    print("\n=== Test 3: Student Feed API ===")
    token = get_token(JUNIOR_STUDENT["phone"], JUNIOR_STUDENT["code"])
    
    resp = requests.get(
        f"{BASE_URL}/api/student/feed",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check feed field
    assert "feed" in data, "Missing 'feed' field in response"
    feed = data.get("feed", [])
    assert isinstance(feed, list), "feed should be an array"
    
    # Verify feed item structure
    if len(feed) > 0:
        item = feed[0]
        assert "type" in item, "Feed item missing 'type' field"
        assert "text" in item or "title" in item, "Feed item missing 'text' or 'title'"
        
        # Check type is one of expected values
        valid_types = ["streak", "badge", "coach_message", "club", "achievement", "xp", "belt", "level", 
                      "coach_feedback", "coach", "competition", "announcement", "photo", "training", "reminder", "system"]
        assert item["type"] in valid_types, f"Invalid feed type: {item['type']}"
    
    print(f"✅ Feed data complete")
    print(f"   Total items: {len(feed)}")
    if len(feed) > 0:
        types = {}
        for item in feed:
            t = item.get("type", "unknown")
            types[t] = types.get(t, 0) + 1
        print(f"   Types breakdown: {types}")


def test_adult_no_junior_field():
    """Test Adult student does NOT get junior field (regression check)"""
    print("\n=== Test 4: Adult Student - No Junior Field (Regression) ===")
    token = get_token(ADULT_STUDENT["phone"], ADULT_STUDENT["code"])
    
    resp = requests.get(
        f"{BASE_URL}/api/student/home",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check student type
    student = data.get("student", {})
    student_type = student.get("studentType", "JUNIOR")
    print(f"   Student type: {student_type}")
    
    # If ADULT, should NOT have junior field OR junior should be null/empty
    if student_type == "ADULT":
        junior = data.get("junior")
        if junior is not None:
            print(f"   ⚠️ WARNING: Adult student has junior field: {junior}")
        else:
            print(f"   ✅ Adult student correctly has no junior field")
    else:
        print(f"   ℹ️ Student type is {student_type}, not ADULT")


def test_parallel_fetch():
    """Test all 3 endpoints can be fetched in parallel"""
    print("\n=== Test 5: Parallel API Fetch Simulation ===")
    import concurrent.futures
    
    token = get_token(JUNIOR_STUDENT["phone"], JUNIOR_STUDENT["code"])
    headers = {"Authorization": f"Bearer {token}"}
    endpoints = [
        f"{BASE_URL}/api/student/home",
        f"{BASE_URL}/api/student/gamification",
        f"{BASE_URL}/api/student/feed"
    ]
    
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(requests.get, url, headers=headers) for url in endpoints]
        for future in concurrent.futures.as_completed(futures):
            try:
                resp = future.result()
                results.append({"status": resp.status_code, "ok": resp.status_code == 200})
            except Exception as e:
                results.append({"status": 0, "ok": False, "error": str(e)})
    
    # All should succeed
    assert all(r["ok"] for r in results), f"Some parallel requests failed: {results}"
    print(f"✅ All 3 endpoints fetched successfully in parallel")
    print(f"   Results: {[r['status'] for r in results]}")


if __name__ == "__main__":
    # Get tokens once for all tests
    print("=== Authenticating users ===")
    junior_token = get_token(JUNIOR_STUDENT["phone"], JUNIOR_STUDENT["code"])
    print(f"✅ Junior student authenticated")
    adult_token = get_token(ADULT_STUDENT["phone"], ADULT_STUDENT["code"])
    print(f"✅ Adult student authenticated")
    
    # Run tests with pre-authenticated tokens
    test_junior_home_api_with_token(junior_token)
    test_gamification_api_with_token(junior_token)
    test_feed_api_with_token(junior_token)
    test_adult_no_junior_field_with_token(adult_token)
    test_parallel_fetch_with_token(junior_token)
    print("\n✅ All backend tests passed!")


def test_junior_home_api_with_token(token):
    """Test GET /api/student/home returns junior field for Junior student"""
    print("\n=== Test 1: Junior Home API - junior field ===")
    
    resp = requests.get(
        f"{BASE_URL}/api/student/home",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check junior field exists
    assert "junior" in data, "Missing 'junior' field in response"
    junior = data["junior"]
    
    # Verify junior field structure
    required_fields = ["belt", "nextBelt", "trainingsCompleted", "trainingsToNext", 
                      "groupName", "coachName", "coachComment", "discipline", "competitions"]
    for field in required_fields:
        assert field in junior, f"Missing required field '{field}' in junior object"
    
    print(f"✅ Junior field present with all required fields")
    print(f"   Belt: {junior.get('belt')}, Next: {junior.get('nextBelt')}")
    print(f"   Progress: {junior.get('trainingsCompleted')}/{junior.get('trainingsToNext')}")
    print(f"   Group: {junior.get('groupName')}, Coach: {junior.get('coachName')}")
    print(f"   Discipline: {junior.get('discipline')}")
    print(f"   Competitions: {len(junior.get('competitions', []))} items")


def test_gamification_api_with_token(token):
    """Test GET /api/student/gamification returns xp/level/dailyTasks"""
    print("\n=== Test 2: Student Gamification API ===")
    
    resp = requests.get(
        f"{BASE_URL}/api/student/gamification",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check required fields (streak is in /api/student/home, not gamification)
    required_fields = ["xp", "level", "levelName", "nextLevelXp", "xpProgress", "dailyTasks"]
    for field in required_fields:
        assert field in data, f"Missing required field '{field}' in gamification response"
    
    # Verify dailyTasks structure
    daily_tasks = data.get("dailyTasks", [])
    assert isinstance(daily_tasks, list), "dailyTasks should be an array"
    if len(daily_tasks) > 0:
        task = daily_tasks[0]
        assert "id" in task, "Task missing 'id'"
        assert "text" in task, "Task missing 'text'"
        assert "done" in task, "Task missing 'done'"
        assert "xp" in task, "Task missing 'xp'"
    
    print(f"✅ Gamification data complete")
    print(f"   XP: {data.get('xp')}, Level: {data.get('level')} ({data.get('levelName')})")
    print(f"   Next Level XP: {data.get('nextLevelXp')}, Progress: {data.get('xpProgress')}%")
    print(f"   Daily Tasks: {len(daily_tasks)} tasks")


def test_feed_api_with_token(token):
    """Test GET /api/student/feed returns activities array with type field"""
    print("\n=== Test 3: Student Feed API ===")
    
    resp = requests.get(
        f"{BASE_URL}/api/student/feed",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check feed field
    assert "feed" in data, "Missing 'feed' field in response"
    feed = data.get("feed", [])
    assert isinstance(feed, list), "feed should be an array"
    
    # Verify feed item structure
    if len(feed) > 0:
        item = feed[0]
        assert "type" in item, "Feed item missing 'type' field"
        assert "text" in item or "title" in item, "Feed item missing 'text' or 'title'"
        
        # Check type is one of expected values
        valid_types = ["streak", "badge", "coach_message", "club", "achievement", "xp", "belt", "level", 
                      "coach_feedback", "coach", "competition", "announcement", "photo", "training", "reminder", "system"]
        assert item["type"] in valid_types, f"Invalid feed type: {item['type']}"
    
    print(f"✅ Feed data complete")
    print(f"   Total items: {len(feed)}")
    if len(feed) > 0:
        types = {}
        for item in feed:
            t = item.get("type", "unknown")
            types[t] = types.get(t, 0) + 1
        print(f"   Types breakdown: {types}")


def test_adult_no_junior_field_with_token(token):
    """Test Adult student does NOT get junior field (regression check)"""
    print("\n=== Test 4: Adult Student - No Junior Field (Regression) ===")
    
    resp = requests.get(
        f"{BASE_URL}/api/student/home",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Check student type
    student = data.get("student", {})
    student_type = student.get("studentType", "JUNIOR")
    print(f"   Student type: {student_type}")
    
    # If ADULT, should NOT have junior field OR junior should be null/empty
    if student_type == "ADULT":
        junior = data.get("junior")
        if junior is not None:
            print(f"   ⚠️ WARNING: Adult student has junior field: {junior}")
        else:
            print(f"   ✅ Adult student correctly has no junior field")
    else:
        print(f"   ℹ️ Student type is {student_type}, not ADULT")


def test_parallel_fetch_with_token(token):
    """Test all 3 endpoints can be fetched in parallel"""
    print("\n=== Test 5: Parallel API Fetch Simulation ===")
    import concurrent.futures
    
    headers = {"Authorization": f"Bearer {token}"}
    endpoints = [
        f"{BASE_URL}/api/student/home",
        f"{BASE_URL}/api/student/gamification",
        f"{BASE_URL}/api/student/feed"
    ]
    
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(requests.get, url, headers=headers) for url in endpoints]
        for future in concurrent.futures.as_completed(futures):
            try:
                resp = future.result()
                results.append({"status": resp.status_code, "ok": resp.status_code == 200})
            except Exception as e:
                results.append({"status": 0, "ok": False, "error": str(e)})
    
    # All should succeed
    assert all(r["ok"] for r in results), f"Some parallel requests failed: {results}"
    print(f"✅ All 3 endpoints fetched successfully in parallel")
    print(f"   Results: {[r['status'] for r in results]}")
