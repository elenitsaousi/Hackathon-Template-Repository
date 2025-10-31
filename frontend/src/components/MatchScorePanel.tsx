import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Check, Ban } from 'lucide-react';
import type { Match } from '../types';

interface MatchScorePanelProps {
  mentorId: string;
  menteeId: string;
  matches: Match[];
  getMatchStatus: (mentorId: string, menteeId: string) => 'manual-match' | 'manual-non-match' | 'auto';
  onManualMatch: (mentorId: string, menteeId: string, isMatch: boolean) => void;
  hasOtherManualMatch?: (mentorId: string, menteeId: string) => { mentor: boolean; mentee: boolean };
}

export function MatchScorePanel({
  mentorId,
  menteeId,
  matches,
  getMatchStatus,
  onManualMatch,
  hasOtherManualMatch,
}: MatchScorePanelProps) {
  const currentMatch = matches.find(
    m => m.mentorId === mentorId && m.menteeId === menteeId
  );

  // Allow panel to show even if match doesn't exist yet (before data is loaded)
  const currentStatus = getMatchStatus(mentorId, menteeId);
  // Only disable if match exists and is truly immutable (blocked by backend)
  // Allow manual matching even before data is loaded
  const isImmutable = currentMatch?.isImmutableNonMatch === true;
  
  // Check if mentor or mentee already has another manual match
  const otherMatchInfo = hasOtherManualMatch ? hasOtherManualMatch(mentorId, menteeId) : { mentor: false, mentee: false };
  const mentorHasOtherMatch = otherMatchInfo.mentor && currentStatus !== 'manual-match';
  const menteeHasOtherMatch = otherMatchInfo.mentee && currentStatus !== 'manual-match';
  const cannotSetMatch = mentorHasOtherMatch || menteeHasOtherMatch;

  // Format score for display (handle Infinity)
  const formatScore = (score: number): number => {
    if (!isFinite(score)) {
      if (score === Infinity) return 1.0;
      if (score === -Infinity) return 0.0;
      return 0.0;
    }
    return Math.max(0, Math.min(1, score));
  };

  const displayScore = currentMatch ? formatScore(currentMatch.globalScore) : 0;

  return (
    <Card className="p-4 bg-blue-50 border border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-900 font-medium">
          Match Score: Mentor {mentorId} ↔ Mentee {menteeId}
        </h3>
        {currentStatus && (
          <Badge
            className={
              currentStatus === 'manual-match'
                ? 'bg-green-100 text-green-800'
                : currentStatus === 'manual-non-match'
                ? isImmutable ? 'bg-gray-200 text-gray-800' : 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }
          >
            {currentStatus === 'manual-match'
              ? 'Manual Match'
              : currentStatus === 'manual-non-match'
              ? isImmutable ? 'Blocked' : 'Excluded'
              : 'Auto'}
          </Badge>
        )}
      </div>

      {currentMatch ? (
        <div className="grid grid-cols-5 gap-2 mb-3">
          <ScoreCard label="Gender" score={formatScore(currentMatch.scores.gender)} />
          <ScoreCard label="Academia" score={formatScore(currentMatch.scores.academia)} />
          <ScoreCard label="Languages" score={formatScore(currentMatch.scores.languages)} />
          <ScoreCard label="Age" score={formatScore(currentMatch.scores.ageDifference)} />
          <ScoreCard label="Location" score={formatScore(currentMatch.scores.geographicProximity)} />
        </div>
      ) : (
        <div className="mb-3 p-4 bg-gray-50 rounded text-center text-sm text-gray-600">
          No match data yet. Click "Match" to load scores, or set manual match/non-match below.
        </div>
      )}

      {currentMatch && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600">Global Score:</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${displayScore * 100}%` }}
            />
          </div>
          <span className="font-medium text-sm">
            {(displayScore * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant={currentStatus === 'manual-match' ? 'default' : 'outline'}
          className={`flex-1 ${
            currentStatus === 'manual-match' 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'hover:bg-green-50'
          }`}
          onClick={() => {
            console.log(`[MatchScorePanel] Match button clicked for ${mentorId}-${menteeId}`);
            onManualMatch(mentorId, menteeId, true);
          }}
          disabled={isImmutable || cannotSetMatch}
          title={
            cannotSetMatch
              ? mentorHasOtherMatch && menteeHasOtherMatch
                ? 'Both mentor and mentee already have manual matches. Unset existing matches first.'
                : mentorHasOtherMatch
                ? 'This mentor already has a manual match. Unset it first.'
                : 'This mentee already has a manual match. Unset it first.'
              : isImmutable
              ? 'This match is blocked and cannot be changed'
              : currentStatus === 'manual-match'
              ? 'Click to unset manual match'
              : 'Click to set manual match'
          }
        >
          <Check className="w-4 h-4 mr-2" />
          Match
        </Button>
        <Button
          variant={currentStatus === 'manual-non-match' ? 'default' : 'outline'}
          className={`flex-1 ${
            currentStatus === 'manual-non-match' 
              ? '!bg-red-600 hover:!bg-red-700 !text-white !border-red-600' 
              : 'bg-white hover:bg-red-50 border-red-300 text-red-600'
          }`}
          onClick={() => {
            console.log(`[MatchScorePanel] Set Not Match button clicked for ${mentorId}-${menteeId}`);
            onManualMatch(mentorId, menteeId, false);
          }}
          disabled={isImmutable}
          title={
            isImmutable
              ? 'This match is blocked and cannot be changed'
              : currentStatus === 'manual-non-match'
              ? 'Click to unset manual non-match (revert to model prediction)'
              : 'Click to exclude this match'
          }
        >
          <Ban className="w-4 h-4 mr-2" />
          Set Not Match
        </Button>
      </div>
    </Card>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 0.8) return 'bg-green-500';
    if (s >= 0.6) return 'bg-blue-500';
    if (s >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="text-center">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`h-16 rounded ${getColor(score)} flex items-center justify-center`}>
        <span className="text-white font-medium">{(score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

