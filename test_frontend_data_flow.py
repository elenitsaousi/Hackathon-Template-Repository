#!/usr/bin/env python3
"""
Test script that simulates the frontend data loading flow:
1. Load CSVs from backend (like frontend does)
2. Parse CSVs (simulate frontend parsing)
3. Merge data (like frontend does)
4. Extract mentors and mentees (simulate frontend extraction)
5. Verify each row = one person
"""
import sys
from pathlib import Path
import requests
import csv
from typing import Dict, List, Set

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

def load_csv_from_backend(filename: str) -> str:
    """Load CSV from backend endpoint (like frontend does)"""
    base_url = "http://localhost:8000"
    url = f"{base_url}/demo-csv?filename={filename}"
    
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.text
        else:
            raise Exception(f"Failed to fetch {filename}: {response.status_code} - {response.text[:100]}")
    except Exception as e:
        raise Exception(f"Error loading {filename}: {e}")

def parse_csv(csv_text: str, filename: str) -> List[Dict[str, str]]:
    """
    Parse CSV text into array of objects (simulate frontend parseCSV)
    First row is header, each subsequent row is one person
    """
    lines = [line for line in csv_text.split('\n') if line.strip()]
    
    if len(lines) == 0:
        return []
    
    if len(lines) == 1:
        print(f"  Warning: {filename} has only header row, no data")
        return []
    
    # Detect delimiter
    delimiter = '\t' if '\t' in lines[0] else ','
    
    # Parse header
    reader = csv.DictReader(lines, delimiter=delimiter)
    data = list(reader)
    
    print(f"  Parsed {len(data)} rows from {filename}")
    return data

def merge_data(application_data: List[Dict], interview_data: List[Dict], id_column: str) -> List[Dict]:
    """
    Merge application and interview data (simulate frontend mergeApplicationAndInterview)
    Outer join - keeps all records
    """
    # Create maps by ID
    app_map = {row[id_column].strip(): row for row in application_data if row.get(id_column, '').strip()}
    int_map = {row[id_column].strip(): row for row in interview_data if row.get(id_column, '').strip()}
    
    # Get all unique IDs (outer join)
    all_ids = set(list(app_map.keys()) + list(int_map.keys()))
    
    # Merge
    merged = []
    for id_val in all_ids:
        app_row = app_map.get(id_val, {})
        int_row = int_map.get(id_val, {})
        
        # Merge objects
        merged_row = {**app_row, **int_row, id_column: id_val}
        merged.append(merged_row)
    
    print(f"  Merged: {len(application_data)} app + {len(interview_data)} int → {len(merged)} records")
    return merged

def extract_mentors(merged_data: List[Dict]) -> List[Dict]:
    """Extract mentors from merged data (simulate frontend parseMentorData)"""
    mentors = []
    
    for row in merged_data:
        mentor_id = row.get('Mentor Number', '').strip()
        if not mentor_id:
            continue
        
        mentor = {
            'id': mentor_id,
            'name': row.get('Name', f'Mentor {mentor_id}').strip(),
        }
        mentors.append(mentor)
    
    return mentors

def extract_mentees(merged_data: List[Dict]) -> List[Dict]:
    """Extract mentees from merged data (simulate frontend parseMenteeData)"""
    mentees = []
    
    for row in merged_data:
        mentee_id = row.get('Mentee Number', '').strip()
        if not mentee_id:
            continue
        
        mentee = {
            'id': mentee_id,
            'name': f'Mentee {mentee_id}',
        }
        mentees.append(mentee)
    
    return mentees

def test_frontend_data_flow():
    """Test the complete frontend data loading flow"""
    print("=" * 60)
    print("FRONTEND DATA LOADING FLOW TEST")
    print("=" * 60)
    print("\nThis simulates what the frontend does:")
    print("1. Load CSVs from backend endpoint")
    print("2. Parse each CSV (each row = one person)")
    print("3. Merge application + interview data")
    print("4. Extract mentors and mentees")
    print("5. Verify structure")
    print("\n")
    
    try:
        # Step 1: Load CSVs from backend (like frontend loadDemoCSVFiles)
        print("Step 1: Loading CSVs from backend...")
        mentor_app_csv = load_csv_from_backend('mentor_application.csv')
        mentor_int_csv = load_csv_from_backend('mentor_interview.csv')
        mentee_app_csv = load_csv_from_backend('mentee_application.csv')
        mentee_int_csv = load_csv_from_backend('mentee_interview.csv')
        print("✓ All 4 CSVs loaded from backend\n")
        
        # Step 2: Parse CSVs (like frontend parseCSV)
        print("Step 2: Parsing CSVs (each row = one person)...")
        mentor_app_data = parse_csv(mentor_app_csv, 'mentor_application.csv')
        mentor_int_data = parse_csv(mentor_int_csv, 'mentor_interview.csv')
        mentee_app_data = parse_csv(mentee_app_csv, 'mentee_application.csv')
        mentee_int_data = parse_csv(mentee_int_csv, 'mentee_interview.csv')
        print("✓ All CSVs parsed\n")
        
        # Verify each row has an ID
        print("Step 2.5: Verifying row structure...")
        for data, filename, id_col in [
            (mentor_app_data, 'mentor_application.csv', 'Mentor Number'),
            (mentor_int_data, 'mentor_interview.csv', 'Mentor Number'),
            (mentee_app_data, 'mentee_application.csv', 'Mentee Number'),
            (mentee_int_data, 'mentee_interview.csv', 'Mentee Number'),
        ]:
            ids_with_data = [row.get(id_col, '').strip() for row in data if row.get(id_col, '').strip()]
            unique_ids = set(ids_with_data)
            print(f"  ✓ {filename}: {len(data)} rows, {len(unique_ids)} unique IDs")
            if len(ids_with_data) != len(data):
                print(f"    Warning: {len(data) - len(ids_with_data)} rows missing ID")
        print()
        
        # Step 3: Merge data (like frontend createMergedData)
        print("Step 3: Merging application + interview data...")
        merged_mentors = merge_data(mentor_app_data, mentor_int_data, 'Mentor Number')
        merged_mentees = merge_data(mentee_app_data, mentee_int_data, 'Mentee Number')
        print("✓ Data merged\n")
        
        # Step 4: Extract mentors and mentees (like frontend parseMentorData/parseMenteeData)
        print("Step 4: Extracting mentors and mentees...")
        mentors = extract_mentors(merged_mentors)
        mentees = extract_mentees(merged_mentees)
        print(f"✓ Extracted {len(mentors)} mentors and {len(mentees)} mentees\n")
        
        # Step 5: Verification
        print("Step 5: Verification...")
        
        # Verify each mentor has unique ID
        mentor_ids = [m['id'] for m in mentors]
        unique_mentor_ids = set(mentor_ids)
        print(f"  ✓ Mentors: {len(mentors)} total, {len(unique_mentor_ids)} unique IDs")
        if len(mentor_ids) != len(unique_mentor_ids):
            print(f"    ✗ WARNING: Duplicate mentor IDs found!")
            duplicates = [id for id in mentor_ids if mentor_ids.count(id) > 1]
            print(f"    Duplicates: {set(duplicates)}")
        
        # Verify each mentee has unique ID
        mentee_ids = [m['id'] for m in mentees]
        unique_mentee_ids = set(mentee_ids)
        print(f"  ✓ Mentees: {len(mentees)} total, {len(unique_mentee_ids)} unique IDs")
        if len(mentee_ids) != len(unique_mentee_ids):
            print(f"    ✗ WARNING: Duplicate mentee IDs found!")
            duplicates = [id for id in mentee_ids if mentee_ids.count(id) > 1]
            print(f"    Duplicates: {set(duplicates)}")
        
        # Verify structure matches CSV row counts
        print(f"\n  ✓ Mentor Application rows: {len(mentor_app_data)}")
        print(f"  ✓ Mentor Interview rows: {len(mentor_int_data)}")
        print(f"  ✓ Merged Mentor records: {len(merged_mentors)}")
        print(f"  ✓ Extracted Mentors: {len(mentors)}")
        print(f"\n  ✓ Mentee Application rows: {len(mentee_app_data)}")
        print(f"  ✓ Mentee Interview rows: {len(mentee_int_data)}")
        print(f"  ✓ Merged Mentee records: {len(merged_mentees)}")
        print(f"  ✓ Extracted Mentees: {len(mentees)}")
        
        # Show sample data
        if mentors:
            sample_mentor = mentors[0]
            print(f"\n  Sample Mentor:")
            print(f"    ID: {sample_mentor['id']}")
            print(f"    Name: {sample_mentor['name']}")
        
        if mentees:
            sample_mentee = mentees[0]
            print(f"\n  Sample Mentee:")
            print(f"    ID: {sample_mentee['id']}")
            print(f"    Name: {sample_mentee['name']}")
        
        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        success = (
            len(mentors) > 0 and
            len(mentees) > 0 and
            len(mentor_ids) == len(unique_mentor_ids) and
            len(mentee_ids) == len(unique_mentee_ids)
        )
        
        if success:
            print("✓ PASS: Frontend data loading flow works correctly")
            print(f"  - {len(mentors)} mentors loaded (each row = one person)")
            print(f"  - {len(mentees)} mentees loaded (each row = one person)")
            print(f"  - All IDs are unique")
        else:
            print("✗ FAIL: Frontend data loading flow has issues")
            if len(mentors) == 0:
                print("  - No mentors extracted")
            if len(mentees) == 0:
                print("  - No mentees extracted")
            if len(mentor_ids) != len(unique_mentor_ids):
                print("  - Duplicate mentor IDs found")
            if len(mentee_ids) != len(unique_mentee_ids):
                print("  - Duplicate mentee IDs found")
        
        print("\n" + "=" * 60)
        return success
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_frontend_data_flow()
    sys.exit(0 if success else 1)

