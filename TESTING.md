# Frontend Data Loading Testing Guide

This directory contains comprehensive test scripts to verify that the frontend correctly loads mentors and mentees from CSVs.

## Test Scripts Overview

### 1. `test_frontend_data_flow.py`
**Purpose**: Simulates the exact frontend data loading flow without a browser.

**What it tests**:
- ✅ Loads CSVs from backend endpoint (like frontend does)
- ✅ Parses each CSV (each row = one person)
- ✅ Merges application + interview data (like frontend `createMergedData`)
- ✅ Extracts mentors and mentees (like frontend `parseMentorData`/`parseMenteeData`)
- ✅ Verifies each row represents one person with unique ID

**Usage**:
```bash
python3 test_frontend_data_flow.py
```

**Expected Output**:
```
✓ PASS: Frontend data loading flow works correctly
  - 10 mentors loaded (each row = one person)
  - 10 mentees loaded (each row = one person)
  - All IDs are unique
```

### 2. `test_frontend_loading.py`
**Purpose**: Tests backend endpoints and CSV file structure.

**What it tests**:
- ✅ Backend CSV endpoint serves files correctly (`/demo-csv`)
- ✅ Backend matching endpoint processes data correctly (`/matching`)
- ✅ CSV files have correct structure (one row = one person)

**Usage**:
```bash
python3 test_frontend_loading.py
```

**Expected Output**:
```
Backend CSV Endpoint: ✓ PASS
Backend Matching Endpoint: ✓ PASS (or ✗ FAIL if endpoint has issues)
CSV File Structure: ✓ PASS
```

### 3. `test_frontend_browser.py`
**Purpose**: Checks if backend/frontend are running and provides browser testing instructions.

**What it tests**:
- ✅ Backend is running on http://localhost:8000
- ✅ Frontend is running (checks common ports: 3000, 5173)
- ✅ Provides detailed manual testing instructions

**Usage**:
```bash
python3 test_frontend_browser.py
```

**Features**:
- Can attempt automated browser testing if Selenium is installed
- Provides step-by-step manual testing instructions

## Running All Tests

### Quick Test (Data Flow Only)
```bash
python3 test_frontend_data_flow.py
```

### Comprehensive Test Suite
```bash
# Test 1: Data flow simulation
python3 test_frontend_data_flow.py

# Test 2: Backend endpoints
python3 test_frontend_loading.py

# Test 3: Browser setup check
python3 test_frontend_browser.py
```

## Manual Browser Testing

After running the test scripts, verify the frontend manually:

1. **Start Frontend** (if not running):
   ```bash
   cd frontend && npm run dev
   ```

2. **Open Browser**:
   - Navigate to http://localhost:3000 (or port shown)
   - Open Developer Console (F12 or Ctrl+Shift+I)

3. **Load Data**:
   - Click "Use Data from Data Directory" button
   - Watch console logs for detailed loading steps

4. **Verify Console Logs**:
   Look for these log sections:
   ```
   === Starting CSV Parsing ===
   --- Step 1: Parsing CSV files ---
     ✓ Mentor Application: X rows (people) parsed
     ✓ Mentor Interview: X rows (people) parsed
     ✓ Mentee Application: X rows (people) parsed
     ✓ Mentee Interview: X rows (people) parsed
   
   --- Step 2: Merging application and interview data ---
     === Creating Merged CSV Data (like backend) ===
     --- Merging Mentee Number data ---
     Application records: X
     Interview records: X
     Total unique IDs: X
   
   --- Step 3: Extracting structured data from merged data ---
     Mentors parsed: X
     Mentees parsed: X
   
   --- Step 4: Validation ---
     ✓ Successfully parsed X mentors and X mentees
   
   --- All Loaded IDs ---
     Mentor IDs (X total): [list of IDs]
     Mentee IDs (X total): [list of IDs]
   ```

5. **Verify Dashboard**:
   - **Graph**: Should show mentor and mentee nodes with unique IDs
   - **Table**: Should show matching pairs (if backend returns matches)
   - **Detail Panel**: Click on nodes to see mentor/mentee details

## What the Tests Verify

### ✅ Each Row = One Person
- Each CSV row represents exactly one person (mentor or mentee)
- Each person has a unique ID ("Mentor Number" or "Mentee Number")
- No duplicate IDs within the same CSV

### ✅ Data Merging Works
- Application and interview CSVs are merged by ID (outer join)
- All columns from both datasets are combined
- Each merged record still represents one person

### ✅ Frontend Parsing Works
- CSVs are parsed correctly (handles commas, quotes, tabs)
- Data is extracted into structured Mentor/Mentee objects
- All required fields are populated

### ✅ Backend Integration Works
- Frontend can fetch CSVs from backend `/demo-csv` endpoint
- Backend processes merged CSVs correctly
- Matching algorithm runs and returns results

## Troubleshooting

### Test Failures

**`test_frontend_data_flow.py` fails**:
- Check backend is running: `curl http://localhost:8000/`
- Check CSV files exist in `data/` directory
- Verify CSV files have correct structure (header row, data rows)

**`test_frontend_loading.py` fails**:
- Backend CSV endpoint fails: Check backend is running and `/demo-csv` route exists
- Backend matching endpoint fails: Check backend logs for errors
- CSV structure fails: Verify CSV files have ID columns ("Mentor Number", "Mentee Number")

**`test_frontend_browser.py` fails**:
- Backend not running: Start with `cd backend && uvicorn main:app --reload`
- Frontend not running: Start with `cd frontend && npm run dev`

### Console Errors in Browser

**"Failed to fetch demo CSV files"**:
- Backend not running or wrong URL
- Check `frontend/src/utils/demoDataLoader.ts` has correct API_BASE_URL

**"No valid data found in CSV files"**:
- CSV parsing failed
- Check browser console for parsing errors
- Verify CSV format (comma/tab separated, proper headers)

**"Duplicate IDs found"**:
- CSV file has duplicate ID values
- Check CSV files for duplicate "Mentor Number" or "Mentee Number" values

## Expected Results

### CSV Files
- `mentor_application.csv`: 10 rows, 10 unique IDs
- `mentor_interview.csv`: 10 rows, 10 unique IDs
- `mentee_application.csv`: 10 rows, 10 unique IDs
- `mentee_interview.csv`: 10 rows, 10 unique IDs

### Merged Data
- Merged mentors: 10 records (one per unique ID)
- Merged mentees: 10 records (one per unique ID)

### Frontend Display
- 10 mentor nodes in graph
- 10 mentee nodes in graph
- All nodes have unique IDs
- Detail panels show correct data for each mentor/mentee

## Test Script Dependencies

- `requests`: For HTTP requests to backend
- `csv`: For CSV parsing (built-in)
- `selenium`: Optional, for automated browser testing

Install dependencies:
```bash
pip install requests selenium  # selenium is optional
```

