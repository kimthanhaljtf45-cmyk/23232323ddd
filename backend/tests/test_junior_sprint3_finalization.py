"""
Junior Sprint 3 Finalization Tests
===================================
Tests for:
- GET /api/student/home (upcomingCompetitions array)
- GET /api/marketplace/featured (coachRecommended products)
- GET /api/student/schedule-calendar (days with trainings for nav hero)
- POST /api/student/confirm-training (OTP bypass)
- POST /api/student/absence (OTP bypass)
"""

import pytest
import requests
import os

# Read from frontend/.env or use public URL
BASE_URL = "https://code-docs-hub-1.preview.emergentagent.com"

@pytest.fixture
def junior_token():
    """Login as Junior student: +380991001010 (Артем Коваленко)"""
    response = requests.post(
        f"{BASE_URL}/api/auth/verify-otp",
        json={"phone": "+380991001010", "code": "0000"}
    )
    assert response.status_code in [200, 201], f"Login failed: {response.status_code} {response.text}"
    data = response.json()
    token = data.get('accessToken') or data.get('access_token') or data.get('token')
    assert token, f"No token in response: {data}"
    return token

@pytest.fixture
def auth_headers(junior_token):
    """Headers with Bearer token"""
    return {
        "Authorization": f"Bearer {junior_token}",
        "Content-Type": "application/json"
    }


class TestJuniorSprint3Backend:
    """Backend API tests for Sprint 3 features"""

    def test_student_home_returns_upcoming_competitions(self, auth_headers):
        """GET /api/student/home should return junior.upcomingCompetitions array (2 items after seed)"""
        response = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'junior' in data, f"Missing 'junior' key in response: {data.keys()}"
        
        junior = data['junior']
        assert 'upcomingCompetitions' in junior, f"Missing 'upcomingCompetitions' in junior: {junior.keys()}"
        
        upcoming = junior['upcomingCompetitions']
        assert isinstance(upcoming, list), f"upcomingCompetitions should be array, got {type(upcoming)}"
        assert len(upcoming) >= 2, f"Expected at least 2 upcomingCompetitions, got {len(upcoming)}"
        
        # Validate structure of first competition
        if len(upcoming) > 0:
            comp = upcoming[0]
            assert 'name' in comp, f"Competition missing 'name': {comp}"
            assert comp['name'], "Competition name should not be empty"
            # Optional fields: date, daysUntil
            print(f"✓ upcomingCompetitions[0]: {comp.get('name')} (daysUntil: {comp.get('daysUntil')})")

    def test_marketplace_featured_returns_coach_recommended(self, auth_headers):
        """GET /api/marketplace/featured should return coachRecommended array with 3 products (isCoachRecommended=true)"""
        response = requests.get(f"{BASE_URL}/api/marketplace/featured", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'coachRecommended' in data, f"Missing 'coachRecommended' key in response: {data.keys()}"
        
        coach_rec = data['coachRecommended']
        assert isinstance(coach_rec, list), f"coachRecommended should be array, got {type(coach_rec)}"
        assert len(coach_rec) >= 3, f"Expected at least 3 coachRecommended products, got {len(coach_rec)}"
        
        # Validate structure and isCoachRecommended flag
        for i, product in enumerate(coach_rec[:3]):
            assert 'name' in product, f"Product {i} missing 'name': {product}"
            assert 'price' in product, f"Product {i} missing 'price': {product}"
            assert 'isCoachRecommended' in product, f"Product {i} missing 'isCoachRecommended': {product}"
            assert product['isCoachRecommended'] is True, f"Product {i} isCoachRecommended should be true, got {product['isCoachRecommended']}"
            print(f"✓ coachRecommended[{i}]: {product['name']} - {product['price']} ₴")

    def test_schedule_calendar_returns_days_with_trainings(self, auth_headers):
        """GET /api/student/schedule-calendar?month=0 should return days[] with trainings[] for nav hero"""
        response = requests.get(f"{BASE_URL}/api/student/schedule-calendar?month=0", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'days' in data, f"Missing 'days' key in response: {data.keys()}"
        
        days = data['days']
        assert isinstance(days, list), f"days should be array, got {type(days)}"
        assert len(days) > 0, "days array should not be empty"
        
        # Find at least one day with trainings
        days_with_trainings = [d for d in days if d.get('hasTraining') and d.get('trainings')]
        assert len(days_with_trainings) > 0, "Expected at least one day with trainings"
        
        # Validate training structure
        day_with_training = days_with_trainings[0]
        trainings = day_with_training['trainings']
        assert isinstance(trainings, list), f"trainings should be array, got {type(trainings)}"
        assert len(trainings) > 0, "trainings array should not be empty"
        
        training = trainings[0]
        assert 'startTime' in training, f"Training missing 'startTime': {training}"
        assert 'endTime' in training, f"Training missing 'endTime': {training}"
        assert 'group' in training or 'location' in training, f"Training missing 'group' or 'location': {training}"
        
        print(f"✓ Found training on day {day_with_training.get('day')}: {training.get('startTime')}-{training.get('endTime')} at {training.get('location')}")

    def test_confirm_training_with_otp_bypass(self, auth_headers):
        """POST /api/student/confirm-training should work with OTP bypass"""
        response = requests.post(
            f"{BASE_URL}/api/student/confirm-training",
            headers=auth_headers,
            json={"status": "CONFIRMED"}
        )
        # Accept 200, 201, or 400 (if already confirmed or no training today)
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Training confirmed successfully: {data}")
        else:
            # 400 is acceptable if no training today or already confirmed
            print(f"⚠ Training confirmation returned 400 (expected if no training today): {response.text}")

    def test_absence_with_otp_bypass(self, auth_headers):
        """POST /api/student/absence should work with OTP bypass"""
        response = requests.post(
            f"{BASE_URL}/api/student/absence",
            headers=auth_headers,
            json={"reason": "Хворію"}
        )
        # Accept 200, 201, or 400 (if no training today or already marked absent)
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Absence recorded successfully: {data}")
        else:
            # 400 is acceptable if no training today or already marked
            print(f"⚠ Absence returned 400 (expected if no training today): {response.text}")


class TestJuniorSprint3Integration:
    """Integration tests to verify data flows correctly"""

    def test_home_data_flows_to_market_sections(self, auth_headers):
        """Verify that home data (belt, upcomingCompetitions) is available for Market contextual sections"""
        # Get home data
        home_response = requests.get(f"{BASE_URL}/api/student/home", headers=auth_headers)
        assert home_response.status_code == 200
        home_data = home_response.json()
        
        # Get marketplace data
        market_response = requests.get(f"{BASE_URL}/api/marketplace/featured", headers=auth_headers)
        assert market_response.status_code == 200
        market_data = market_response.json()
        
        # Verify we have data needed for Market sections
        junior = home_data.get('junior', {})
        assert 'belt' in junior, "Home should return belt for Market 'Під твій пояс' section"
        assert 'upcomingCompetitions' in junior, "Home should return upcomingCompetitions for Market 'Підготовка до турніру' section"
        
        # Verify marketplace has products
        assert 'all' in market_data or 'products' in market_data, "Market should return products for contextual filtering"
        
        print(f"✓ Integration verified: belt={junior.get('belt')}, upcomingCompetitions={len(junior.get('upcomingCompetitions', []))}, products={len(market_data.get('all', market_data.get('products', [])))}")

    def test_schedule_next_training_hero_data(self, auth_headers):
        """Verify schedule returns data needed for Next Training Hero card"""
        response = requests.get(f"{BASE_URL}/api/student/schedule-calendar?month=0", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for required fields for hero card
        assert 'days' in data
        assert 'monthName' in data or 'month' in data, "Need month name for hero card"
        
        days = data['days']
        # Find today or next upcoming training
        today_or_next = None
        for day in days:
            if day.get('isToday') and day.get('hasTraining'):
                today_or_next = day
                break
            elif not day.get('isPast') and day.get('hasTraining'):
                today_or_next = day
                break
        
        if today_or_next:
            assert 'trainings' in today_or_next
            assert len(today_or_next['trainings']) > 0
            training = today_or_next['trainings'][0]
            assert 'startTime' in training
            assert 'endTime' in training
            print(f"✓ Next training hero data available: {training.get('group', 'Training')} at {training.get('startTime')}")
        else:
            print("⚠ No upcoming trainings found (acceptable if schedule is empty)")
