# Frontend Match Button Testing Guide

## Summary

✅ **Backend Tests**: All passed
- Backend endpoint accepts manual matches/non-matches
- Backend returns final_matches correctly
- Manual matches override final_score with +inf
- Manual non-matches are excluded from results

✅ **Frontend Changes**: Completed
- Match button moved above Parameters (full width)
- Button shows "Matching..." while loading
- Frontend converts backend final_matches to Match format
- Matches are set in state and should display in Graph/Table

## Testing Steps

### 1. Open Frontend
```
http://localhost:3000
```

### 2. Verify Initial State
- Check that mentors and mentees are loaded
- Verify no matches are displayed initially (if no initial load)

### 3. Click "Match" Button
- Button is located **above the Parameters card** (full width, green button)
- Button text changes to "Matching..." while loading

### 4. Check Browser Console
Look for these log messages in order:
```
Calling backend API with manual matches: [...]
Calling backend API with manual non-matches: [...]
Using final_matches from backend: X matches
Sample final_match: {mentor_id: "...", mentee_id: "...", ...}
✓ Converted X matches from backend final_matches
Sample converted match: {mentorId: "...", menteeId: "...", ...}
✓ Loaded X matches from backend final_matches - displaying in frontend
```

### 5. Verify Display in Graph View
- Go to "Graph View" tab
- Should see:
  - Mentor nodes (labeled "Mentor X")
  - Mentee nodes (labeled "Mentee X")
  - **Connections (lines) between matched pairs**
  - Line colors:
    - Green (thick): Manual matches
    - Red (medium): Manual non-matches
    - Gray (thin): Auto matches

### 6. Verify Display in Table View
- Go to "Table View" tab
- Should see:
  - Table with columns: Mentor, Mentee, Global Score, Category Scores, Actions
  - **Rows for each matched pair** from backend
  - Scores displayed correctly
  - Badges for match status

### 7. Test with Manual Matches
1. Go to "Manual Matching" tab
2. Select a mentor and mentee
3. Click "Create Match" or "Create Non-Match"
4. Click "Match" button again
5. Verify:
   - Manual matches appear in results (green in graph)
   - Manual non-matches are excluded from results
   - Graph/Table update correctly

## Expected Results

### After Clicking "Match" Button:
- ✅ Loading indicator appears
- ✅ Console logs show successful API call
- ✅ Matches are converted and set in state
- ✅ Graph View displays connections
- ✅ Table View displays match rows
- ✅ Detail Panel shows match info when clicking nodes

### If Manual Matches/Non-Matches Set:
- ✅ Manual matches get +inf final_score (forced to match)
- ✅ Manual non-matches are excluded (not in results)
- ✅ Other matches computed normally

## Troubleshooting

### No Matches Displayed
- Check browser console for errors
- Verify backend returned final_matches
- Check that mentor/mentee IDs match (console shows warnings)

### Graph Not Showing Connections
- Verify matches array is populated (check console logs)
- Check that nodes exist for matched mentor/mentee IDs
- Ensure canvas is rendering (check element in DevTools)

### Table Not Showing Matches
- Check filteredMatches is populated
- Verify selectedPerson filter (if person selected)
- Check that match IDs exist in mentors/mentees arrays

### Infinity Scores Not Handling
- Check console for warnings about invalid final_score
- Verify Infinity handling in conversion logic
- Check that scores are numbers, not strings

## Backend API Response Format

The backend returns:
```json
{
  "gender": { "1-1": 0.75, ... },
  "academia": { "1-1": 0.5, ... },
  "languages": { "1-1": 0.7, ... },
  "age_difference": { "1-1": 0.9, ... },
  "geographic_proximity": { "1-1": 0.8, ... },
  "final_matches": [
    {
      "mentor_id": "1",
      "mentee_id": "1",
      "gender_score": 0.75,
      "language_score": 0.7,
      "academia_score": 0.5,
      "geo_score": 0.8,
      "age_score": 0.9,
      "final_score": 0.65
    },
    ...
  ]
}
```

## Frontend Match Format

Matches are converted to:
```typescript
{
  mentorId: "1",
  menteeId: "1",
  globalScore: 0.65,
  scores: {
    gender: 0.75,
    academia: 0.5,
    languages: 0.7,
    ageDifference: 0.9,
    geographicProximity: 0.8
  },
  isImmutableNonMatch: false
}
```

## Verification Checklist

- [ ] Backend server is running (http://localhost:8000)
- [ ] Frontend is running (http://localhost:3000)
- [ ] Match button is visible above Parameters
- [ ] Clicking button shows "Matching..." state
- [ ] Console logs show successful API call
- [ ] Console logs show match conversion
- [ ] Graph View displays connections
- [ ] Table View displays match rows
- [ ] Manual matches/non-matches work correctly
- [ ] Scores are displayed correctly

