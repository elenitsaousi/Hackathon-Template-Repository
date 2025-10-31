import type { Match } from '../types';

/**
 * Calculates the optimal bipartite matching (assignment problem)
 * that maximizes the sum of all pair scores.
 * 
 * This uses a greedy algorithm that:
 * 1. Always includes manual matches
 * 2. Excludes manual non-matches and -inf scores
 * 3. Finds the best matching for remaining pairs
 * 
 * @param matches All available matches
 * @param manualMatches Set of manual match keys (format: "mentorId-menteeId")
 * @param manualNonMatches Set of manual non-match keys (format: "mentorId-menteeId")
 * @param getMatchStatus Function to get match status
 * @returns Set of recommended match keys (format: "mentorId-menteeId")
 */
export function calculateOptimalMatching(
  matches: Match[],
  manualMatches: Set<string>,
  manualNonMatches: Set<string>,
  getMatchStatus: (mentorId: string, menteeId: string) => 'manual-match' | 'manual-non-match' | 'auto'
): Set<string> {
  const recommendedMatches = new Set<string>();
  
  // Track which mentors and mentees are already matched
  const matchedMentors = new Set<string>();
  const matchedMentees = new Set<string>();
  
  // Step 1: Always include manual matches first (they are required)
  manualMatches.forEach(matchKey => {
    const [mentorId, menteeId] = matchKey.split('-');
    recommendedMatches.add(matchKey);
    matchedMentors.add(mentorId);
    matchedMentees.add(menteeId);
  });
  
  // Step 2: Filter valid matches for the greedy algorithm
  // Exclude: manual non-matches, -inf scores, already matched mentors/mentees
  // When a recommended pair is set to "not match", it's excluded here and the algorithm
  // will find alternative pairings for the affected mentor and mentee
  const validMatches = matches
    .filter(match => {
      const matchKey = `${match.mentorId}-${match.menteeId}`;
      
      // Skip if already in manual matches (already added)
      if (manualMatches.has(matchKey)) return false;
      
      // Skip manual non-matches - this ensures excluded pairs don't appear in recommendations
      // and allows the algorithm to find new pairings for the affected mentor/mentee
      if (manualNonMatches.has(matchKey)) return false;
      
      // Skip if status indicates it's a non-match
      const status = getMatchStatus(match.mentorId, match.menteeId);
      if (status === 'manual-non-match') return false;
      
      // Skip -inf scores
      if (match.globalScore === -Infinity || 
          (typeof match.globalScore === 'number' && !isFinite(match.globalScore) && match.globalScore < 0)) {
        return false;
      }
      
      // Skip if mentor or mentee is already matched (except if this is a manual match)
      // This ensures one-to-one matching and allows finding new pairs when a recommendation is excluded
      if (matchedMentors.has(match.mentorId) || matchedMentees.has(match.menteeId)) {
        return false;
      }
      
      return true;
    })
    .map(match => {
      const matchKey = `${match.mentorId}-${match.menteeId}`;
      // Normalize score for comparison (handle Infinity)
      let normalizedScore = match.globalScore;
      if (match.globalScore === Infinity || match.globalScore === 'Infinity' || match.globalScore === 'inf') {
        normalizedScore = 1000; // Very high value
      } else if (typeof match.globalScore === 'number' && isFinite(match.globalScore)) {
        normalizedScore = match.globalScore;
      } else {
        normalizedScore = -1000; // Very low value
      }
      
      return {
        match,
        matchKey,
        score: normalizedScore,
      };
    })
    .sort((a, b) => b.score - a.score); // Sort by score descending
  
  // Step 3: Greedy assignment - take the best remaining matches
  // When a previously recommended pair is excluded (set to non-match), this loop
  // will find new optimal pairings for the affected mentors and mentees
  for (const { match, matchKey } of validMatches) {
    // Skip if mentor or mentee is already matched
    if (matchedMentors.has(match.mentorId) || matchedMentees.has(match.menteeId)) {
      continue;
    }
    
    // Add this match to recommendations
    // The greedy approach ensures we maximize total score while respecting exclusions
    recommendedMatches.add(matchKey);
    matchedMentors.add(match.mentorId);
    matchedMentees.add(match.menteeId);
  }
  
  return recommendedMatches;
}

/**
 * Checks if a specific mentor-mentee pair is in the optimal matching
 */
export function isRecommendedPair(
  mentorId: string,
  menteeId: string,
  recommendedMatches: Set<string>
): boolean {
  const matchKey = `${mentorId}-${menteeId}`;
  return recommendedMatches.has(matchKey);
}

