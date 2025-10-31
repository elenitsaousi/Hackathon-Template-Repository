/**
 * Utility to load demo CSV files from the backend data directory
 */
const API_BASE_URL = 'http://localhost:8000';

export async function loadDemoCSV(filename: string): Promise<File> {
  try {
    // Validate filename
    if (!filename || filename.trim().length === 0) {
      throw new Error('Filename cannot be empty');
    }
    
    // Use query parameter instead of path parameter for better compatibility with spaces
    // encodeURIComponent properly handles spaces, special characters, and unicode
    const encodedFilename = encodeURIComponent(filename);
    const url = `${API_BASE_URL}/demo-csv?filename=${encodedFilename}`;
    
    console.log(`Fetching demo CSV: "${filename}"`);
    console.log(`Encoded filename: ${encodedFilename}`);
    console.log(`URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv, */*',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch "${filename}":`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: url,
      });
      throw new Error(
        `Failed to fetch "${filename}": ${response.status} ${response.statusText}. ${errorText}`
      );
    }
    
    const text = await response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error(`Received empty response for "${filename}"`);
    }
    
    console.log(`✓ Successfully loaded "${filename}" (${text.length} bytes)`);
    
    // Create a File object from the text content
    // Preserve original filename (with spaces) for the File object
    const blob = new Blob([text], { type: 'text/csv; charset=utf-8' });
    const file = new File([blob], filename, { 
      type: 'text/csv; charset=utf-8',
      lastModified: Date.now(),
    });
    
    return file;
  } catch (error) {
    console.error(`Error loading demo CSV "${filename}":`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unknown error loading "${filename}": ${String(error)}`);
  }
}

/**
 * Load all demo CSV files from the backend
 * All 4 files are required and must exist
 */
export async function loadDemoCSVFiles(): Promise<{
  mentorApplication: File;
  mentorInterview: File;
  menteeApplication: File;
  menteeInterview: File;
}> {
  console.log('Loading demo CSV files from backend...');
  
  const fileNames = {
    mentorApplication: 'mentor_application.csv',
    mentorInterview: 'mentor_interview.csv',
    menteeApplication: 'mentee_application.csv',
    menteeInterview: 'mentee_interview.csv',
  };
  
  try {
    // Load all 4 required files sequentially to catch errors early
    console.log('\n=== Loading Demo CSV Files from Backend ===');
    console.log(`Step 1/4: Loading ${fileNames.mentorApplication}`);
    const mentorApplication = await loadDemoCSV(fileNames.mentorApplication);
    console.log(`  ✓ Loaded ${mentorApplication.name} (${mentorApplication.size} bytes)`);
    
    console.log(`Step 2/4: Loading ${fileNames.mentorInterview}`);
    const mentorInterview = await loadDemoCSV(fileNames.mentorInterview);
    console.log(`  ✓ Loaded ${mentorInterview.name} (${mentorInterview.size} bytes)`);
    
    console.log(`Step 3/4: Loading ${fileNames.menteeApplication}`);
    const menteeApplication = await loadDemoCSV(fileNames.menteeApplication);
    console.log(`  ✓ Loaded ${menteeApplication.name} (${menteeApplication.size} bytes)`);
    
    console.log(`Step 4/4: Loading ${fileNames.menteeInterview}`);
    const menteeInterview = await loadDemoCSV(fileNames.menteeInterview);
    console.log(`  ✓ Loaded ${menteeInterview.name} (${menteeInterview.size} bytes)`);
    
    console.log('\n✓ All 4 demo CSV files loaded successfully from backend');
    
    return {
      mentorApplication,
      mentorInterview,
      menteeApplication,
      menteeInterview,
    };
  } catch (error) {
    console.error('Error loading demo CSV files:', error);
    throw new Error(
      `Failed to load demo CSV files. Make sure:\n` +
      `1. Backend server is running on http://localhost:8000\n` +
      `2. CSV files exist in the backend's /data directory\n` +
      `3. Backend server has been restarted after route changes\n\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

