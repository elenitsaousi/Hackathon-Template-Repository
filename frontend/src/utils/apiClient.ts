import type { MatchingParameters } from '../types';

const API_BASE_URL = 'http://localhost:8000';

interface CategoryScores {
  [mentorMenteeKey: string]: number;
}

interface APIResponse {
  gender: CategoryScores;
  academia: CategoryScores;
  languages: CategoryScores;
  age_difference: CategoryScores;
  geographic_proximity: CategoryScores;
}

export async function fetchMatchingScores(
  mentorApplicationFile: File | null,
  mentorInterviewFile: File | null,
  menteeApplicationFile: File | null,
  menteeInterviewFile: File | null,
  parameters: MatchingParameters,
  manualMatches?: string[],
  manualNonMatches?: string[]
): Promise<APIResponse & { final_matches?: any[] }> {
  try {
    // Build request body with file names and parameters
    const requestBody: any = {};
    
    // Send file names - backend expects paths relative to data directory
    // Note: Files should be uploaded to the backend data directory first
    // For now, we use the file names assuming they're in the data directory
    if (menteeApplicationFile) {
      requestBody.mentees_application_csv = menteeApplicationFile.name;
    }
    if (menteeInterviewFile) {
      requestBody.mentees_interview_csv = menteeInterviewFile.name;
    }
    if (mentorApplicationFile) {
      requestBody.mentors_application_csv = mentorApplicationFile.name;
    }
    if (mentorInterviewFile) {
      requestBody.mentors_interview_csv = mentorInterviewFile.name;
    }

    // Add importance modifiers if any are different from default
    if (parameters.genderWeight !== 1.0 || 
        parameters.academiaWeight !== 1.0 ||
        parameters.languagesWeight !== 1.0 ||
        parameters.ageDifferenceWeight !== 1.0 ||
        parameters.geographicProximityWeight !== 1.0) {
      requestBody.importance_modifiers = {
        gender: parameters.genderWeight,
        academia: parameters.academiaWeight,
        languages: parameters.languagesWeight,
        age_difference: parameters.ageDifferenceWeight,
        geographic_proximity: parameters.geographicProximityWeight,
      };
    }

    // Add max constraints if different from defaults
    if (parameters.maxAgeDifference !== 30) {
      requestBody.age_max_difference = parameters.maxAgeDifference;
    }

    if (parameters.maxDistance && parameters.maxDistance !== 200) {
      requestBody.geographic_max_distance = parameters.maxDistance;
    }

    // Add manual matches and non-matches if provided
    if (manualMatches && manualMatches.length > 0) {
      requestBody.manual_matches = manualMatches;
    }
    if (manualNonMatches && manualNonMatches.length > 0) {
      requestBody.manual_non_matches = manualNonMatches;
    }

    const response = await fetch(`${API_BASE_URL}/matching`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.gender || !data.academia || !data.languages || 
        !data.age_difference || !data.geographic_proximity) {
      throw new Error('Invalid API response structure');
    }

    return data;
  } catch (error) {
    console.error('Error fetching matching scores:', error);
    // Return empty scores if API fails - no connections will be made
    return {
      gender: {},
      academia: {},
      languages: {},
      age_difference: {},
      geographic_proximity: {},
    };
  }
}
