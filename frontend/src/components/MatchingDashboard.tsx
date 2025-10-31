import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { ParameterControls } from './ParameterControls';
import { MatchingGraph } from './MatchingGraph';
import { DetailPanel } from './DetailPanel';
import { MatchScorePanel } from './MatchScorePanel';
import { Settings } from 'lucide-react';
import { parseMenteeData, parseMentorData, parseCSV } from '../utils/csvParser';
import { createMergedData } from '../utils/csvMerger';
import { fetchMatchingScores } from '../utils/apiClient';
import { loadDemoCSVFiles } from '../utils/demoDataLoader';
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
  const [lastMatchedParameters, setLastMatchedParameters] = useState<MatchingParameters | null>(null);

  useEffect(() => {
    loadDataAndFetchScores();
  }, []);

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
      setCategoryScores(apiResponse);

      // Calculate aggregate matches from category scores
      // Only create matches if we have scores from the backend
      const calculatedMatches = calculateAggregateMatches(
        mentorData,
        menteeData,
        apiResponse,
        params
      );

      setMatches(calculatedMatches);
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
    params: MatchingParameters
  ): Match[] => {
    const matches: Match[] = [];

    // Only create matches if we have scores from the backend API
    // If scores are empty, don't create any matches
    if (!scores || !scores.gender || Object.keys(scores.gender).length === 0) {
      return matches;
    }

    mentorData.forEach(mentor => {
      menteeData.forEach(mentee => {
        const key = `${mentor.id}-${mentee.id}`;

        // Get category scores from API response - only use if they exist
        const genderScore = scores.gender?.[key];
        const academiaScore = scores.academia?.[key];
        const languagesScore = scores.languages?.[key];
        const ageDifferenceScore = scores.age_difference?.[key];
        const geographicScore = scores.geographic_proximity?.[key];

        // Only create match if at least one score exists
        if (genderScore === undefined && academiaScore === undefined && 
            languagesScore === undefined && ageDifferenceScore === undefined && 
            geographicScore === undefined) {
          return; // Skip this pair - no connection from backend
        }

        // Check if any score is -Infinity (immutable non-match)
        const isImmutableNonMatch = 
          genderScore !== undefined && (!isFinite(genderScore) && genderScore !== 0) ||
          academiaScore !== undefined && (!isFinite(academiaScore) && academiaScore !== 0) ||
          languagesScore !== undefined && (!isFinite(languagesScore) && languagesScore !== 0) ||
          ageDifferenceScore !== undefined && (!isFinite(ageDifferenceScore) && ageDifferenceScore !== 0) ||
          geographicScore !== undefined && (!isFinite(geographicScore) && geographicScore !== 0);

        // Use default values if scores don't exist
        const finalGenderScore = genderScore !== undefined ? genderScore : 0;
        const finalAcademiaScore = academiaScore !== undefined ? academiaScore : 0;
        const finalLanguagesScore = languagesScore !== undefined ? languagesScore : 0;
        const finalAgeDifferenceScore = ageDifferenceScore !== undefined ? ageDifferenceScore : 0;
        const finalGeographicScore = geographicScore !== undefined ? geographicScore : 0;

        // Calculate weighted aggregate
        const totalWeight =
          params.genderWeight +
          params.academiaWeight +
          params.languagesWeight +
          params.ageDifferenceWeight +
          params.geographicProximityWeight;

        const weightedSum =
          (isFinite(finalGenderScore) ? finalGenderScore : 0) * params.genderWeight +
          (isFinite(finalAcademiaScore) ? finalAcademiaScore : 0) * params.academiaWeight +
          (isFinite(finalLanguagesScore) ? finalLanguagesScore : 0) * params.languagesWeight +
          (isFinite(finalAgeDifferenceScore) ? finalAgeDifferenceScore : 0) * params.ageDifferenceWeight +
          (isFinite(finalGeographicScore) ? finalGeographicScore : 0) * params.geographicProximityWeight;

        const globalScore = isImmutableNonMatch ? 0 : weightedSum / totalWeight;

        matches.push({
          mentorId: mentor.id,
          menteeId: mentee.id,
          globalScore: Math.round(globalScore * 100) / 100,
          scores: {
            gender: isFinite(finalGenderScore) ? Math.round(finalGenderScore * 100) / 100 : 0,
            academia: isFinite(finalAcademiaScore) ? Math.round(finalAcademiaScore * 100) / 100 : 0,
            languages: isFinite(finalLanguagesScore) ? Math.round(finalLanguagesScore * 100) / 100 : 0,
            ageDifference: isFinite(finalAgeDifferenceScore) ? Math.round(finalAgeDifferenceScore * 100) / 100 : 0,
            geographicProximity: isFinite(finalGeographicScore) ? Math.round(finalGeographicScore * 100) / 100 : 0,
          },
          isImmutableNonMatch,
        });
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
    // Only check immutability if match exists
    const match = matches.find(m => m.mentorId === mentorId && m.menteeId === menteeId);
    if (match?.isImmutableNonMatch) {
      return; // Don't allow changes to immutable non-matches
    }
    
    if (isMatch) {
      handleManualMatch(mentorId, menteeId);
    } else {
      handleManualNonMatch(mentorId, menteeId);
    }
    
    // Log for debugging
    const matchKey = `${mentorId}-${menteeId}`;
    console.log(`Manual ${isMatch ? 'match' : 'non-match'} set for ${matchKey}. Total manual matches: ${manualMatches.size + (isMatch ? 1 : 0)}, non-matches: ${manualNonMatches.size + (isMatch ? 0 : 1)}`);
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

  const handleMatch = async () => {
    setLoading(true);
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

      setCategoryScores(apiResponse);

      // Use final_matches from backend if available
      if (apiResponse.final_matches && Array.isArray(apiResponse.final_matches)) {
        console.log('Using final_matches from backend:', apiResponse.final_matches.length, 'matches');
        console.log('Sample final_match:', apiResponse.final_matches[0]);
        
        // Convert backend final_matches to frontend Match format
        const backendMatchesMap = new Map<string, Match>();
        
        apiResponse.final_matches.forEach((fm: any) => {
          const mentorIdStr = String(fm.mentor_id);
          const menteeIdStr = String(fm.mentee_id);
          const matchKey = `${mentorIdStr}-${menteeIdStr}`;
          
          const mentor = mentors.find(m => m.id === mentorIdStr);
          const mentee = mentees.find(m => m.id === menteeIdStr);
          
          if (!mentor || !mentee) {
            console.warn(`Could not find mentor ${mentorIdStr} or mentee ${menteeIdStr}`);
            return;
          }

          // Handle Infinity scores properly
          let finalScore: number;
          if (fm.final_score === 'Infinity' || fm.final_score === Infinity || fm.final_score === 'inf' || fm.final_score === '+inf') {
            finalScore = Infinity; // Use Infinity for frontend
          } else if (fm.final_score === '-Infinity' || fm.final_score === -Infinity || fm.final_score === '-inf' || fm.final_score === '-inf') {
            finalScore = -Infinity; // Use -Infinity for frontend
          } else if (typeof fm.final_score === 'number' && isFinite(fm.final_score)) {
            finalScore = fm.final_score;
          } else if (typeof fm.final_score === 'number' && !isFinite(fm.final_score)) {
            // Already infinity
            finalScore = fm.final_score;
          } else {
            console.warn(`Invalid final_score for ${mentorIdStr}-${menteeIdStr}:`, fm.final_score);
            finalScore = 0;
          }

          // Check if this is a manual match/non-match
          const isManualMatch = manualMatches.has(matchKey);
          const isManualNonMatch = manualNonMatches.has(matchKey);
          
          // Override score based on manual selections (manual selections take precedence)
          if (isManualMatch) {
            finalScore = Infinity; // Force manual match to +inf
            console.log(`Overriding score for manual match ${matchKey} to +inf`);
          } else if (isManualNonMatch) {
            finalScore = -Infinity; // Force manual non-match to -inf
            console.log(`Overriding score for manual non-match ${matchKey} to -inf`);
          }

          backendMatchesMap.set(matchKey, {
            mentorId: mentorIdStr,
            menteeId: menteeIdStr,
            globalScore: (typeof finalScore === 'number' && isFinite(finalScore)) 
              ? Math.round(finalScore * 100) / 100 
              : finalScore, // Keep Infinity/-Infinity as-is
            scores: {
              gender: typeof fm.gender_score === 'number' ? Math.round(fm.gender_score * 100) / 100 : 0,
              academia: typeof fm.academia_score === 'number' ? Math.round(fm.academia_score * 100) / 100 : 0,
              languages: typeof fm.language_score === 'number' ? Math.round(fm.language_score * 100) / 100 : 0,
              ageDifference: typeof fm.age_score === 'number' ? Math.round(fm.age_score * 100) / 100 : 0,
              geographicProximity: typeof fm.geo_score === 'number' ? Math.round(fm.geo_score * 100) / 100 : 0,
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

        console.log(`✓ Converted ${backendMatches.length} matches from backend final_matches (including manual selections)`);
        if (backendMatches.length > 0) {
          console.log('Sample converted match:', backendMatches[0]);
        }
        
        setMatches(backendMatches);
        setLastMatchedParameters({ ...parameters }); // Save current parameters as the ones used for this match
        console.log(`✓ Loaded ${backendMatches.length} matches - manual selections preserved and applied`);
        console.log(`✓ Matches state updated - Graph and Table will display these connections`);
      } else {
        // Fallback to calculating matches from category scores
        console.log('No final_matches from backend, calculating from category scores');
        const calculatedMatches = calculateAggregateMatches(
          mentors,
          mentees,
          apiResponse,
          parameters
        );
        
        // Apply manual selections to calculated matches (manual selections take precedence)
        const matchesWithManualOverrides = calculatedMatches.map((match) => {
          const matchKey = `${match.mentorId}-${match.menteeId}`;
          const isManualMatch = manualMatches.has(matchKey);
          const isManualNonMatch = manualNonMatches.has(matchKey);
          
          if (isManualMatch) {
            return {
              ...match,
              globalScore: Infinity, // Override to +inf for manual match
            };
          } else if (isManualNonMatch) {
            return {
              ...match,
              globalScore: -Infinity, // Override to -inf for manual non-match
              isImmutableNonMatch: true,
            };
          }
          return match;
        });
        
        // Add manual matches that might not be in calculated matches
        const calculatedMatchesMap = new Map<string, Match>();
        matchesWithManualOverrides.forEach(m => {
          calculatedMatchesMap.set(`${m.mentorId}-${m.menteeId}`, m);
        });
        
        manualMatches.forEach((matchKey) => {
          if (!calculatedMatchesMap.has(matchKey)) {
            const [mentorIdStr, menteeIdStr] = matchKey.split('-');
            const mentor = mentors.find(m => m.id === mentorIdStr);
            const mentee = mentees.find(m => m.id === menteeIdStr);
            
            if (mentor && mentee) {
              console.log(`Adding manual match not in calculated results: ${matchKey}`);
              calculatedMatchesMap.set(matchKey, {
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
        
        const finalMatches = Array.from(calculatedMatchesMap.values());
        setMatches(finalMatches);
        setLastMatchedParameters({ ...parameters }); // Save current parameters
        console.log(`✓ Applied manual selections to ${finalMatches.length} calculated matches`);
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <h2 className="text-gray-900">Parameters</h2>
              </div>
              <div className="flex items-center gap-4">
                {parametersChanged && (
                  <div className="p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                    ⚠️ Graph shows matches from previous parameters. Click "Match" to update.
                  </div>
                )}
                <Button
                  onClick={handleMatch}
                  disabled={loading}
                  className={`${parametersChanged ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
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

          <div className={`${(selectedMentor || selectedMentee) ? 'flex gap-6' : 'flex justify-center'}`}>
            {selectedMentor && (
              <div className="w-80 flex-shrink-0">
                <DetailPanel
                  person={mentors.find(m => m.id === selectedMentor)!}
                  type="mentor"
                  onClose={() => setSelectedMentor(null)}
                />
              </div>
            )}
            
            <div className={`${(selectedMentor || selectedMentee) ? 'flex-1' : 'w-full'}`}>
              <div className={`flex ${(selectedMentor || selectedMentee) ? '' : 'justify-center'}`}>
                <Card className="p-6">
                  <MatchingGraph
                    mentors={mentors}
                    mentees={mentees}
                    matches={matches}
                    selectedMentor={selectedMentor}
                    selectedMentee={selectedMentee}
                    onSelectMentor={setSelectedMentor}
                    onSelectMentee={setSelectedMentee}
                    getMatchStatus={getMatchStatus}
                  />
                </Card>
              </div>
            </div>

            {selectedMentee && (
              <div className="w-80 flex-shrink-0">
                <DetailPanel
                  person={mentees.find(m => m.id === selectedMentee)!}
                  type="mentee"
                  onClose={() => setSelectedMentee(null)}
                />
              </div>
            )}
          </div>
          
          {selectedMentor && selectedMentee && (
            <div className="flex justify-center">
              <div className="w-full max-w-6xl">
                <MatchScorePanel
                  mentorId={selectedMentor}
                  menteeId={selectedMentee}
                  matches={matches}
                  getMatchStatus={getMatchStatus}
                  onManualMatch={handleManualMatchToggle}
                />
              </div>
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
