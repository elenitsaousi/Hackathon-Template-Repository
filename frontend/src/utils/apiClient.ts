import type { MatchingParameters } from '../types';

const API_BASE_URL = 'http://localhost:8000';

interface CategoryScores {
  [mentorMenteeKey: string]: any; // Can be number or object with detailed scores
}

interface CategoryScoresResponse {
  gender: CategoryScores;
  academia: CategoryScores;
  languages: CategoryScores;
  age_difference: CategoryScores;
  geographic_proximity: CategoryScores;
}

interface APIResponse {
  category_scores: CategoryScoresResponse;
  final_matches: any[];
}

export async function fetchMatchingScores(
  mentorApplicationFile: File | null,
  mentorInterviewFile: File | null,
  menteeApplicationFile: File | null,
  menteeInterviewFile: File | null,
  parameters: MatchingParameters,
  manualMatches?: string[],
  manualNonMatches?: string[]
): Promise<APIResponse> {
  try {
    // Build FormData for multipart/form-data request
    const formData = new FormData();
    
    // Add files to form data
    if (mentorApplicationFile) {
      formData.append('mentor_application_file', mentorApplicationFile);
    }
    if (mentorInterviewFile) {
      formData.append('mentor_interview_file', mentorInterviewFile);
    }
    if (menteeApplicationFile) {
      formData.append('mentee_application_file', menteeApplicationFile);
    }
    if (menteeInterviewFile) {
      formData.append('mentee_interview_file', menteeInterviewFile);
    }

    // Add importance modifiers if any are different from default
    const importanceModifiers: any = {};
    let hasNonDefaultModifiers = false;
    
    if (parameters.genderWeight !== 1.0) {
      importanceModifiers.gender = parameters.genderWeight;
      hasNonDefaultModifiers = true;
    }
    if (parameters.academiaWeight !== 1.0) {
      importanceModifiers.academia = parameters.academiaWeight;
      hasNonDefaultModifiers = true;
    }
    if (parameters.languagesWeight !== 1.0) {
      importanceModifiers.languages = parameters.languagesWeight;
      hasNonDefaultModifiers = true;
    }
    if (parameters.ageDifferenceWeight !== 1.0) {
      importanceModifiers.age_difference = parameters.ageDifferenceWeight;
      hasNonDefaultModifiers = true;
    }
    if (parameters.geographicProximityWeight !== 1.0) {
      importanceModifiers.geographic_proximity = parameters.geographicProximityWeight;
      hasNonDefaultModifiers = true;
    }

    if (hasNonDefaultModifiers) {
      formData.append('importance_modifiers_json', JSON.stringify(importanceModifiers));
    }

    // Add max constraints if different from defaults
    if (parameters.maxAgeDifference !== 30) {
      formData.append('age_max_difference', parameters.maxAgeDifference.toString());
    }

    if (parameters.maxDistance && parameters.maxDistance !== 200) {
      formData.append('geographic_max_distance', parameters.maxDistance.toString());
    }

    // Add manual matches and non-matches if provided
    if (manualMatches && manualMatches.length > 0) {
      formData.append('manual_matches_json', JSON.stringify(manualMatches));
    }
    if (manualNonMatches && manualNonMatches.length > 0) {
      formData.append('manual_non_matches_json', JSON.stringify(manualNonMatches));
    }

    const response = await fetch(`${API_BASE_URL}/matching`, {
      method: 'POST',
      body: formData, // FormData will set Content-Type header with boundary
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.category_scores || !data.final_matches) {
      throw new Error('Invalid API response structure: missing category_scores or final_matches');
    }
    
    if (!data.category_scores.gender || !data.category_scores.academia || 
        !data.category_scores.languages || !data.category_scores.age_difference || 
        !data.category_scores.geographic_proximity) {
      throw new Error('Invalid API response structure: missing category scores');
    }

    return data;
  } catch (error) {
    console.error('Error fetching matching scores:', error);
    // Return empty response if API fails
    return {
      category_scores: {
        gender: {},
        academia: {},
        languages: {},
        age_difference: {},
        geographic_proximity: {},
      },
      final_matches: [],
    };
  }
}
