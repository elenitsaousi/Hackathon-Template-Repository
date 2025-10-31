/**
 * Merge application and interview CSV data, similar to backend's _merge_application_and_interview
 * This merges two parsed CSV arrays on a common ID column (outer join - keeps all records)
 */

type RecordType = Record<string, string>;

/**
 * Merge application and interview data arrays on the ID column
 * Similar to pandas merge with outer join
 * 
 * @param applicationData Array of objects from application CSV (each element is one person)
 * @param interviewData Array of objects from interview CSV (each element is one person)
 * @param idColumn Name of the ID column to merge on (e.g., "Mentee Number" or "Mentor Number")
 * @returns Merged array with combined columns from both datasets
 */
export function mergeApplicationAndInterview(
  applicationData: RecordType[],
  interviewData: RecordType[],
  idColumn: string
): RecordType[] {
  console.log(`\n--- Merging ${idColumn} data ---`);
  console.log(`Application records: ${applicationData.length}`);
  console.log(`Interview records: ${interviewData.length}`);
  
  // Validate ID column exists
  if (applicationData.length > 0 && !(idColumn in applicationData[0])) {
    console.warn(`ID column '${idColumn}' not found in application data. Available columns:`, Object.keys(applicationData[0]));
  }
  if (interviewData.length > 0 && !(idColumn in interviewData[0])) {
    console.warn(`ID column '${idColumn}' not found in interview data. Available columns:`, Object.keys(interviewData[0]));
  }
  
  // Create maps by ID for efficient lookup
  // Each map entry: ID -> person record
  const applicationMap = new Map<string, RecordType>();
  for (const row of applicationData) {
    const id = (row[idColumn] || '').trim();
    if (id) {
      // Handle duplicate IDs (keep first occurrence)
      if (applicationMap.has(id)) {
        console.warn(`Duplicate ${idColumn} in application data: ${id}`);
      }
      applicationMap.set(id, row);
    } else {
      console.warn(`Empty ${idColumn} in application data row, skipping`);
    }
  }
  
  const interviewMap = new Map<string, RecordType>();
  for (const row of interviewData) {
    const id = (row[idColumn] || '').trim();
    if (id) {
      // Handle duplicate IDs (keep first occurrence)
      if (interviewMap.has(id)) {
        console.warn(`Duplicate ${idColumn} in interview data: ${id}`);
      }
      interviewMap.set(id, row);
    } else {
      console.warn(`Empty ${idColumn} in interview data row, skipping`);
    }
  }
  
  // Get all unique IDs from both datasets (outer join - keep all records)
  const allIds = new Set([
    ...applicationMap.keys(),
    ...interviewMap.keys(),
  ]);
  
  console.log(`Total unique IDs: ${allIds.size}`);
  console.log(`IDs only in application: ${Array.from(allIds).filter(id => !interviewMap.has(id)).length}`);
  console.log(`IDs only in interview: ${Array.from(allIds).filter(id => !applicationMap.has(id)).length}`);
  console.log(`IDs in both: ${Array.from(allIds).filter(id => applicationMap.has(id) && interviewMap.has(id)).length}`);
  
  // Merge data: for each ID, combine columns from both datasets
  const mergedData: RecordType[] = [];
  
  for (const id of allIds) {
    const appRow = applicationMap.get(id) || {};
    const intRow = interviewMap.get(id) || {};
    
    // Merge objects: combine all columns from both datasets
    // Application columns come first, interview columns override if there are conflicts (except ID)
    const mergedRow: RecordType = {
      ...appRow,  // Start with application data
      ...intRow,  // Override/add interview data
      [idColumn]: id,  // Ensure ID column is set correctly
    };
    
    // Log warnings for IDs only in one dataset
    if (!applicationMap.has(id)) {
      console.warn(`${idColumn} ${id} found in interview but not in application`);
    }
    if (!interviewMap.has(id)) {
      console.warn(`${idColumn} ${id} found in application but not in interview`);
    }
    
    mergedData.push(mergedRow);
  }
  
  console.log(`✓ Merged ${mergedData.length} records (combined columns from both datasets)`);
  
  return mergedData;
}

/**
 * Create merged CSV data structures similar to backend's _create_merged_csvs
 * This processes all 4 CSV files and merges them into 2 merged datasets
 * 
 * @param mentorAppData Parsed mentor application CSV data
 * @param mentorIntData Parsed mentor interview CSV data
 * @param menteeAppData Parsed mentee application CSV data
 * @param menteeIntData Parsed mentee interview CSV data
 * @returns Object with merged mentees and merged mentors data
 */
export function createMergedData(
  mentorAppData: RecordType[],
  mentorIntData: RecordType[],
  menteeAppData: RecordType[],
  menteeIntData: RecordType[]
): {
  mergedMentees: RecordType[];
  mergedMentors: RecordType[];
} {
  console.log('\n=== Creating Merged CSV Data (like backend) ===');
  
  // Merge mentees application + interview
  const mergedMentees = mergeApplicationAndInterview(
    menteeAppData,
    menteeIntData,
    'Mentee Number'
  );
  
  // Merge mentors application + interview
  const mergedMentors = mergeApplicationAndInterview(
    mentorAppData,
    mentorIntData,
    'Mentor Number'
  );
  
  console.log(`\n✓ Merged data created:`);
  console.log(`  - Merged mentees: ${mergedMentees.length} records`);
  console.log(`  - Merged mentors: ${mergedMentors.length} records`);
  
  return {
    mergedMentees,
    mergedMentors,
  };
}

