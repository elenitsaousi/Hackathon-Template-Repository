import type { Mentor, Mentee } from '../types';

/**
 * Parse CSV file where:
 * - First row (index 0) is the header with column names
 * - Each subsequent row (index 1+) is one data point (mentee or mentor)
 */
export async function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) {
        console.warn('Empty CSV file:', file.name);
        resolve([]);
        return;
      }

      // Normalize line endings first
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Detect delimiter (check first line, accounting for quotes)
      const delimiter = normalizedText.includes('\t') ? '\t' : ',';
      
      console.log(`Parsing ${file.name} with delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`);
      
      // Parse CSV properly handling quoted fields that may contain newlines
      // We need to split on newlines BUT respect quoted fields
      const rows = parseCSVRows(normalizedText, delimiter);
      
      if (rows.length === 0) {
        console.warn(`CSV file ${file.name} has no rows`);
        resolve([]);
        return;
      }

      if (rows.length === 1) {
        console.warn(`CSV file ${file.name} has only header row, no data rows`);
        resolve([]);
        return;
      }
      
      console.log(`Total rows: ${rows.length} (1 header + ${rows.length - 1} data rows)`);
      
      // Parse header row (first row, index 0)
      const headerRow = parseCSVLine(rows[0], delimiter);
      
      if (headerRow.length === 0) {
        console.warn(`CSV file ${file.name} has empty header row`);
        resolve([]);
        return;
      }
      
      // Parse data rows (each subsequent row after header is one mentee/mentor)
      // IMPORTANT: Each row (index 1+) represents exactly ONE person
      const data: Record<string, string>[] = [];
      for (let i = 1; i < rows.length; i++) {
        const lineNumber = i + 1; // Human-readable line number (header is line 1, first data row is line 2)
        const rawLine = rows[i];
        const row = parseCSVLine(rawLine, delimiter);
        
        // CRITICAL VALIDATION: Each row must represent one person
        // If a row has only 1 column with commas in it, it wasn't parsed correctly
        if (row.length === 1 && row[0].includes(',')) {
          console.error(
            `ERROR: Row ${lineNumber} appears to be incorrectly parsed. ` +
            `Found 1 column with commas: "${row[0].substring(0, 100)}..." ` +
            `This row should have ${headerRow.length} columns (one per header).`
          );
          console.error('Raw line:', rawLine.substring(0, 200));
          console.error('Delimiter used:', delimiter === '\t' ? 'TAB' : 'COMMA');
          
          // Skip this row as it's not valid
          continue;
        }
        
        // Validate row has correct number of columns
        if (row.length !== headerRow.length) {
          console.error(
            `ERROR: Row ${lineNumber} has ${row.length} columns but header has ${headerRow.length} columns. ` +
            `Each row must have exactly ${headerRow.length} columns (one per header). ` +
            `This row does not represent a valid person.`
          );
          console.error('Expected columns:', headerRow.length);
          console.error('Actual columns:', row.length);
          console.error('Row data preview:', row.slice(0, 5).join(' | '));
          
          // Skip rows that don't match header structure
          continue;
        }
        
        // Map each column value to its header name
        // Each column corresponds to one field of one person
        const rowObj: Record<string, string> = {};
        headerRow.forEach((header, index) => {
          rowObj[header] = row[index] || '';
        });
        
        // Final validation: Ensure this row represents ONE person
        // Check that we have the correct structure (not all data concatenated)
        const columnValues = Object.values(rowObj);
        const nonEmptyValues = columnValues.filter(v => v.trim().length > 0);
        
        if (nonEmptyValues.length === 0) {
          console.warn(`Row ${lineNumber} has no data - skipping empty row`);
          continue;
        }
        
        if (nonEmptyValues.length === 1 && nonEmptyValues[0].includes(',')) {
          console.error(
            `ERROR: Row ${lineNumber} appears to have all columns concatenated into one field. ` +
            `This indicates incorrect parsing. Row represents INVALID person data.`
          );
          console.error('Concatenated value:', nonEmptyValues[0].substring(0, 200));
          // Skip this invalid row
          continue;
        }
        
        // This row represents one valid person
        data.push(rowObj);
      }
      
      console.log(`✓ Parsed ${data.length} valid person rows from ${file.name}`);
      console.log(`  - Header row: 1 row with ${headerRow.length} columns`);
      console.log(`  - Data rows: ${data.length} rows (each row = one person)`);
      
      if (data.length > 0) {
        console.log('Sample person row (first row):', data[0]);
        console.log(`Number of columns in person row: ${Object.keys(data[0]).length} (should match header: ${headerRow.length})`);
        
        // Final validation: Each row in data array represents exactly ONE person
        data.forEach((row, index) => {
          const personNumber = index + 1;
          const columnCount = Object.keys(row).length;
          
          if (columnCount !== headerRow.length) {
            console.error(`PERSON ${personNumber}: Has ${columnCount} columns but expected ${headerRow.length} - INVALID PERSON`);
          }
          
          // Each row should have multiple distinct fields (one person has multiple attributes)
          const values = Object.values(row);
          const distinctFields = values.filter(v => v.trim().length > 0);
          
          if (distinctFields.length <= 1) {
            console.warn(`PERSON ${personNumber}: Has very few fields (${distinctFields.length}) - may be incomplete`);
          }
          
          // Ensure no single field contains multiple comma-separated values that should be separate columns
          values.forEach((value, colIndex) => {
            if (value.includes(',') && value.split(',').length > 3) {
              const headerName = headerRow[colIndex];
              console.warn(
                `PERSON ${personNumber}, column "${headerName}": Contains multiple comma-separated values. ` +
                `This might indicate parsing issues: "${value.substring(0, 100)}..."`
              );
            }
          });
        });
        
        console.log(`✓ Validated: All ${data.length} rows represent one person each`);
      } else {
        console.warn(`⚠ No valid person rows found in ${file.name}`);
      }
      
      resolve(data);
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Parse CSV text into rows, properly handling quoted fields that contain newlines
 * This correctly splits on newlines only when NOT inside quoted fields
 */
function parseCSVRows(text: string, delimiter: string): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = i + 1 < text.length ? text[i + 1] : null;
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote) - add one quote to field
        currentRow += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of row (newline outside quotes)
      if (currentRow.trim().length > 0 || rows.length === 0) {
        // Include empty header row if it exists
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  
  // Add last row if not empty
  if (currentRow.trim().length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  // Handle line endings (should already be normalized, but be safe)
  const normalizedLine = line.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  for (let i = 0; i < normalizedLine.length; i++) {
    const char = normalizedLine[i];
    const nextChar = i + 1 < normalizedLine.length ? normalizedLine[i + 1] : null;
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator found outside quotes
      fields.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      // End of line (shouldn't happen in single line parsing, but handle it)
      break;
    } else {
      currentField += char;
    }
  }
  
  // Add the last field
  fields.push(currentField.trim());
  
  // Remove surrounding quotes from fields
  return fields.map(field => {
    // Remove surrounding quotes if present
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1).replace(/""/g, '"');
    }
    return field;
  });
}

// Helper to get a column value safely
function getColumn(row: Record<string, string>, columnName: string): string {
  // Try exact match first
  if (row[columnName] !== undefined) {
    return row[columnName] || '';
  }
  
  // Try case-insensitive match
  const lowerColumnName = columnName.toLowerCase();
  for (const key in row) {
    if (key.toLowerCase() === lowerColumnName) {
      return row[key] || '';
    }
  }
  
  return '';
}

/**
 * Parse mentee data where:
 * - Application and Interview CSVs have the same IDs (Mentee Number)
 * - CRITICAL: Each row after the header represents exactly ONE mentee (one person)
 * - Application and interview data are merged by matching ID
 * - applicationData array: each element is ONE mentee
 * - interviewData array: each element is ONE mentee
 */
export function parseMenteeData(
  applicationData: Record<string, string>[], 
  interviewData: Record<string, string>[] = []
): Mentee[] {
  const mentees: Mentee[] = [];
  
  console.log('Parsing mentee data...');
  console.log(`Application data: ${applicationData.length} mentees (rows after header)`);
  console.log(`Interview data: ${interviewData.length} mentees (rows after header)`);
  
  // Create a map from application data by ID (Mentee Number)
  // IMPORTANT: Each element in applicationData array represents ONE mentee (one person)
  // Each row from CSV = one mentee = one element in applicationData array
  const applicationMap = new Map<string, Record<string, string>>();
  for (let i = 0; i < applicationData.length; i++) {
    const menteeRow = applicationData[i]; // This is ONE mentee's data
    const menteeId = getColumn(menteeRow, 'Mentee Number').trim();
    
    if (!menteeId) {
      console.error(`Mentee ${i + 1} in application data has no Mentee Number. Keys:`, Object.keys(menteeRow));
      console.error('Mentee data:', menteeRow);
      continue;
    }
    
    // Validate that this mentee row represents one person (not multiple columns concatenated)
    const allValues = Object.values(menteeRow);
    if (allValues.length === 1 && allValues[0].includes(',')) {
      console.error(`Mentee ${i + 1} appears to have all data concatenated. This mentee may not be parsed correctly.`);
      console.error('Mentee data:', menteeRow);
    }
    
    // CRITICAL: Each menteeRow represents ONE mentee
    if (applicationMap.has(menteeId)) {
      console.warn(`Duplicate Mentee Number in application data: ${menteeId} (mentee ${i + 1})`);
    }
    applicationMap.set(menteeId, menteeRow); // Store this ONE mentee's data
  }
  
  // If interviewData is provided (not merged), create map from interview data
  // If empty array, data is already merged in applicationData
  const interviewMap = new Map<string, Record<string, string>>();
  if (interviewData.length > 0) {
    // Create a map from interview data by ID (Mentee Number)
    // IMPORTANT: Each element in interviewData array represents ONE mentee (one person)
    // Each row from CSV = one mentee = one element in interviewData array
    for (let i = 0; i < interviewData.length; i++) {
      const menteeRow = interviewData[i]; // This is ONE mentee's data
      const menteeId = getColumn(menteeRow, 'Mentee Number').trim();
      
      if (!menteeId) {
        console.error(`Mentee ${i + 1} in interview data has no Mentee Number. Keys:`, Object.keys(menteeRow));
        console.error('Mentee data:', menteeRow);
        continue;
      }
      
      // CRITICAL: Each menteeRow represents ONE mentee
      if (interviewMap.has(menteeId)) {
        console.warn(`Duplicate Mentee Number in interview data: ${menteeId} (mentee ${i + 1})`);
      }
      interviewMap.set(menteeId, menteeRow); // Store this ONE mentee's data
    }
  } else {
    console.log('Interview data is empty - using merged data from applicationData');
  }
  
  // Get all unique IDs from both sources
  // Each ID corresponds to ONE mentee (one person)
  // If interviewData is empty, use only applicationData (which contains merged data)
  const allMenteeIds = new Set(
    interviewData.length > 0 
      ? [...applicationMap.keys(), ...interviewMap.keys()]
      : applicationMap.keys()
  );
  
  console.log(`Found ${allMenteeIds.size} unique mentees (one person per ID)`);
  
  // Merge data: each mentee ID corresponds to ONE mentee with data from both application and interview
  for (const menteeId of allMenteeIds) {
    // Each of these represents ONE mentee's data
    // If interviewData is empty, applicationData already contains merged data
    const appRow = applicationMap.get(menteeId) || {}; // ONE mentee's application data (or merged data)
    const interviewRow = interviewMap.get(menteeId) || {}; // ONE mentee's interview data (empty if already merged)
    
    if (interviewData.length > 0) {
      if (!applicationMap.has(menteeId)) {
        console.warn(`Mentee ${menteeId} found in interview but not in application`);
      }
      if (!interviewMap.has(menteeId)) {
        console.warn(`Mentee ${menteeId} found in application but not in interview`);
      }
    }
    
    // Create ONE mentee object from merged application and interview data
    // This push adds ONE mentee to the mentees array
    mentees.push({
      id: menteeId,
      name: `Mentee ${menteeId}`,
      // If data is already merged, appRow contains all columns from both application and interview
      // Otherwise, try interview row first, then fall back to application row
      background: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Background') || getColumn(appRow, 'Background'),
      availability: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Availability') || getColumn(appRow, 'Availability'),
      studyPlan: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Study Plan') || getColumn(appRow, 'Study Plan'),
      threeYearPlan: getColumn(interviewData.length > 0 ? interviewRow : appRow, '3-Year Plan') || getColumn(appRow, '3-Year Plan'),
      studyLanguage: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Study Language') || getColumn(appRow, 'Study Language'),
      languageLevel: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Language Level') || getColumn(appRow, 'Language Level'),
      supportNeeds: (getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Support Needs') || getColumn(appRow, 'Support Needs'))
        .split(',').map(s => s.trim()).filter(Boolean),
      mentorSupport: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Mentor Support') || getColumn(appRow, 'Mentor Support'),
      seetKnowledge: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'SEET Knowledge') || getColumn(appRow, 'SEET Knowledge'),
      conflictResolution: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Conflict Resolution') || getColumn(appRow, 'Conflict Resolution'),
      eventInterest: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Event Interest') || getColumn(appRow, 'Event Interest'),
      additionalInfo: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Additional Info') || getColumn(appRow, 'Additional Info'),
      // Extract fields from application that will be displayed
      rawData: {
        birthday: getColumn(appRow, 'Birthday'),
        desiredStudies: getColumn(appRow, 'Desired Studies'),
        desiredGender: getColumn(appRow, 'Desired gender of mentor'),
        english: getColumn(appRow, 'English'),
        furtherLanguageSkills: getColumn(appRow, 'Further language skills'),
        gender: getColumn(appRow, 'Gender'),
        german: getColumn(appRow, 'German'),
        residenceCity: getColumn(appRow, 'Residence (city)'),
        studyReason: getColumn(appRow, 'Do you know if you want to study, and if yes, why? Do you know what you want to study, and if yes, what and why?'),
        previousStudies: getColumn(appRow, 'Previous studies (level)'),
        degreeNameCountry: getColumn(appRow, 'Name and country of last degree'),
      },
      age: undefined,
      gender: getColumn(appRow, 'Gender'),
      location: getColumn(appRow, 'Residence (city)'),
      languages: [
        getColumn(appRow, 'German') && 'German',
        getColumn(appRow, 'English') && 'English',
        getColumn(appRow, 'Further language skills'),
      ].filter(Boolean) as string[],
      degree: getColumn(appRow, 'Previous studies (level)'),
    });
  }
  
  console.log(`✓ Parsed ${mentees.length} mentees (each element = one person)`);
  if (mentees.length > 0) {
    console.log('Sample mentee (one person):', mentees[0]);
  }
  
  // Return array where each element represents ONE mentee (one person)
  return mentees;
}

/**
 * Parse mentor data where:
 * - Application and Interview CSVs have the same IDs (Mentor Number)
 * - CRITICAL: Each row after the header represents exactly ONE mentor (one person)
 * - Application and interview data are merged by matching ID
 * - applicationData array: each element is ONE mentor
 * - interviewData array: each element is ONE mentor
 */
export function parseMentorData(
  applicationData: Record<string, string>[], 
  interviewData: Record<string, string>[] = []
): Mentor[] {
  const mentors: Mentor[] = [];
  
  console.log('Parsing mentor data...');
  console.log(`Application data: ${applicationData.length} mentors (rows after header)`);
  console.log(`Interview data: ${interviewData.length} mentors (rows after header)`);
  
  // Create a map from application data by ID (Mentor Number)
  // IMPORTANT: Each element in applicationData array represents ONE mentor (one person)
  // Each row from CSV = one mentor = one element in applicationData array
  const applicationMap = new Map<string, Record<string, string>>();
  for (let i = 0; i < applicationData.length; i++) {
    const mentorRow = applicationData[i]; // This is ONE mentor's data
    const mentorId = getColumn(mentorRow, 'Mentor Number').trim();
    
    if (!mentorId) {
      console.error(`Mentor ${i + 1} in application data has no Mentor Number. Keys:`, Object.keys(mentorRow));
      console.error('Mentor data:', mentorRow);
      continue;
    }
    
    // Validate that this mentor row represents one person (not multiple columns concatenated)
    const allValues = Object.values(mentorRow);
    if (allValues.length === 1 && allValues[0].includes(',')) {
      console.error(`Mentor ${i + 1} appears to have all data concatenated. This mentor may not be parsed correctly.`);
      console.error('Mentor data:', mentorRow);
    }
    
    // CRITICAL: Each mentorRow represents ONE mentor
    if (applicationMap.has(mentorId)) {
      console.warn(`Duplicate Mentor Number in application data: ${mentorId} (mentor ${i + 1})`);
    }
    applicationMap.set(mentorId, mentorRow); // Store this ONE mentor's data
  }
  
  // If interviewData is provided (not merged), create map from interview data
  // If empty array, data is already merged in applicationData
  const interviewMap = new Map<string, Record<string, string>>();
  if (interviewData.length > 0) {
    // Create a map from interview data by ID (Mentor Number)
    // IMPORTANT: Each element in interviewData array represents ONE mentor (one person)
    // Each row from CSV = one mentor = one element in interviewData array
    for (let i = 0; i < interviewData.length; i++) {
      const mentorRow = interviewData[i]; // This is ONE mentor's data
      const mentorId = getColumn(mentorRow, 'Mentor Number').trim();
      
      if (!mentorId) {
        console.error(`Mentor ${i + 1} in interview data has no Mentor Number. Keys:`, Object.keys(mentorRow));
        console.error('Mentor data:', mentorRow);
        continue;
      }
      
      // CRITICAL: Each mentorRow represents ONE mentor
      if (interviewMap.has(mentorId)) {
        console.warn(`Duplicate Mentor Number in interview data: ${mentorId} (mentor ${i + 1})`);
      }
      interviewMap.set(mentorId, mentorRow); // Store this ONE mentor's data
    }
  } else {
    console.log('Interview data is empty - using merged data from applicationData');
  }
  
  // Get all unique IDs from both sources
  // Each ID corresponds to ONE mentor (one person)
  const allMentorIds = new Set([
    ...applicationMap.keys(),
    ...(interviewData.length > 0 ? interviewMap.keys() : []),
  ]);
  
  console.log(`Found ${allMentorIds.size} unique mentors (one person per ID)`);
  
  // Merge data: each mentor ID corresponds to ONE mentor with data from both application and interview
  for (const mentorId of allMentorIds) {
    // Each of these represents ONE mentor's data
    // If interviewData is empty, applicationData already contains merged data
    const appRow = applicationMap.get(mentorId) || {}; // ONE mentor's application data (or merged data)
    const interviewRow = interviewMap.get(mentorId) || {}; // ONE mentor's interview data (empty if already merged)
    
    if (interviewData.length > 0) {
      if (!applicationMap.has(mentorId)) {
        console.warn(`Mentor ${mentorId} found in interview but not in application`);
      }
      if (!interviewMap.has(mentorId)) {
        console.warn(`Mentor ${mentorId} found in application but not in interview`);
      }
    }
    
    // Extract date of birth and calculate birth year
    const dobStr = getColumn(appRow, 'Geburtsdatum / Date of birth');
    let birthYear = 1990;
    if (dobStr) {
      const yearMatch = dobStr.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        birthYear = parseInt(yearMatch[0]);
      }
    }
    
    // Extract name - ensure it's clean
    let mentorName = getColumn(appRow, 'Name') || '';
    
    // Validate name doesn't contain commas (which would indicate concatenated data)
    if (mentorName.includes(',') && mentorName.split(',').length > 2) {
      console.warn(`Mentor ${mentorId} name appears to have concatenated data: "${mentorName}"`);
      // Try to extract just the first part (actual name)
      const nameParts = mentorName.split(',');
      mentorName = nameParts[0].trim();
      console.warn(`Extracted name: "${mentorName}"`);
    }
    
    // If name is still empty or looks wrong, use ID
    if (!mentorName || mentorName.trim().length === 0 || mentorName.includes('YES') || mentorName.includes('NO')) {
      console.warn(`Mentor ${mentorId} has invalid name: "${mentorName}", using ID instead`);
      mentorName = `Mentor ${mentorId}`;
    }
    
    // Create ONE mentor object from merged application and interview data
    // This push adds ONE mentor to the mentors array
    mentors.push({
      id: mentorId,
      name: mentorName,
      degree: getColumn(appRow, 'Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study'),
      currentlyStudying: getColumn(appRow, 'Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study'),
      // If data is already merged, appRow contains all columns from both application and interview
      // Otherwise, try interview row first, then fall back to application row
      evaluation: getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Evaluation') || '',
      birthYear: birthYear,
      gender: getColumn(appRow, 'Geschlecht / Gender'),
      motivation: getColumn(appRow, 'Motivation') || getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Motivation'),
      nationality: getColumn(appRow, 'Nationality') || '',
      location: getColumn(appRow, 'Postadresse / Postal address'),
      languages: [
        getColumn(appRow, 'Sprachkenntnisse Deutsch / Language skills German') && 'German',
        getColumn(appRow, 'Sprachkenntnisse Englisch / Language skills English') && 'English',
        getColumn(appRow, 'Weitere Sprachkenntnisse / Other language skills'),
      ].filter(Boolean) as string[],
      languageLevels: {},
      availability: getColumn(appRow, 'Availability') || getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Availability'),
      additionalInfo: getColumn(appRow, 'Additional Info') || getColumn(interviewData.length > 0 ? interviewRow : appRow, 'Additional Info'),
      // Extract fields that will be displayed
      rawData: {
        studyLevel: getColumn(appRow, 'Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study'),
        studyCourse: getColumn(appRow, 'Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study'),
        dateOfBirth: getColumn(appRow, 'Geburtsdatum / Date of birth'),
        gender: getColumn(appRow, 'Geschlecht / Gender'),
        postalAddress: getColumn(appRow, 'Postadresse / Postal address'),
        germanLanguage: getColumn(appRow, 'Sprachkenntnisse Deutsch / Language skills German'),
        englishLanguage: getColumn(appRow, 'Sprachkenntnisse Englisch / Language skills English'),
        otherLanguages: getColumn(appRow, 'Weitere Sprachkenntnisse / Other language skills'),
      },
    });
  }
  
  console.log(`✓ Parsed ${mentors.length} mentors (each element = one person)`);
  if (mentors.length > 0) {
    console.log('Sample mentor (one person):', mentors[0]);
  }
  
  // Return array where each element represents ONE mentor (one person)
  return mentors;
}
