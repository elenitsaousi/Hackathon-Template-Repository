import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface FinalMatch {
  mentor_id: number;
  mentee_id: number;
  total_score: number;
  academic_score: number;
  gender_score: number;
  language_score: number;
  distance_score: number;
  age_difference_score: number;
  valid?: boolean;
}

interface FinalMatchesDisplayProps {
  finalMatches: FinalMatch[];
  mentors: Array<{ id: string; name?: string }>;
  mentees: Array<{ id: string; name?: string }>;
  onSelectMentor?: (mentorId: string) => void;
  onSelectMentee?: (menteeId: string) => void;
}

export function FinalMatchesDisplay({
  finalMatches,
  mentors,
  mentees,
  onSelectMentor,
  onSelectMentee,
}: FinalMatchesDisplayProps) {
  if (!finalMatches || finalMatches.length === 0) {
    return (
      <Card className="p-4 bg-gray-50 border border-gray-200">
        <div className="text-center text-gray-500 text-sm">
          No final matches calculated yet. Click "Match" to compute final matches.
        </div>
      </Card>
    );
  }

  const formatScore = (score: number): string => {
    if (typeof score === 'number' && !isFinite(score)) {
      if (score === Infinity || score > 0) return '∞';
      if (score === -Infinity || score < 0) return '-∞';
    }
    return (score * 100).toFixed(1) + '%';
  };

  const getScoreColor = (score: number): string => {
    if (typeof score === 'number' && !isFinite(score)) {
      if (score === Infinity || score > 0) return 'text-green-600';
      if (score === -Infinity || score < 0) return 'text-red-600';
    }
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const sortedMatches = [...finalMatches].sort((a, b) => {
    // Sort by total_score descending, but handle Infinity values
    const aScore = typeof a.total_score === 'number' && isFinite(a.total_score) ? a.total_score : 
                   a.total_score === Infinity ? 1000 : -1000;
    const bScore = typeof b.total_score === 'number' && isFinite(b.total_score) ? b.total_score : 
                   b.total_score === Infinity ? 1000 : -1000;
    return bScore - aScore;
  });

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Final Matches ({finalMatches.length})
        </h2>
        <p className="text-sm text-gray-600">
          Optimal 1-to-1 matching calculated by the backend algorithm. These are the recommended pairings.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Mentor</TableHead>
              <TableHead className="w-24">Mentee</TableHead>
              <TableHead className="w-32 text-right">Total Score</TableHead>
              <TableHead className="w-24 text-right">Gender</TableHead>
              <TableHead className="w-24 text-right">Academia</TableHead>
              <TableHead className="w-24 text-right">Languages</TableHead>
              <TableHead className="w-24 text-right">Age</TableHead>
              <TableHead className="w-24 text-right">Location</TableHead>
              <TableHead className="w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.map((match, index) => {
              const mentorIdStr = String(match.mentor_id);
              const menteeIdStr = String(match.mentee_id);
              const mentor = mentors.find(m => m.id === mentorIdStr);
              const mentee = mentees.find(m => m.id === menteeIdStr);

              return (
                <TableRow key={`${match.mentor_id}-${match.mentee_id}`}>
                  <TableCell>
                    {onSelectMentor ? (
                      <button
                        onClick={() => onSelectMentor(mentorIdStr)}
                        className="hover:underline text-blue-600"
                      >
                        Mentor {match.mentor_id}
                      </button>
                    ) : (
                      <span>Mentor {match.mentor_id}</span>
                    )}
                    {mentor?.name && (
                      <p className="text-xs text-gray-500 truncate max-w-[100px]">
                        {mentor.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {onSelectMentee ? (
                      <button
                        onClick={() => onSelectMentee(menteeIdStr)}
                        className="hover:underline text-blue-600"
                      >
                        Mentee {match.mentee_id}
                      </button>
                    ) : (
                      <span>Mentee {match.mentee_id}</span>
                    )}
                    {mentee?.name && (
                      <p className="text-xs text-gray-500 truncate max-w-[100px]">
                        {mentee.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getScoreColor(match.total_score)}`}>
                    {formatScore(match.total_score)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatScore(match.gender_score)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatScore(match.academic_score)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatScore(match.language_score)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatScore(match.age_difference_score)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatScore(match.distance_score)}
                  </TableCell>
                  <TableCell>
                    {match.valid === false ? (
                      <Badge className="bg-red-100 text-red-800">Invalid</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Valid</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

