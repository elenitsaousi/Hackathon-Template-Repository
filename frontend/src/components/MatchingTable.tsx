import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, X, Eye } from 'lucide-react';
import type { Mentor, Mentee, Match } from '../types';

interface MatchingTableProps {
  mentors: Mentor[];
  mentees: Mentee[];
  matches: Match[];
  selectedPerson: { id: string; type: 'mentor' | 'mentee' } | null;
  onSelectPerson: (person: { id: string; type: 'mentor' | 'mentee' } | null) => void;
  onManualMatch: (mentorId: string, menteeId: string, isMatch: boolean) => void;
  getMatchStatus: (mentorId: string, menteeId: string) => 'manual-match' | 'manual-non-match' | 'auto';
}

export function MatchingTable({
  mentors,
  mentees,
  matches,
  selectedPerson,
  onSelectPerson,
  onManualMatch,
  getMatchStatus,
}: MatchingTableProps) {
  const [sortBy, setSortBy] = useState<'score' | 'mentor' | 'mentee'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedMatches = [...matches].sort((a, b) => {
    let compareValue = 0;

    if (sortBy === 'score') {
      compareValue = a.globalScore - b.globalScore;
    } else if (sortBy === 'mentor') {
      compareValue = a.mentorId.localeCompare(b.mentorId);
    } else {
      compareValue = a.menteeId.localeCompare(b.menteeId);
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  const filteredMatches = selectedPerson
    ? sortedMatches.filter(m =>
        selectedPerson.type === 'mentor'
          ? m.mentorId === selectedPerson.id
          : m.menteeId === selectedPerson.id
      )
    : sortedMatches;

  const handleSort = (column: 'score' | 'mentor' | 'mentee') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getMentor = (mentorId: string) => mentors.find(m => m.id === mentorId);
  const getMentee = (menteeId: string) => mentees.find(m => m.id === menteeId);

  // Log when matches change
  useEffect(() => {
    console.log(`[MatchingTable] Rendering ${matches.length} matches`);
    console.log(`[MatchingTable] Filtered matches: ${filteredMatches.length}`);
    if (matches.length > 0) {
      console.log(`[MatchingTable] Sample match: Mentor ${matches[0].mentorId} ↔ Mentee ${matches[0].menteeId} (score: ${matches[0].globalScore})`);
    }
  }, [matches, filteredMatches]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Matching Pairs</h2>
          <p className="text-gray-600 text-sm">
            Showing {filteredMatches.length} of {matches.length} matches
          </p>
        </div>
        {selectedPerson && (
          <Button variant="outline" size="sm" onClick={() => onSelectPerson(null)}>
            Clear Filter
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('mentor')}
              >
                Mentor {sortBy === 'mentor' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('mentee')}
              >
                Mentee {sortBy === 'mentee' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('score')}
              >
                Global Score {sortBy === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Category Scores</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMatches.map((match) => {
              const mentor = getMentor(match.mentorId);
              const mentee = getMentee(match.menteeId);
              const status = getMatchStatus(match.mentorId, match.menteeId);
              const isImmutable = match.isImmutableNonMatch;

              return (
                <TableRow key={`${match.mentorId}-${match.menteeId}`}>
                  <TableCell>
                    <div className="space-y-1">
                      <button
                        className="hover:underline text-left"
                        onClick={() =>
                          onSelectPerson({ id: match.mentorId, type: 'mentor' })
                        }
                      >
                        <p className="text-gray-900">Mentor {match.mentorId}</p>
                      </button>
                      <p className="text-gray-600 text-sm">{mentor?.name}</p>
                      <p className="text-gray-500 text-xs">{mentor?.degree}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <button
                        className="hover:underline text-left"
                        onClick={() =>
                          onSelectPerson({ id: match.menteeId, type: 'mentee' })
                        }
                      >
                        <p className="text-gray-900">Mentee {match.menteeId}</p>
                      </button>
                      <p className="text-gray-600 text-sm">
                        {mentee?.background?.substring(0, 50)}...
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${match.globalScore * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {(match.globalScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ScoreBadge label="G" value={match.scores.gender} />
                      <ScoreBadge label="A" value={match.scores.academia} />
                      <ScoreBadge label="L" value={match.scores.languages} />
                      <ScoreBadge label="Age" value={match.scores.ageDifference} />
                      <ScoreBadge label="Geo" value={match.scores.geographicProximity} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {status === 'manual-match' && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Manual Match
                      </Badge>
                    )}
                    {status === 'manual-non-match' && (
                      <Badge className={isImmutable ? "bg-gray-200 text-gray-800 hover:bg-gray-200" : "bg-red-100 text-red-800 hover:bg-red-100"}>
                        {isImmutable ? 'Blocked' : 'Excluded'}
                      </Badge>
                    )}
                    {status === 'auto' && (
                      <Badge variant="outline">Auto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant={status === 'manual-match' ? 'default' : 'outline'}
                        onClick={() =>
                          onManualMatch(match.mentorId, match.menteeId, true)
                        }
                        disabled={isImmutable}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'manual-non-match' ? 'default' : 'outline'}
                        onClick={() =>
                          onManualMatch(match.mentorId, match.menteeId, false)
                        }
                        disabled={isImmutable}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const getColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-blue-100 text-blue-800';
    if (score >= 0.4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Badge variant="outline" className={`${getColor(value)} border-0 text-xs`}>
      {label}: {(value * 100).toFixed(0)}%
    </Badge>
  );
}
