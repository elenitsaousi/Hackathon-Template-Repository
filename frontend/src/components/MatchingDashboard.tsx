import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { ParameterControls } from './ParameterControls';
import { MatchingGraph } from './MatchingGraph';
import { DetailPanel } from './DetailPanel';
import { MatchScorePanel } from './MatchScorePanel';
import { FinalMatchesDisplay } from './FinalMatchesDisplay';
import { Settings } from 'lucide-react';
import { parseMenteeData, parseMentorData, parseCSV } from '../utils/csvParser';
import { createMergedData } from '../utils/csvMerger';
import { fetchMatchingScores } from '../utils/apiClient';
import { loadDemoCSVFiles } from '../utils/demoDataLoader';
import { calculateOptimalMatching } from '../utils/optimalMatching';
import type { Mentor, Mentee, Match, MatchingParameters } from '../types';

interface MatchingDashboardProps {
  uploadedFiles: {
    mentorApplication: File | null;
    mentorInterview: File | null;
    menteeApplication: File | null;
    menteeInterview: File | null;
  };
}

export function MatchingDashboard({ uploadedFiles }: MatchingDashboardProps) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [parameters, setParameters] = useState<MatchingParameters>({
    genderWeight: 1.0,
    academiaWeight: 1.0,
    languagesWeight: 1.0,
    ageDifferenceWeight: 1.0,
    geographicProximityWeight: 1.0,
    maxAgeDifference: 30,
    maxDistance: 200,
  });
  const [selectedMentor, setSelectedMentor] = useState<string | null>(null);
  const [selectedMentee, setSelectedMentee] = useState<string | null>(null);
  const [manualMatches, setManualMatches] = useState<Set<string>>(new Set());
  const [manualNonMatches, setManualNonMatches] = useState<Set<string>>(new Set());
  const [categoryScores, setCategoryScores] = useState<any>(null);
  const [finalMatches, setFinalMatches] = useState<any[]>([]);
  const [lastMatchedParameters, setLastMatchedParameters] = useState<MatchingParameters | null>(null);
  const [lastProcessedFiles, setLastProcessedFiles] = useState<string>('');

  // Auto-trigger matching when files are loaded (either from defaults or uploaded)
  useEffect(() => {
    // Create a unique identifier for the current file set
    // Use file names and sizes to detect changes (file objects may be recreated)
    const fileIdentifier = [
      uploadedFiles.mentorApplication?.name || 'none',
      uploadedFiles.mentorApplication?.size || 0,
      uploadedFiles.mentorInterview?.name || 'none',
      uploadedFiles.mentorInterview?.size || 0,
      uploadedFiles.menteeApplication?.name || 'none',
      uploadedFiles.menteeApplication?.size || 0,
      uploadedFiles.menteeInterview?.name || 'none',
      uploadedFiles.menteeInterview?.size || 0,
    ].join('|');
    
    // Check if all 4 files are available OR if files have changed
    const hasAllFiles = uploadedFiles.mentorApplication && uploadedFiles.mentorInterview &&
                        uploadedFiles.menteeApplication && uploadedFiles.menteeInterview;
    
    // Trigger matching if:
    // 1. All files are uploaded (different from last processed)
    // 2. This is the first load (lastProcessedFiles is empty)
    const filesChanged = fileIdentifier !== lastProcessedFiles;
    
    if ((hasAllFiles || lastProcessedFiles === '') && filesChanged) {
      console.log('Files available or changed - triggering automatic matching...');
      loadDataAndFetchScores();
      setLastProcessedFiles(fileIdentifier);
    }
  }, [
    uploadedFiles.mentorApplication,
    uploadedFiles.mentorInterview,
    uploadedFiles.menteeApplication,
    uploadedFiles.menteeInterview,
    lastProcessedFiles,
  ]);

  const loadDataAndFetchScores = async () => {
    setLoading(true);
    try {
      let filesToUse = {
        mentorApplication: uploadedFiles.mentorApplication,
        mentorInterview: uploadedFiles.mentorInterview,
        menteeApplication: uploadedFiles.menteeApplication,
        menteeInterview: uploadedFiles.menteeInterview,
      };

      // If files aren't uploaded, load from data directory
      // All 4 files are required: mentorApplication, mentorInterview, menteeApplication, menteeInterview
      if (!uploadedFiles.mentorApplication || !uploadedFiles.mentorInterview ||
          !uploadedFiles.menteeApplication || !uploadedFiles.menteeInterview) {
        console.log('Files not uploaded, loading all 4 files from data directory...');
        const dataDirFiles = await loadDemoCSVFiles();
        filesToUse = {
          mentorApplication: dataDirFiles.mentorApplication,
          mentorInterview: dataDirFiles.mentorInterview,
          menteeApplication: dataDirFiles.menteeApplication,
          menteeInterview: dataDirFiles.menteeInterview,
        };
        setUsingMockData(true); // Mark that we're using data directory files
      }

      console.log('=== Starting CSV Parsing ===');
      console.log(`Files to use:`, {
        mentorApp: filesToUse.mentorApplication?.name,
        mentorInt: filesToUse.mentorInterview?.name,
        menteeApp: filesToUse.menteeApplication?.name,
        menteeInt: filesToUse.menteeInterview?.name,
      });
      
      // Parse CSV files - all 4 files are required
      console.log('\n--- Step 1: Parsing CSV files ---');
      const mentorAppData = await parseCSV(filesToUse.mentorApplication!);
      console.log(`✓ Mentor Application: ${mentorAppData.length} rows (people) parsed`);
      
      const mentorIntData = await parseCSV(filesToUse.mentorInterview!);
      console.log(`✓ Mentor Interview: ${mentorIntData.length} rows (people) parsed`);
      
      const menteeAppData = await parseCSV(filesToUse.menteeApplication!);
      console.log(`✓ Mentee Application: ${menteeAppData.length} rows (people) parsed`);
      
      const menteeIntData = await parseCSV(filesToUse.menteeInterview!);
      console.log(`✓ Mentee Interview: ${menteeIntData.length} rows (people) parsed`);

      // Validate CSV parsing results
      if (mentorAppData.length === 0) {
        throw new Error('Mentor Application CSV has no valid data rows');
      }
      if (menteeAppData.length === 0) {
        throw new Error('Mentee Application CSV has no valid data rows');
      }

      // Merge application and interview data (like backend's _create_merged_csvs)
      console.log('\n--- Step 2: Merging application and interview data ---');
      const { mergedMentees, mergedMentors } = createMergedData(
        mentorAppData,
        mentorIntData,
        menteeAppData,
        menteeIntData
      );

      console.log('\n--- Step 3: Extracting structured data from merged data ---');
      // Parse merged data into structured objects
      // Note: We pass empty arrays for interview since data is already merged
      const parsedMentors = parseMentorData(mergedMentors, []);
      const parsedMentees = parseMenteeData(mergedMentees, []);

      // Validate we have data
      console.log('\n--- Step 4: Validation ---');
      console.log(`Mentors parsed: ${parsedMentors.length}`);
      console.log(`Mentees parsed: ${parsedMentees.length}`);
      
      if (parsedMentors.length === 0 || parsedMentees.length === 0) {
        throw new Error(
          `No valid data found in CSV files.\n\nMentors found: ${parsedMentors.length}\nMentees found: ${parsedMentees.length}\n\nCheck the browser console for parsing details.`
        );
      }

      // Log sample data to verify structure
      console.log('\n--- Sample Data Verification ---');
      if (parsedMentors.length > 0) {
        console.log(`Sample Mentor (ID: ${parsedMentors[0].id}):`, {
          id: parsedMentors[0].id,
          name: parsedMentors[0].name,
          hasRawData: !!parsedMentors[0].rawData,
          location: parsedMentors[0].location,
        });
      }
      if (parsedMentees.length > 0) {
        console.log(`Sample Mentee (ID: ${parsedMentees[0].id}):`, {
          id: parsedMentees[0].id,
          name: parsedMentees[0].name,
          hasRawData: !!parsedMentees[0].rawData,
          location: parsedMentees[0].location,
        });
      }

      // Log all mentor and mentee IDs to verify completeness
      console.log('\n--- All Loaded IDs ---');
      console.log(`Mentor IDs (${parsedMentors.length} total):`, parsedMentors.map(m => m.id).sort((a, b) => parseInt(a) - parseInt(b)));
      console.log(`Mentee IDs (${parsedMentees.length} total):`, parsedMentees.map(m => m.id).sort((a, b) => parseInt(a) - parseInt(b)));

      console.log(`\n✓ Successfully parsed ${parsedMentors.length} mentors and ${parsedMentees.length} mentees`);

      setMentors(parsedMentors);
      setMentees(parsedMentees);

      // Don't initialize matches here - wait for backend to return final_matches with total_score
      // Matches will be set after fetchAndCalculateScores completes
      setMatches([]);
      console.log(`✓ Loaded ${parsedMentors.length} mentors and ${parsedMentees.length} mentees - waiting for backend to return matches with total_score`);

      // Fetch scores from API - pass files to backend
      await fetchAndCalculateScores(
        filesToUse.mentorApplication,
        filesToUse.mentorInterview,
        filesToUse.menteeApplication,
        filesToUse.menteeInterview,
        parsedMentors,
        parsedMentees,
        parameters
      );
    } catch (error) {
      console.error('Error loading data:', error);
      alert(`Error loading CSV data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck that the backend is running and the CSV files exist in the data directory.`);
      setMentors([]);
      setMentees([]);
      setMatches([]);
      setCategoryScores(null);
    } finally {
      setLoading(false);
    }
  };


  const fetchAndCalculateScores = async (
    mentorAppFile: File | null,
    mentorIntFile: File | null,
    menteeAppFile: File | null,
    menteeIntFile: File | null,
    mentorData: Mentor[],
    menteeData: Mentee[],
    params: MatchingParameters
  ) => {
    try {
      // Fetch category scores from backend - pass files
      const apiResponse = await fetchMatchingScores(
        mentorAppFile,
        mentorIntFile,
        menteeAppFile,
        menteeIntFile,
        params
      );
      // Store category scores from new API response structure
      const categoryScores = apiResponse.category_scores || apiResponse;
      setCategoryScores(categoryScores);

      // For initial fetch, if no final_matches are available, don't create matches
      // We only create matches from backend final_matches which have total_score
      if (apiResponse.final_matches && Array.isArray(apiResponse.final_matches) && apiResponse.final_matches.length > 0) {
        const calculatedMatches = calculateAggregateMatches(
          mentorData,
          menteeData,
          categoryScores,
          params,
          apiResponse.final_matches // Use final_matches from backend
        );
        setMatches(calculatedMatches);
        setFinalMatches(apiResponse.final_matches);
      } else {
        console.log('No final_matches from backend during initial fetch - setting empty matches');
        setMatches([]);
        setFinalMatches([]);
      }
    } catch (error) {
      console.error('Error fetching scores:', error);
      // Don't create matches if API fails - connections only come from backend
      setMatches([]);
      setCategoryScores(null);
    }
  };

  const calculateAggregateMatches = (
    mentorData: Mentor[],
    menteeData: Mentee[],
    scores: any,
    params: MatchingParameters,
    finalMatches: any[] // Required - get total_score from backend
  ): Match[] => {
    const matches: Match[] = [];

    // Only use total_score from backend - do not calculate anything
    // Only create matches for pairs that have total_score from backend final_matches
    if (!finalMatches || finalMatches.length === 0) {
      console.log('No final_matches from backend - cannot create matches without total_score');
      return matches;
    }

    // Get category scores for individual category display
    const getScoreValue = (scoreData: any): number | undefined => {
      if (scoreData === undefined || scoreData === null) return undefined;
      if (typeof scoreData === 'number') return scoreData;
      if (typeof scoreData === 'object') {
        // Try common score keys
        return scoreData.gender_score ?? scoreData.academic_score ?? 
               scoreData.score ?? scoreData.birthday_score ?? 
               scoreData.distance_score ?? undefined;
      }
      return undefined;
    };

    // Create matches only from final_matches that have total_score from backend
    finalMatches.forEach((fm: any) => {
      const mentorIdStr = String(fm.mentor_id || fm.mentorId);
      const menteeIdStr = String(fm.mentee_id || fm.menteeId);
      const matchKey = `${mentorIdStr}-${menteeIdStr}`;

      const mentor = mentorData.find(m => m.id === mentorIdStr);
      const mentee = menteeData.find(m => m.id === menteeIdStr);

      if (!mentor || !mentee) {
        console.warn(`Could not find mentor ${mentorIdStr} or mentee ${menteeIdStr} for match from backend`);
        return;
      }

      // Get total_score from backend - this is the only source of truth
      let globalScore: number;
      if (fm.total_score === 'Infinity' || fm.total_score === Infinity || 
          fm.total_score === 'inf' || fm.total_score === '+inf') {
        globalScore = Infinity;
      } else if (fm.total_score === '-Infinity' || fm.total_score === -Infinity || 
                 fm.total_score === '-inf' || fm.total_score === '-inf') {
        globalScore = -Infinity;
      } else if (typeof fm.total_score === 'number' && isFinite(fm.total_score)) {
        globalScore = fm.total_score;
      } else if (typeof fm.total_score === 'number' && !isFinite(fm.total_score)) {
        globalScore = fm.total_score; // Already infinity
      } else {
        console.warn(`Invalid total_score for ${matchKey} from backend:`, fm.total_score);
        return; // Skip this match if total_score is invalid
      }

      // Get individual category scores from category_scores if available, otherwise from final_match
      // Category scores keys are in "mentee_id-mentor_id" format (from backend tuple conversion)
      // matchKey is in "mentor_id-mentee_id" format (frontend standard)
      const categoryScoreKey = `${menteeIdStr}-${mentorIdStr}`;
      
      const genderScore = scores?.gender ? (
        // Try categoryScoreKey first (correct format), then matchKey as fallback
        getScoreValue(scores.gender[categoryScoreKey]) ?? getScoreValue(scores.gender[matchKey])
      ) : (typeof fm.gender_score === 'number' ? fm.gender_score : 0);
      
      const academiaScore = scores?.academia ? (
        getScoreValue(scores.academia[categoryScoreKey]) ?? getScoreValue(scores.academia[matchKey])
      ) : (typeof fm.academic_score === 'number' ? fm.academic_score : 0);
      
      const languagesScore = scores?.languages ? (
        getScoreValue(scores.languages[categoryScoreKey]) ?? getScoreValue(scores.languages[matchKey])
      ) : (typeof fm.language_score === 'number' ? fm.language_score : 0);
      
      const ageDifferenceScore = scores?.age_difference ? (
        getScoreValue(scores.age_difference[categoryScoreKey]) ?? getScoreValue(scores.age_difference[matchKey])
      ) : (typeof fm.age_difference_score === 'number' ? fm.age_difference_score : 0);
      
      const geographicScore = scores?.geographic_proximity ? (
        getScoreValue(scores.geographic_proximity[categoryScoreKey]) ?? getScoreValue(scores.geographic_proximity[matchKey])
      ) : (typeof fm.distance_score === 'number' ? fm.distance_score : 0);

      // Check if any score is -Infinity (immutable non-match)
      const isImmutableNonMatch = 
        (!isFinite(genderScore) && genderScore !== 0 && genderScore < 0) ||
        (!isFinite(academiaScore) && academiaScore !== 0 && academiaScore < 0) ||
        (!isFinite(languagesScore) && languagesScore !== 0 && languagesScore < 0) ||
        (!isFinite(ageDifferenceScore) && ageDifferenceScore !== 0 && ageDifferenceScore < 0) ||
        (!isFinite(geographicScore) && geographicScore !== 0 && geographicScore < 0);

      matches.push({
        mentorId: mentorIdStr,
        menteeId: menteeIdStr,
        globalScore: (typeof globalScore === 'number' && isFinite(globalScore)) 
          ? Math.round(globalScore * 100) / 100 
          : globalScore, // Keep Infinity/-Infinity as-is
        scores: {
          gender: isFinite(genderScore) ? Math.round(genderScore * 100) / 100 : 0,
          academia: isFinite(academiaScore) ? Math.round(academiaScore * 100) / 100 : 0,
          languages: isFinite(languagesScore) ? Math.round(languagesScore * 100) / 100 : 0,
          ageDifference: isFinite(ageDifferenceScore) ? Math.round(ageDifferenceScore * 100) / 100 : 0,
          geographicProximity: isFinite(geographicScore) ? Math.round(geographicScore * 100) / 100 : 0,
        },
        isImmutableNonMatch,
      });
    });

    return matches;
  };

  const handleParameterChange = (newParams: Partial<MatchingParameters>) => {
    const updatedParams = { ...parameters, ...newParams };
    setParameters(updatedParams);
    
    // Don't recalculate matches - keep the existing graph visible
    // The user will need to click "Match" again to update with new parameters
  };
  
  // Check if current parameters differ from the parameters used for current matches
  // Used to change button color (orange when changed, green when up to date)
  const parametersChanged = lastMatchedParameters !== null && 
    JSON.stringify(parameters) !== JSON.stringify(lastMatchedParameters);

  const handleManualMatch = (mentorId: string, menteeId: string) => {
    const matchKey = `${mentorId}-${menteeId}`;
    setManualMatches(prev => new Set(prev).add(matchKey));
    setManualNonMatches(prev => {
      const newSet = new Set(prev);
      newSet.delete(matchKey);
      return newSet;
    });
  };

  const handleManualNonMatch = (mentorId: string, menteeId: string) => {
    const matchKey = `${mentorId}-${menteeId}`;
    setManualNonMatches(prev => new Set(prev).add(matchKey));
    setManualMatches(prev => {
      const newSet = new Set(prev);
      newSet.delete(matchKey);
      return newSet;
    });
  };

  const handleManualMatchToggle = (mentorId: string, menteeId: string, isMatch: boolean) => {
    // Allow manual matching even before matches are loaded
    // Only check immutability if match exists and is truly immutable (blocked by backend)
    const match = matches.find(m => m.mentorId === mentorId && m.menteeId === menteeId);
    if (match?.isImmutableNonMatch === true) {
      console.warn(`Cannot change immutable non-match: ${mentorId}-${menteeId}`);
      return; // Don't allow changes to immutable non-matches
    }
    
    const matchKey = `${mentorId}-${menteeId}`;
    const isCurrentlyManualMatch = manualMatches.has(matchKey);
    const isCurrentlyManualNonMatch = manualNonMatches.has(matchKey);
    
    if (isMatch) {
      // Clicking "Match" button
      if (isCurrentlyManualMatch) {
        // Already a manual match - toggle it off (revert to model prediction)
        setManualMatches(prev => {
          const next = new Set(prev);
          next.delete(matchKey);
          return next;
        });
        console.log(`✓ Manual match removed: ${matchKey} (reverting to model prediction)`);
      } else {
        // Check if this mentor already has a manual match with another mentee
        const mentorHasOtherMatch = Array.from(manualMatches).some(key => {
          const [mId] = key.split('-');
          return mId === mentorId && key !== matchKey;
        });
        
        // Check if this mentee already has a manual match with another mentor
        const menteeHasOtherMatch = Array.from(manualMatches).some(key => {
          const [, meId] = key.split('-');
          return meId === menteeId && key !== matchKey;
        });
        
        if (mentorHasOtherMatch) {
          // Find the existing match
          const existingMatchKey = Array.from(manualMatches).find(key => {
            const [mId] = key.split('-');
            return mId === mentorId && key !== matchKey;
          });
          alert(`This mentor already has a manual match. Please unset the existing match (${existingMatchKey}) first before setting a new one.`);
          console.warn(`Cannot set manual match: mentor ${mentorId} already has a match with another mentee`);
          return;
        }
        
        if (menteeHasOtherMatch) {
          // Find the existing match
          const existingMatchKey = Array.from(manualMatches).find(key => {
            const [, meId] = key.split('-');
            return meId === menteeId && key !== matchKey;
          });
          alert(`This mentee already has a manual match. Please unset the existing match (${existingMatchKey}) first before setting a new one.`);
          console.warn(`Cannot set manual match: mentee ${menteeId} already has a match with another mentor`);
          return;
        }
        
        // Not a manual match - set as manual match
        // First remove from non-matches if it's there
        setManualNonMatches(prev => {
          const next = new Set(prev);
          next.delete(matchKey);
          return next;
        });
        // Then add to matches
        setManualMatches(prev => new Set(prev).add(matchKey));
        console.log(`✓ Manual match set: ${matchKey}`);
      }
    } else {
      // Clicking "Set Not Match" button
      if (isCurrentlyManualNonMatch) {
        // Already a manual non-match - toggle it off (revert to model prediction)
        setManualNonMatches(prev => {
          const next = new Set(prev);
          next.delete(matchKey);
          return next;
        });
        console.log(`✓ Manual non-match removed: ${matchKey} (reverting to model prediction)`);
      } else {
        // Not a manual non-match - set as manual non-match
        // First remove from matches if it's there
        setManualMatches(prev => {
          const next = new Set(prev);
          next.delete(matchKey);
          return next;
        });
        // Then add to non-matches
        // This will trigger optimal matching recalculation, finding new recommendations
        setManualNonMatches(prev => {
          const next = new Set(prev).add(matchKey);
          console.log(`✓ Manual non-match set: ${matchKey} - Optimal matching will recalculate`);
          return next;
        });
      }
    }
    
    // Note: State updates are async, so we log the expected state
    // The actual state will be updated on the next render
  };

  const getMatchStatus = (mentorId: string, menteeId: string): 'manual-match' | 'manual-non-match' | 'auto' => {
    const matchKey = `${mentorId}-${menteeId}`;
    
    // Check if this is an immutable non-match
    const match = matches.find(m => m.mentorId === mentorId && m.menteeId === menteeId);
    if (match?.isImmutableNonMatch) return 'manual-non-match';
    
    if (manualMatches.has(matchKey)) return 'manual-match';
    if (manualNonMatches.has(matchKey)) return 'manual-non-match';
    return 'auto';
  };

  // Check if mentor or mentee already has another manual match
  const hasOtherManualMatch = (mentorId: string, menteeId: string): { mentor: boolean; mentee: boolean } => {
    const matchKey = `${mentorId}-${menteeId}`;
    
    // Check if this mentor already has a manual match with another mentee
    const mentorHasOtherMatch = Array.from(manualMatches).some(key => {
      const [mId] = key.split('-');
      return mId === mentorId && key !== matchKey;
    });
    
    // Check if this mentee already has a manual match with another mentor
    const menteeHasOtherMatch = Array.from(manualMatches).some(key => {
      const [, meId] = key.split('-');
      return meId === menteeId && key !== matchKey;
    });
    
    return { mentor: mentorHasOtherMatch, mentee: menteeHasOtherMatch };
  };

  // Calculate optimal matching (memoized for performance)
  // Recalculates whenever matches or manual selections change
  // When a recommended pair is set to "not match", it's excluded and new recommendations are found
  const optimalMatching = useMemo(() => {
    if (matches.length === 0) return new Set<string>();
    
    const newOptimal = calculateOptimalMatching(matches, manualMatches, manualNonMatches, getMatchStatus);
    console.log(`[Optimal Matching] Recalculated - ${newOptimal.size} recommended pairs`, {
      manualMatches: manualMatches.size,
      manualNonMatches: manualNonMatches.size,
      recommendedPairs: Array.from(newOptimal)
    });
    return newOptimal;
  }, [matches, manualMatches, manualNonMatches, getMatchStatus]);
  
  // Helper function to check if a pair is recommended
  const isRecommendedPair = useCallback((mentorId: string, menteeId: string): boolean => {
    const matchKey = `${mentorId}-${menteeId}`;
    return optimalMatching.has(matchKey);
  }, [optimalMatching]);

  const handleMatch = async () => {
    setLoading(true);
    
    // Store current selections to restore after matching
    const previouslySelectedMentor = selectedMentor;
    const previouslySelectedMentee = selectedMentee;
    
    try {
      // Get current file references (from state or uploaded files)
      let mentorAppFile: File | null = uploadedFiles.mentorApplication;
      let mentorIntFile: File | null = uploadedFiles.mentorInterview;
      let menteeAppFile: File | null = uploadedFiles.menteeApplication;
      let menteeIntFile: File | null = uploadedFiles.menteeInterview;

      // If files aren't available, load from data directory
      if (!mentorAppFile || !mentorIntFile || !menteeAppFile || !menteeIntFile) {
        const dataDirFiles = await loadDemoCSVFiles();
        mentorAppFile = dataDirFiles.mentorApplication;
        mentorIntFile = dataDirFiles.mentorInterview;
        menteeAppFile = dataDirFiles.menteeApplication;
        menteeIntFile = dataDirFiles.menteeInterview;
      }

      // Convert manual matches and non-matches sets to arrays
      const manualMatchesArray = Array.from(manualMatches) as string[];
      const manualNonMatchesArray = Array.from(manualNonMatches) as string[];

      console.log('Calling backend API with manual matches:', manualMatchesArray);
      console.log('Calling backend API with manual non-matches:', manualNonMatchesArray);

      // Call backend API with manual matches/non-matches
      const apiResponse = await fetchMatchingScores(
        mentorAppFile,
        mentorIntFile,
        menteeAppFile,
        menteeIntFile,
        parameters,
        manualMatchesArray,
        manualNonMatchesArray
      );

      // Store category scores from new API response structure
      setCategoryScores(apiResponse.category_scores);
      
      // Store final matches from backend
      // Backend now returns ALL pairs (not just matched ones) - each has total_score
      if (apiResponse.final_matches && Array.isArray(apiResponse.final_matches)) {
        // Filter for pairs that are in the final 1-to-1 matching (is_matched = true)
        const actualFinalMatches = apiResponse.final_matches.filter((fm: any) => fm.is_matched === true);
        setFinalMatches(actualFinalMatches);
        
        // Use all pairs from backend (includes both matched and unmatched pairs)
        // This should match results_final.json structure: all 100 pairs (10 mentors × 10 mentees)
        console.log('Using final_matches from backend:', apiResponse.final_matches.length, 'total pairs');
        console.log('  - Expected: ~100 pairs (all mentor-mentee combinations)');
        console.log('  - Matched pairs (is_matched=true):', actualFinalMatches.length);
        console.log('  - Unmatched pairs:', apiResponse.final_matches.length - actualFinalMatches.length);
        if (apiResponse.final_matches.length > 0) {
          const sample = apiResponse.final_matches[0];
          console.log('Sample pair from backend:', {
            mentor_id: sample.mentor_id,
            mentee_id: sample.mentee_id,
            total_score: sample.total_score,
            is_matched: sample.is_matched,
            // Show format conversion
            matchKey: `${sample.mentor_id}-${sample.mentee_id}`,
            categoryScoreKey: `${sample.mentee_id}-${sample.mentor_id}`,
          });
          // Verify category_scores format
          if (apiResponse.category_scores?.gender) {
            const genderKeys = Object.keys(apiResponse.category_scores.gender).slice(0, 3);
            console.log('Category scores key format (sample):', genderKeys, '(should be "mentee_id-mentor_id")');
          }
        }
        
        // Convert ALL backend pairs to frontend Match format (both matched and unmatched)
        // This allows frontend to calculate recommendations using all pairs with total_score
        const backendMatchesMap = new Map<string, Match>();
        
        apiResponse.final_matches.forEach((fm: any) => {
          // Backend sends: { mentor_id: int, mentee_id: int, ... }
          // Handle both formats: mentor_id/mentorId, mentee_id/menteeId
          const mentorIdStr = String(fm.mentor_id ?? fm.mentorId ?? '');
          const menteeIdStr = String(fm.mentee_id ?? fm.menteeId ?? '');
          
          if (!mentorIdStr || !menteeIdStr) {
            console.warn('Missing mentor_id or mentee_id in backend response:', fm);
            return;
          }
          
          // Frontend uses "mentor_id-mentee_id" format consistently
          const matchKey = `${mentorIdStr}-${menteeIdStr}`;
          // Category scores use "mentee_id-mentor_id" format (from backend tuple conversion)
          const categoryScoreKey = `${menteeIdStr}-${mentorIdStr}`;
          
          const mentor = mentors.find(m => m.id === mentorIdStr);
          const mentee = mentees.find(m => m.id === menteeIdStr);
          
          if (!mentor || !mentee) {
            console.warn(`Could not find mentor ${mentorIdStr} or mentee ${menteeIdStr}`);
            return;
          }

          // Use total_score from backend - this is the source of truth for globalScore
          let totalScore: number;
          if (fm.total_score === 'Infinity' || fm.total_score === Infinity || fm.total_score === 'inf' || fm.total_score === '+inf') {
            totalScore = Infinity; // Use Infinity for frontend
          } else if (fm.total_score === '-Infinity' || fm.total_score === -Infinity || fm.total_score === '-inf' || fm.total_score === '-inf') {
            totalScore = -Infinity; // Use -Infinity for frontend
          } else if (typeof fm.total_score === 'number' && isFinite(fm.total_score)) {
            totalScore = fm.total_score;
          } else if (typeof fm.total_score === 'number' && !isFinite(fm.total_score)) {
            // Already infinity
            totalScore = fm.total_score;
          } else {
            console.warn(`Invalid total_score for ${mentorIdStr}-${menteeIdStr}:`, fm.total_score);
            totalScore = 0;
          }

          // Check if this is a manual match/non-match
          const isManualMatch = manualMatches.has(matchKey);
          const isManualNonMatch = manualNonMatches.has(matchKey);
          
          // Override score based on manual selections (manual selections take precedence)
          if (isManualMatch) {
            totalScore = Infinity; // Force manual match to +inf
            console.log(`Overriding score for manual match ${matchKey} to +inf`);
          } else if (isManualNonMatch) {
            totalScore = -Infinity; // Force manual non-match to -inf
            console.log(`Overriding score for manual non-match ${matchKey} to -inf`);
          }

          // Get scores from category_scores if available (from main.py), otherwise use final_match scores
          // Category scores keys are in "mentee_id-mentor_id" format (from backend tuple conversion)
          // matchKey is in "mentor_id-mentee_id" format (frontend standard)
          // So we always use categoryScoreKey for category_scores lookups
          
          backendMatchesMap.set(matchKey, {
            mentorId: mentorIdStr,
            menteeId: menteeIdStr,
            globalScore: (typeof totalScore === 'number' && isFinite(totalScore)) 
              ? Math.round(totalScore * 100) / 100 
              : totalScore, // Keep Infinity/-Infinity as-is
            scores: {
              gender: (() => {
                // Category scores use "mentee_id-mentor_id" format
                const categoryData = apiResponse.category_scores?.gender?.[categoryScoreKey] ?? 
                                   apiResponse.category_scores?.gender?.[matchKey]; // Fallback to matchKey format
                if (categoryData !== undefined) {
                  if (typeof categoryData === 'number') return Math.round(categoryData * 100) / 100;
                  if (typeof categoryData === 'object' && 'gender_score' in categoryData) {
                    return typeof categoryData.gender_score === 'number' 
                      ? Math.round(categoryData.gender_score * 100) / 100 : 0;
                  }
                }
                return typeof fm.gender_score === 'number' ? Math.round(fm.gender_score * 100) / 100 : 0;
              })(),
              academia: (() => {
                // Category scores use "mentee_id-mentor_id" format
                const categoryData = apiResponse.category_scores?.academia?.[categoryScoreKey] ?? 
                                   apiResponse.category_scores?.academia?.[matchKey]; // Fallback
                if (categoryData !== undefined) {
                  if (typeof categoryData === 'number') return Math.round(categoryData * 100) / 100;
                  if (typeof categoryData === 'object' && 'academic_score' in categoryData) {
                    return typeof categoryData.academic_score === 'number' 
                      ? Math.round(categoryData.academic_score * 100) / 100 : 0;
                  }
                }
                return typeof fm.academic_score === 'number' ? Math.round(fm.academic_score * 100) / 100 : 0;
              })(),
              languages: (() => {
                // Category scores use "mentee_id-mentor_id" format
                const categoryData = apiResponse.category_scores?.languages?.[categoryScoreKey] ?? 
                                   apiResponse.category_scores?.languages?.[matchKey]; // Fallback
                if (categoryData !== undefined) {
                  if (typeof categoryData === 'number') return Math.round(categoryData * 100) / 100;
                  if (typeof categoryData === 'object' && 'score' in categoryData) {
                    return typeof categoryData.score === 'number' 
                      ? Math.round(categoryData.score * 100) / 100 : 0;
                  }
                }
                return typeof fm.language_score === 'number' ? Math.round(fm.language_score * 100) / 100 : 0;
              })(),
              ageDifference: (() => {
                // Category scores use "mentee_id-mentor_id" format
                const categoryData = apiResponse.category_scores?.age_difference?.[categoryScoreKey] ?? 
                                   apiResponse.category_scores?.age_difference?.[matchKey]; // Fallback
                if (categoryData !== undefined) {
                  if (typeof categoryData === 'number') return Math.round(categoryData * 100) / 100;
                  if (typeof categoryData === 'object' && 'birthday_score' in categoryData) {
                    return typeof categoryData.birthday_score === 'number' 
                      ? Math.round(categoryData.birthday_score * 100) / 100 : 0;
                  }
                }
                return typeof fm.age_difference_score === 'number' ? Math.round(fm.age_difference_score * 100) / 100 : 0;
              })(),
              geographicProximity: (() => {
                // Category scores use "mentee_id-mentor_id" format
                const categoryData = apiResponse.category_scores?.geographic_proximity?.[categoryScoreKey] ?? 
                                   apiResponse.category_scores?.geographic_proximity?.[matchKey]; // Fallback
                if (categoryData !== undefined) {
                  if (typeof categoryData === 'number') return Math.round(categoryData * 100) / 100;
                  if (typeof categoryData === 'object' && 'distance_score' in categoryData) {
                    return typeof categoryData.distance_score === 'number' 
                      ? Math.round(categoryData.distance_score * 100) / 100 : 0;
                  }
                }
                return typeof fm.distance_score === 'number' ? Math.round(fm.distance_score * 100) / 100 : 0;
              })(),
            },
            isImmutableNonMatch: isManualNonMatch,
          } as Match);
        });

        // Add manual matches that might not be in backend results (if mentor/mentee exist)
        manualMatches.forEach((matchKey) => {
          if (!backendMatchesMap.has(matchKey)) {
            const [mentorIdStr, menteeIdStr] = matchKey.split('-');
            const mentor = mentors.find(m => m.id === mentorIdStr);
            const mentee = mentees.find(m => m.id === menteeIdStr);
            
            if (mentor && mentee) {
              console.log(`Adding manual match not in backend results: ${matchKey}`);
              backendMatchesMap.set(matchKey, {
                mentorId: mentorIdStr,
                menteeId: menteeIdStr,
                globalScore: Infinity, // Manual match = +inf
                scores: {
                  gender: 0,
                  academia: 0,
                  languages: 0,
                  ageDifference: 0,
                  geographicProximity: 0,
                },
                isImmutableNonMatch: false,
              } as Match);
            }
          }
        });

        const backendMatches = Array.from(backendMatchesMap.values());

        console.log(`✓ Converted ${backendMatches.length} matches from backend pairs (all have total_score from backend)`);
        console.log(`  - Expected: ~100 pairs (all mentor-mentee combinations, e.g., 10 mentors × 10 mentees)`);
        console.log(`  - All pairs will be visualized as edges in the graph`);
        if (backendMatches.length > 0) {
          const sampleMatch = backendMatches[0];
          console.log('Sample converted match:', {
            matchKey: `${sampleMatch.mentorId}-${sampleMatch.menteeId}`,
            globalScore: sampleMatch.globalScore,
            source: 'backend total_score',
            hasCategoryScores: !!sampleMatch.scores.gender,
            willBeVisualized: 'Yes - all edges are shown'
          });
        }
        
        // Set matches with all pairs (matched and unmatched) - frontend will visualize ALL edges
        // This matches results_final.json: all pairs with total_score from backend
        setMatches(backendMatches);
        setLastMatchedParameters({ ...parameters }); // Save current parameters as the ones used for this match
        console.log(`✓ Loaded ${backendMatches.length} matches - manual selections preserved and applied`);
        console.log(`✓ Matches state updated - Graph and Table will display these connections`);
        
        // Restore previously selected mentor and mentee
        if (previouslySelectedMentor && mentors.find(m => m.id === previouslySelectedMentor)) {
          setSelectedMentor(previouslySelectedMentor);
          console.log(`✓ Restored selected mentor: ${previouslySelectedMentor}`);
        }
        if (previouslySelectedMentee && mentees.find(m => m.id === previouslySelectedMentee)) {
          setSelectedMentee(previouslySelectedMentee);
          console.log(`✓ Restored selected mentee: ${previouslySelectedMentee}`);
        }
      } else {
        // No final_matches from backend - cannot create matches without total_score
        console.warn('No final_matches from backend - cannot create matches without total_score');
        setFinalMatches([]);
        setMatches([]);
        
        // Restore previously selected mentor and mentee
        if (previouslySelectedMentor && mentors.find(m => m.id === previouslySelectedMentor)) {
          setSelectedMentor(previouslySelectedMentor);
          console.log(`✓ Restored selected mentor: ${previouslySelectedMentor}`);
        }
        if (previouslySelectedMentee && mentees.find(m => m.id === previouslySelectedMentee)) {
          setSelectedMentee(previouslySelectedMentee);
          console.log(`✓ Restored selected mentee: ${previouslySelectedMentee}`);
        }
      }
    } catch (error) {
      console.error('Error calling match API:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error matching: ${errorMessage}`);
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const globalAverageScore = matches.length > 0
    ? Math.round((matches.reduce((sum, m) => sum + m.globalScore, 0) / matches.length) * 100) / 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data and calculating matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900 mb-1">Matching Dashboard</h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-600">
                  {mentors.length} mentors • {mentees.length} mentees • Global Average Score: {globalAverageScore}
                </p>
                {usingMockData && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Data from Data Directory
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Upload New Data
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <h2 className="text-gray-900">Parameters</h2>
                </div>
                <Button
                  onClick={handleMatch}
                  disabled={loading}
                  className={`${parametersChanged ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white flex-shrink-0 whitespace-nowrap`}
                >
                  {loading ? 'Matching...' : 'Match'}
                </Button>
              </div>
            </div>
            <ParameterControls
              parameters={parameters}
              onChange={handleParameterChange}
            />
          </Card>

          {/* Graph at the top - full width */}
          <div className="flex justify-center">
            <Card className="p-6 w-full max-w-6xl">
              <MatchingGraph
                mentors={mentors}
                mentees={mentees}
                matches={matches}
                selectedMentor={selectedMentor}
                selectedMentee={selectedMentee}
                onSelectMentor={setSelectedMentor}
                onSelectMentee={setSelectedMentee}
                getMatchStatus={getMatchStatus}
                isRecommendedPair={isRecommendedPair}
                finalMatches={finalMatches}
              />
            </Card>
          </div>

          {/* Scores panel below graph - show blank when no pair selected */}
          <div className="flex justify-center">
            <div className="w-full max-w-6xl">
              {selectedMentor && selectedMentee ? (
                <MatchScorePanel
                  mentorId={selectedMentor}
                  menteeId={selectedMentee}
                  matches={matches}
                  getMatchStatus={getMatchStatus}
                  onManualMatch={handleManualMatchToggle}
                  hasOtherManualMatch={hasOtherManualMatch}
                />
              ) : (
                <Card className="p-4 bg-gray-50 border border-gray-200">
                  <div className="text-center text-gray-500 text-sm">
                    Select a mentor and a mentee to view match scores
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Mentor and Mentee panels side by side - each takes equal width */}
          <div className="flex gap-6 items-start w-full">
            {/* Left half - Mentor - equal width */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {selectedMentor ? (
                <DetailPanel
                  person={mentors.find(m => m.id === selectedMentor)!}
                  type="mentor"
                  onClose={() => setSelectedMentor(null)}
                />
              ) : (
                <Card className="border-2 border-dashed border-gray-300 h-[600px] flex items-center justify-center">
                  <div className="text-center text-gray-400 text-sm">
                    Select a mentor to view details
                  </div>
                </Card>
              )}
            </div>

            {/* Right half - Mentee - equal width */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {selectedMentee ? (
                <DetailPanel
                  person={mentees.find(m => m.id === selectedMentee)!}
                  type="mentee"
                  onClose={() => setSelectedMentee(null)}
                />
              ) : (
                <Card className="border-2 border-dashed border-gray-300 h-[600px] flex items-center justify-center">
                  <div className="text-center text-gray-400 text-sm">
                    Select a mentee to view details
                  </div>
                </Card>
              )}
            </div>
          </div>
          
          {/* Final Matches Display */}
          {finalMatches.length > 0 && (
            <div className="mt-6">
              <FinalMatchesDisplay
                finalMatches={finalMatches}
                mentors={mentors}
                mentees={mentees}
                onSelectMentor={setSelectedMentor}
                onSelectMentee={setSelectedMentee}
              />
            </div>
          )}

          {/* Show manual matches count for debugging */}
          {(manualMatches.size > 0 || manualNonMatches.size > 0) && (
            <div className="text-center text-sm text-gray-600 mt-4">
              Manual selections: {manualMatches.size} match{manualMatches.size !== 1 ? 'es' : ''}, {manualNonMatches.size} non-match{manualNonMatches.size !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
