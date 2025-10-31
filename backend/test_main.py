"""Tests for the backend API."""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.main import app

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

client = TestClient(app)


def test_root_endpoint():
    """Test the root endpoint returns API information"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert "endpoints" in data


def test_health_endpoint():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_matching_endpoint_defaults():
    """Test matching endpoint with default parameters"""
    response = client.post("/matching", json={})
    assert response.status_code == 200
    data = response.json()
    
    # Check all categories are present
    assert "gender" in data
    assert "academia" in data
    assert "languages" in data
    assert "age_difference" in data
    assert "geographic_proximity" in data
    
    # Check results are dictionaries with string keys
    for category in data.values():
        assert isinstance(category, dict)
        # Check that keys are strings (not tuples)
        for key in category.keys():
            assert isinstance(key, str)
            # Keys should be in format "m-n"
            assert "-" in key


def test_matching_endpoint_with_custom_files():
    """Test matching endpoint with custom file paths"""
    request_data = {
        "mentees_application_csv": "mentee_application.csv",
        "mentees_interview_csv": "mentee_interview.csv",
        "mentors_application_csv": "mentor_application.csv",
        "mentors_interview_csv": "mentor_interview.csv"
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert "gender" in data


def test_matching_endpoint_with_importance_modifiers():
    """Test matching endpoint with importance modifiers"""
    request_data = {
        "importance_modifiers": {
            "gender": 2.0,
            "academia": 1.5,
            "languages": 0.8
        }
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert "gender" in data
    assert "academia" in data
    assert "languages" in data


def test_matching_endpoint_invalid_file():
    """Test matching endpoint with invalid file path"""
    request_data = {
        "mentees_application_csv": "nonexistent_file.csv",
        "mentees_interview_csv": "nonexistent_file.csv",
        "mentors_application_csv": "nonexistent_file.csv",
        "mentors_interview_csv": "nonexistent_file.csv"
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 404


def test_matching_endpoint_full_request():
    """Test matching endpoint with all parameters"""
    request_data = {
        "mentees_application_csv": "mentee_application.csv",
        "mentees_interview_csv": "mentee_interview.csv",
        "mentors_application_csv": "mentor_application.csv",
        "mentors_interview_csv": "mentor_interview.csv",
        "importance_modifiers": {
            "gender": 1.5,
            "academia": 2.0,
            "languages": 1.2,
            "age_difference": 0.9,
            "geographic_proximity": 1.1
        }
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    
    # Verify all categories are present
    assert len(data) == 5
    assert all(cat in data for cat in ["gender", "academia", "languages", "age_difference", "geographic_proximity"])


def test_matching_endpoint_with_partial_files():
    """Test matching endpoint with partial file paths (using defaults for others)"""
    request_data = {
        "mentees_application_csv": "GaaP Data - Backup - Mentee Application.csv",
        # Other files will use defaults
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert "gender" in data
    assert "academia" in data


def test_matching_endpoint_with_max_constraints():
    """Test matching endpoint with max age difference and max distance parameters"""
    request_data = {
        "age_max_difference": 25,
        "geographic_max_distance": 150,
        "importance_modifiers": {
            "gender": 1.0,
            "academia": 1.0
        }
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    
    # Verify all categories are present
    assert "age_difference" in data
    assert "geographic_proximity" in data
    assert "gender" in data
    assert "academia" in data


def test_matching_endpoint_with_all_parameters():
    """Test matching endpoint with all parameters including max constraints"""
    request_data = {
        "mentees_application_csv": "mentee_application.csv",
        "mentees_interview_csv": "mentee_interview.csv",
        "mentors_application_csv": "mentor_application.csv",
        "mentors_interview_csv": "mentor_interview.csv",
        "importance_modifiers": {
            "gender": 1.5,
            "academia": 2.0,
            "languages": 1.2,
            "age_difference": 0.9,
            "geographic_proximity": 1.1
        },
        "age_max_difference": 40,
        "geographic_max_distance": 300
    }
    response = client.post("/matching", json=request_data)
    assert response.status_code == 200
    data = response.json()
    
    # Verify all categories are present
    assert len(data) == 5
    assert all(cat in data for cat in ["gender", "academia", "languages", "age_difference", "geographic_proximity"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

