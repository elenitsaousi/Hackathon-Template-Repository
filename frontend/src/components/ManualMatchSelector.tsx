import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPlus, UserX, X } from 'lucide-react';
import type { Mentor, Mentee, Match } from '../types';

interface ManualMatchSelectorProps {
  mentors: Mentor[];
  mentees: Mentee[];
  matches: Match[];
  onCreateMatch: (mentorId: string, menteeId: string) => void;
  onCreateNonMatch: (mentorId: string, menteeId: string) => void;
  getMatchStatus: (mentorId: string, menteeId: string) => 'manual-match' | 'manual-non-match' | 'auto';
}

export function ManualMatchSelector({
  mentors,
  mentees,
  matches,
  onCreateMatch,
  onCreateNonMatch,
  getMatchStatus,
}: ManualMatchSelectorProps) {
  const [selectedMentor, setSelectedMentor] = useState<string>('');
  const [selectedMentee, setSelectedMentee] = useState<string>('');

  const handleSetMatch = () => {
    if (selectedMentor && selectedMentee) {
      onCreateMatch(selectedMentor, selectedMentee);
      // Keep selections for easy multiple operations
    }
  };

  const handleSetNonMatch = () => {
    if (selectedMentor && selectedMentee) {
      onCreateNonMatch(selectedMentor, selectedMentee);
      // Keep selections for easy multiple operations
    }
  };

  const handleClear = () => {
    setSelectedMentor('');
    setSelectedMentee('');
  };

  const currentMatch = selectedMentor && selectedMentee
    ? matches.find(m => m.mentorId === selectedMentor && m.menteeId === selectedMentee)
    : null;

  const currentStatus = selectedMentor && selectedMentee
    ? getMatchStatus(selectedMentor, selectedMentee)
    : null;

  const mentor = mentors.find(m => m.id === selectedMentor);
  const mentee = mentees.find(m => m.id === selectedMentee);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-gray-900">Manual Match Creation</h2>
        {(selectedMentor || selectedMentee) && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="w-4 h-4 mr-2" />
            Clear Selection
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="text-sm text-gray-600 mb-2 block">Select Mentor</label>
          <Select value={selectedMentor} onValueChange={setSelectedMentor}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a mentor..." />
            </SelectTrigger>
            <SelectContent>
              {mentors.map(mentor => (
                <SelectItem key={mentor.id} value={mentor.id}>
                  <div className="flex flex-col">
                    <span>{mentor.name} (ID: {mentor.id})</span>
                    <span className="text-xs text-gray-500">{mentor.degree}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {mentor && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-900 mb-1">{mentor.name}</p>
              <p className="text-xs text-gray-600">{mentor.degree}</p>
              <p className="text-xs text-gray-500 mt-1">
                {mentor.location} • {mentor.languages.join(', ')}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-2 block">Select Mentee</label>
          <Select value={selectedMentee} onValueChange={setSelectedMentee}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a mentee..." />
            </SelectTrigger>
            <SelectContent>
              {mentees.map(mentee => (
                <SelectItem key={mentee.id} value={mentee.id}>
                  <div className="flex flex-col">
                    <span>Mentee {mentee.id}</span>
                    <span className="text-xs text-gray-500">
                      {mentee.studyPlan?.substring(0, 40)}...
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {mentee && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-900 mb-1">Mentee {mentee.id}</p>
              <p className="text-xs text-gray-600">
                {mentee.studyPlan?.substring(0, 60)}...
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {mentee.location} • {mentee.languages.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {currentMatch && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-900">Match Score</h3>
            {currentStatus && (
              <Badge
                className={
                  currentStatus === 'manual-match'
                    ? 'bg-green-100 text-green-800'
                    : currentStatus === 'manual-non-match'
                    ? currentMatch.isImmutableNonMatch ? 'bg-gray-200 text-gray-800' : 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }
              >
                {currentStatus === 'manual-match'
                  ? 'Manual Match'
                  : currentStatus === 'manual-non-match'
                  ? currentMatch.isImmutableNonMatch ? 'Blocked' : 'Excluded'
                  : 'Auto'}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2 mb-3">
            <ScoreCard label="Gender" score={currentMatch.scores.gender} />
            <ScoreCard label="Academia" score={currentMatch.scores.academia} />
            <ScoreCard label="Languages" score={currentMatch.scores.languages} />
            <ScoreCard label="Age" score={currentMatch.scores.ageDifference} />
            <ScoreCard label="Location" score={currentMatch.scores.geographicProximity} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Global Score:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${currentMatch.globalScore * 100}%` }}
              />
            </div>
            <span className="font-medium">
              {(currentMatch.globalScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSetMatch}
          disabled={!selectedMentor || !selectedMentee || currentMatch?.isImmutableNonMatch}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Set as Match
        </Button>
        <Button
          onClick={handleSetNonMatch}
          disabled={!selectedMentor || !selectedMentee || currentMatch?.isImmutableNonMatch}
          variant="destructive"
          className="flex-1"
        >
          <UserX className="w-4 h-4 mr-2" />
          Set as Non-Match
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
        <span className="text-white">{(score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
