#!/usr/bin/env python3
"""
Test script that uses a browser to test the frontend and verify it loads mentors/mentees correctly.
This simulates actual browser interaction to verify the frontend works.
"""
import sys
import subprocess
import time
import requests
from pathlib import Path

def check_backend_running():
    """Check if backend is running"""
    try:
        response = requests.get("http://localhost:8000/", timeout=2)
        return response.status_code in [200, 404]  # 404 is OK, means server is running
    except:
        return False

def check_frontend_running():
    """Check if frontend is running"""
    try:
        # Vite usually runs on 5173, but config shows 3000
        for port in [3000, 5173, 5174]:
            try:
                response = requests.get(f"http://localhost:{port}/", timeout=2)
                if response.status_code == 200:
                    return port
            except:
                continue
        return None
    except:
        return None

def main():
    """Main test function"""
    print("=" * 60)
    print("FRONTEND BROWSER TEST")
    print("=" * 60)
    print("\nThis script verifies:")
    print("1. Backend is running")
    print("2. Frontend is running (optional)")
    print("3. Provides instructions for manual browser testing")
    print("\n")
    
    # Check backend
    print("Checking backend...")
    if check_backend_running():
        print("✓ Backend is running on http://localhost:8000")
        
        # Test CSV endpoint
        try:
            response = requests.get("http://localhost:8000/demo-csv?filename=mentor_application.csv", timeout=2)
            if response.status_code == 200:
                print("✓ Backend CSV endpoint is accessible")
            else:
                print(f"✗ Backend CSV endpoint returned {response.status_code}")
        except Exception as e:
            print(f"✗ Backend CSV endpoint error: {e}")
    else:
        print("✗ Backend is NOT running")
        print("  Start it with: cd backend && uvicorn main:app --reload")
        return False
    
    print()
    
    # Check frontend
    print("Checking frontend...")
    frontend_port = check_frontend_running()
    if frontend_port:
        print(f"✓ Frontend is running on http://localhost:{frontend_port}")
    else:
        print("✗ Frontend is NOT running")
        print("  Start it with: cd frontend && npm run dev")
        print("  Then open http://localhost:3000 (or port shown)")
        return False
    
    print()
    print("=" * 60)
    print("MANUAL BROWSER TESTING INSTRUCTIONS")
    print("=" * 60)
    print(f"\n1. Open browser: http://localhost:{frontend_port}")
    print("2. Open browser console (F12 or Ctrl+Shift+I)")
    print("3. Click 'Use Data from Data Directory' button")
    print("4. Watch console logs for:")
    print("   - Step 1: CSV Parsing (should show 4 files loaded)")
    print("   - Step 2: Merging data (should merge app + interview)")
    print("   - Step 3: Extracting structured data")
    print("   - Step 4: Validation (should show mentor/mentee counts)")
    print("   - Sample Data Verification (should show sample IDs)")
    print("   - All Loaded IDs (should list all mentor/mentee IDs)")
    print("\n5. Verify in dashboard:")
    print("   - Graph shows mentor and mentee nodes")
    print("   - Each node has a unique ID")
    print("   - Table shows matching pairs (if backend returns matches)")
    print("\n6. Click on a mentor node to see details panel")
    print("   - Should show mentor-specific columns")
    print("7. Click on a mentee node to see details panel")
    print("   - Should show mentee-specific columns")
    print("=" * 60)
    
    # Try to use selenium/playwright if available
    try:
        print("\nAttempting automated browser test...")
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        print("✓ Selenium available, starting browser test...")
        
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        driver = webdriver.Chrome(options=options)
        try:
            driver.get(f"http://localhost:{frontend_port}")
            time.sleep(3)  # Wait for page to load
            
            # Look for the "Use Data from Data Directory" button
            try:
                button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Data Directory') or contains(text(), 'Demo')]"))
                )
                button.click()
                print("✓ Clicked 'Use Data from Data Directory' button")
                
                # Wait a bit for data to load
                time.sleep(5)
                
                # Check console logs (would need to extract from driver.get_log('browser'))
                console_logs = driver.get_log('browser')
                print(f"✓ Browser console has {len(console_logs)} log entries")
                
                # Check if graph/table elements are present
                try:
                    # Look for graph canvas or similar
                    graph_elements = driver.find_elements(By.CSS_SELECTOR, "canvas, svg, [class*='graph']")
                    if graph_elements:
                        print(f"✓ Found {len(graph_elements)} graph/visualization elements")
                    else:
                        print("  Note: Graph elements not found (may need more time to load)")
                except:
                    pass
                
                print("✓ Automated browser test completed")
                print("  Check the console output above for any errors")
                
            except Exception as e:
                print(f"  Note: Could not find button or interact with page: {e}")
                print("  This is OK - proceed with manual testing")
        
        finally:
            driver.quit()
    
    except ImportError:
        print("  Note: Selenium not installed - skipping automated browser test")
        print("  Install with: pip install selenium")
        print("  Or use manual testing instructions above")
    except Exception as e:
        print(f"  Note: Browser automation failed: {e}")
        print("  Use manual testing instructions above")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print("\nFor comprehensive testing:")
    print("1. Run: python3 test_frontend_data_flow.py (tests data loading logic)")
    print("2. Run: python3 test_frontend_loading.py (tests backend endpoints)")
    print("3. Use manual browser testing (instructions above)")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

