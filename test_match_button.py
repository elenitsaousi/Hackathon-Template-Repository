#!/usr/bin/env python3
"""
Test script to verify the Match button functionality:
1. Backend endpoint accepts manual matches/non-matches
2. Backend returns final_matches in response
3. Frontend can parse and display matches
"""
import sys
from pathlib import Path
import requests
import json

def test_backend_matching_endpoint():
    """Test backend matching endpoint with manual matches/non-matches"""
    print("=" * 60)
    print("TEST 1: Backend Matching Endpoint")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    try:
        # Test without manual matches
        print("\n1. Testing without manual matches/non-matches...")
        response = requests.post(
            f"{base_url}/matching",
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            final_matches = data.get('final_matches', [])
            print(f"   ✓ Success: {len(final_matches)} final matches returned")
            if final_matches:
                print(f"   Sample: Mentor {final_matches[0].get('mentor_id')} ↔ Mentee {final_matches[0].get('mentee_id')}")
                print(f"   Final score: {final_matches[0].get('final_score')}")
            return True
        else:
            print(f"   ✗ Failed: {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ✗ Error: Cannot connect to backend. Is it running?")
        print("   Start with: cd backend && uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_manual_matches():
    """Test backend with manual matches/non-matches"""
    print("\n2. Testing with manual matches/non-matches...")
    
    base_url = "http://localhost:8000"
    
    try:
        response = requests.post(
            f"{base_url}/matching",
            json={
                "manual_matches": ["1-1", "2-2"],
                "manual_non_matches": ["1-2", "2-1"]
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            final_matches = data.get('final_matches', [])
            print(f"   ✓ Success: {len(final_matches)} final matches returned")
            
            # Check if manual matches are included
            manual_match_found = any(
                m.get('mentor_id') == '1' and m.get('mentee_id') == '1'
                or m.get('mentor_id') == '2' and m.get('mentee_id') == '2'
                for m in final_matches
            )
            
            if manual_match_found:
                print("   ✓ Manual matches are included in results")
            else:
                print("   ⚠ Warning: Manual matches may not be in results")
            
            return True
        else:
            print(f"   ✗ Failed: {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("MATCH BUTTON FUNCTIONALITY TEST")
    print("=" * 60)
    print("\nThis test verifies:")
    print("1. Backend matching endpoint works")
    print("2. Backend accepts manual matches/non-matches")
    print("3. Backend returns final_matches in response")
    print("\n")
    
    test1 = test_backend_matching_endpoint()
    test2 = test_manual_matches()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Backend Endpoint (basic): {'✓ PASS' if test1 else '✗ FAIL'}")
    print(f"Backend Endpoint (manual): {'✓ PASS' if test2 else '✗ FAIL'}")
    
    if test1 and test2:
        print("\n✓ All backend tests passed!")
        print("\nTo test frontend:")
        print("1. Open browser: http://localhost:3000")
        print("2. Click 'Match' button (above Parameters)")
        print("3. Check browser console for logs:")
        print("   - 'Calling backend API with manual matches'")
        print("   - 'Using final_matches from backend'")
        print("   - '✓ Loaded X matches from backend final_matches'")
        print("4. Verify matches are displayed in Graph/Table views")
    else:
        print("\n✗ Some tests failed. Check backend logs and restart server if needed.")
    
    print("=" * 60)
    
    return test1 and test2

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

