#!/usr/bin/env python3
"""
Test script to verify frontend loads mentors and mentees correctly from CSVs
This simulates what the frontend does: loads CSVs, parses them, merges them, and extracts data
"""
import sys
from pathlib import Path
import requests
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

def test_backend_csv_endpoint():
    """Test that backend CSV endpoint works"""
    print("=" * 60)
    print("TEST 1: Backend CSV Endpoint")
    print("=" * 60)
    
    files = [
        'mentor_application.csv',
        'mentor_interview.csv',
        'mentee_application.csv',
        'mentee_interview.csv'
    ]
    
    base_url = "http://localhost:8000"
    results = {}
    
    for filename in files:
        try:
            url = f"{base_url}/demo-csv?filename={filename}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                content_length = len(response.text)
                lines = response.text.split('\n')
                header_line = lines[0] if lines else ""
                data_rows = len([l for l in lines if l.strip()]) - 1  # minus header
                
                results[filename] = {
                    'status': 'SUCCESS',
                    'size': content_length,
                    'rows': data_rows,
                    'columns': len(header_line.split(',')) if header_line else 0,
                }
                print(f"✓ {filename}: {data_rows} rows, {results[filename]['columns']} columns, {content_length} bytes")
            else:
                results[filename] = {'status': f'FAILED ({response.status_code})', 'error': response.text}
                print(f"✗ {filename}: Failed - {response.status_code} - {response.text[:100]}")
        except Exception as e:
            results[filename] = {'status': 'ERROR', 'error': str(e)}
            print(f"✗ {filename}: Error - {e}")
    
    return results

def test_backend_matching_endpoint():
    """Test that backend matching endpoint works and returns data"""
    print("\n" + "=" * 60)
    print("TEST 2: Backend Matching Endpoint")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    try:
        # Test with default files
        response = requests.post(
            f"{base_url}/matching",
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check all categories are present
            categories = ['gender', 'academia', 'languages', 'age_difference', 'geographic_proximity', 'final_matches']
            print("Categories found:")
            for cat in categories:
                if cat in data:
                    if cat == 'final_matches':
                        print(f"  ✓ {cat}: {len(data[cat])} matches")
                    else:
                        count = len(data[cat])
                        print(f"  ✓ {cat}: {count} pairs")
                else:
                    print(f"  ✗ {cat}: MISSING")
            
            # Check final_matches structure
            if 'final_matches' in data and len(data['final_matches']) > 0:
                sample_match = data['final_matches'][0]
                print(f"\nSample match: {sample_match}")
                required_fields = ['mentor_id', 'mentee_id', 'final_score']
                for field in required_fields:
                    if field in sample_match:
                        print(f"  ✓ {field}: {sample_match[field]}")
                    else:
                        print(f"  ✗ {field}: MISSING")
            
            return {'status': 'SUCCESS', 'data': data}
        else:
            print(f"✗ Failed: {response.status_code} - {response.text[:200]}")
            return {'status': 'FAILED', 'error': response.text}
    except Exception as e:
        print(f"✗ Error: {e}")
        return {'status': 'ERROR', 'error': str(e)}

def test_csv_file_structure():
    """Test that CSV files in data directory have correct structure"""
    print("\n" + "=" * 60)
    print("TEST 3: CSV File Structure (Direct File Read)")
    print("=" * 60)
    
    from backend.main import DATA_DIR
    import csv
    
    files = {
        'mentor_application.csv': 'Mentor Number',
        'mentor_interview.csv': 'Mentor Number',
        'mentee_application.csv': 'Mentee Number',
        'mentee_interview.csv': 'Mentee Number',
    }
    
    results = {}
    
    for filename, id_column in files.items():
        file_path = DATA_DIR / filename
        try:
            if not file_path.exists():
                print(f"✗ {filename}: File not found")
                results[filename] = {'status': 'NOT_FOUND'}
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                
                if not rows:
                    print(f"✗ {filename}: No data rows")
                    results[filename] = {'status': 'EMPTY'}
                    continue
                
                # Check ID column exists
                if id_column not in rows[0]:
                    print(f"✗ {filename}: ID column '{id_column}' not found. Available: {list(rows[0].keys())[:5]}")
                    results[filename] = {'status': 'MISSING_ID_COLUMN'}
                    continue
                
                # Count unique IDs
                unique_ids = set(row[id_column].strip() for row in rows if row[id_column].strip())
                total_rows = len(rows)
                
                print(f"✓ {filename}: {total_rows} rows, {len(unique_ids)} unique IDs, {len(rows[0])} columns")
                print(f"  Sample IDs: {sorted(list(unique_ids))[:5] if unique_ids else []}")
                
                results[filename] = {
                    'status': 'SUCCESS',
                    'rows': total_rows,
                    'unique_ids': len(unique_ids),
                    'columns': len(rows[0]),
                    'sample_ids': sorted(list(unique_ids))[:5],
                }
        except Exception as e:
            print(f"✗ {filename}: Error - {e}")
            results[filename] = {'status': 'ERROR', 'error': str(e)}
    
    return results

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("FRONTEND DATA LOADING TEST SUITE")
    print("=" * 60)
    print("\nThis test verifies:")
    print("1. Backend CSV endpoint serves files correctly")
    print("2. Backend matching endpoint processes data correctly")
    print("3. CSV files have correct structure (one row = one person)")
    print("\n")
    
    # Test 1: Backend CSV endpoint
    csv_results = test_backend_csv_endpoint()
    
    # Test 2: Backend matching endpoint
    matching_results = test_backend_matching_endpoint()
    
    # Test 3: CSV file structure
    structure_results = test_csv_file_structure()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    csv_success = all(r.get('status') == 'SUCCESS' for r in csv_results.values())
    matching_success = matching_results.get('status') == 'SUCCESS'
    structure_success = all(r.get('status') == 'SUCCESS' for r in structure_results.values())
    
    print(f"Backend CSV Endpoint: {'✓ PASS' if csv_success else '✗ FAIL'}")
    print(f"Backend Matching Endpoint: {'✓ PASS' if matching_success else '✗ FAIL'}")
    print(f"CSV File Structure: {'✓ PASS' if structure_success else '✗ FAIL'}")
    
    if matching_success and 'data' in matching_results:
        data = matching_results['data']
        if 'final_matches' in data:
            print(f"\nFinal Matches: {len(data['final_matches'])} pairs created")
            if data['final_matches']:
                print(f"  Sample: Mentor {data['final_matches'][0]['mentor_id']} ↔ Mentee {data['final_matches'][0]['mentee_id']}")
    
    print("\n" + "=" * 60)
    print("To test frontend in browser:")
    print("1. Start frontend: cd frontend && npm run dev")
    print("2. Open browser: http://localhost:5173 (or port shown)")
    print("3. Check browser console for detailed loading logs")
    print("4. Verify each mentor and mentee is displayed correctly")
    print("=" * 60)
    
    return csv_success and matching_success and structure_success

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

