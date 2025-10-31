import { useEffect, useRef, useState, useMemo } from 'react';
import type { MouseEvent } from 'react';
import type { Mentor, Mentee, Match } from '../types';
import { Badge } from './ui/badge';

interface MatchingGraphProps {
  mentors: Mentor[];
  mentees: Mentee[];
  matches: Match[];
  selectedMentor: string | null;
  selectedMentee: string | null;
  onSelectMentor: (mentorId: string | null) => void;
  onSelectMentee: (menteeId: string | null) => void;
  getMatchStatus: (mentorId: string, menteeId: string) => 'manual-match' | 'manual-non-match' | 'auto';
}

interface Node {
  id: string;
  type: 'mentor' | 'mentee';
  x: number;
  y: number;
  name: string;
  data: Mentor | Mentee;
}

export function MatchingGraph({
  mentors,
  mentees,
  matches,
  selectedMentor,
  selectedMentee,
  onSelectMentor,
  onSelectMentee,
  getMatchStatus,
  isRecommendedPair,
}: MatchingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    // Create node positions
    const mentorNodes: Node[] = mentors.map((mentor, index) => ({
      id: mentor.id,
      type: 'mentor' as const,
      x: 100,
      y: 100 + index * 80,
      name: mentor.name,
      data: mentor,
    }));

    const menteeNodes: Node[] = mentees.map((mentee, index) => ({
      id: mentee.id,
      type: 'mentee' as const,
      x: 700,
      y: 100 + index * 80,
      name: mentee.name || `Mentee ${mentee.id}`,
      data: mentee,
    }));

    setNodes([...mentorNodes, ...menteeNodes]);
  }, [mentors, mentees]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`[MatchingGraph] Rendering ${matches.length} matches`);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    let drawnConnections = 0;
    matches.forEach(match => {
      const mentorNode = nodes.find(n => n.id === match.mentorId && n.type === 'mentor');
      const menteeNode = nodes.find(n => n.id === match.menteeId && n.type === 'mentee');

      if (!mentorNode || !menteeNode) return;

      const status = getMatchStatus(match.mentorId, match.menteeId);
      const isSelected = (selectedMentor === match.mentorId && selectedMentee === match.menteeId) ||
        selectedMentor === match.mentorId ||
        selectedMentee === match.menteeId;
      
      // Check if this is a recommended pair (optimal matching)
      const isRecommended = isRecommendedPair(match.mentorId, match.menteeId);

      // Determine line style based on final_score
      // 0: completely light gray, 1: blue, inf: green, -inf: red
      // Recommended pairs: purple dashed line
      let strokeStyle = '#e5e7eb'; // light gray-200 (for score = 0)
      let lineWidth = 1;
      let lineDash: number[] | undefined = undefined;

      // Check status only if match actually has scores (not initial 0 scores)
      // For initial matches with score 0, check if manual selection exists, otherwise show gray
      const isInitialMatch = match.globalScore === 0 && 
        match.scores.gender === 0 && 
        match.scores.academia === 0 && 
        match.scores.languages === 0 && 
        match.scores.ageDifference === 0 && 
        match.scores.geographicProximity === 0;

      // Priority order: recommended pairs > initial matches (gray) > manual selections > score-based colors
      // If a recommended pair is also manually matched, show it as green (manual match takes precedence)
      if (isRecommended && status === 'manual-match') {
        // Recommended pair that is manually matched - green solid line
        strokeStyle = '#10b981'; // green-500 (manual match = inf)
        lineWidth = 3;
        lineDash = undefined; // Solid line
      } else if (isRecommended) {
        // Recommended pair (optimal matching) - purple dashed line
        strokeStyle = '#9333ea'; // purple-600
        lineWidth = 3;
        lineDash = [5, 5]; // Dashed line
      } else if (isInitialMatch) {
        // Initial matches before matching - always light gray unless manually set
        // Only check manual status if it's not an initial match
        if (status === 'manual-non-match') {
          // Even initial matches can be manually set as non-match
          strokeStyle = '#ef4444'; // red-500 (manual non-match = -inf)
          lineWidth = 2;
        } else if (status === 'manual-match') {
          // Even initial matches can be manually set as match
          strokeStyle = '#10b981'; // green-500 (manual match = inf)
          lineWidth = 3;
        } else {
          // Initial match with no manual selection - always light gray
          strokeStyle = '#e5e7eb'; // light gray-200
          lineWidth = 1;
        }
      } else if (status === 'manual-match') {
        strokeStyle = '#10b981'; // green-500 (manual match = inf)
        lineWidth = 3;
      } else if (status === 'manual-non-match') {
        strokeStyle = '#ef4444'; // red-500 (manual non-match = -inf)
        lineWidth = 2;
      } else if (match.globalScore === Infinity || match.globalScore === 1000 || match.globalScore === 'Infinity' || match.globalScore === 'inf') {
        strokeStyle = '#10b981'; // green-500 (inf)
        lineWidth = 3;
      } else if (match.globalScore === -Infinity || match.globalScore === '-Infinity' || match.globalScore === '-inf' || (typeof match.globalScore === 'number' && !isFinite(match.globalScore) && match.globalScore < 0)) {
        strokeStyle = '#ef4444'; // red-500 (-inf)
        lineWidth = 2;
      } else if (match.globalScore === 0 || (typeof match.globalScore === 'number' && Math.abs(match.globalScore) < 0.001)) {
        strokeStyle = '#e5e7eb'; // completely light gray-200 (score = 0)
        lineWidth = 1;
      } else if (match.globalScore === 1 || (typeof match.globalScore === 'number' && Math.abs(match.globalScore - 1) < 0.001)) {
        strokeStyle = '#3b82f6'; // blue-500 (score = 1)
        lineWidth = 2;
      } else if (isSelected) {
        // Interpolate color based on score (0 = light gray, 1 = blue)
        const score = Math.max(0, Math.min(1, match.globalScore));
        if (score > 0.5) {
          // Between 0.5 and 1: interpolate from gray to blue
          const t = (score - 0.5) * 2; // t: 0 (at 0.5) to 1 (at 1.0)
          strokeStyle = `rgba(59, 130, 246, ${0.5 + t * 0.5})`; // blue with increasing opacity
          lineWidth = 1 + t;
        } else {
          // Between 0 and 0.5: interpolate from light gray to slightly blue
          const t = score * 2; // t: 0 (at 0) to 1 (at 0.5)
          strokeStyle = `rgba(229, 231, 235, ${1 - t * 0.3})`; // light gray fading
          lineWidth = 1;
        }
      } else {
        // Interpolate color based on score (0 = light gray, 1 = blue)
        // Normalize score to 0-1 range (assuming scores are typically 0-1)
        const normalizedScore = Math.max(0, Math.min(1, match.globalScore));
        
        if (normalizedScore > 0.5) {
          // Between 0.5 and 1: interpolate from light gray to blue
          const t = (normalizedScore - 0.5) * 2; // t: 0 (at 0.5) to 1 (at 1.0)
          // Interpolate RGB: gray (#e5e7eb = rgb(229,231,235)) to blue (#3b82f6 = rgb(59,130,246))
          const r = Math.round(229 - (229 - 59) * t);
          const g = Math.round(231 - (231 - 130) * t);
          const b = Math.round(235 - (235 - 246) * t);
          strokeStyle = `rgb(${r}, ${g}, ${b})`;
          lineWidth = 1 + t; // 1 to 2
        } else {
          // Between 0 and 0.5: stay light gray
          strokeStyle = '#e5e7eb'; // light gray-200
          lineWidth = 1;
        }
      }

      ctx.beginPath();
      ctx.moveTo(mentorNode.x + 60, mentorNode.y + 20);
      ctx.lineTo(menteeNode.x, menteeNode.y + 20);
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      if (lineDash) {
        ctx.setLineDash(lineDash);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      drawnConnections++;

    });
    
    console.log(`[MatchingGraph] Drew ${drawnConnections} connections from ${matches.length} matches`);

    // Draw score label for selected or high-score matches
    matches.forEach(match => {
      const mentorNode = nodes.find(n => n.id === match.mentorId && n.type === 'mentor');
      const menteeNode = nodes.find(n => n.id === match.menteeId && n.type === 'mentee');
      if (!mentorNode || !menteeNode) return;
      
      const isSelected = (selectedMentor === match.mentorId && selectedMentee === match.menteeId) ||
        selectedMentor === match.mentorId ||
        selectedMentee === match.menteeId;
      
      if (isSelected || match.globalScore > 0.7) {
        const midX = (mentorNode.x + menteeNode.x) / 2;
        const midY = (mentorNode.y + menteeNode.y) / 2;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(midX - 20, midY - 10, 40, 20);
        
        ctx.fillStyle = '#1f2937';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(match.globalScore.toFixed(2), midX, midY);
      }
    });
  }, [nodes, matches, selectedMentor, selectedMentee, getMatchStatus, isRecommendedPair]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicked on a node
    const clickedNode = nodes.find(node => {
      const dx = x - node.x - 30;
      const dy = y - node.y - 20;
      return Math.sqrt(dx * dx + dy * dy) < 30;
    });

    if (clickedNode) {
      if (clickedNode.type === 'mentor') {
        if (selectedMentor === clickedNode.id) {
          onSelectMentor(null);
        } else {
          onSelectMentor(clickedNode.id);
        }
      } else {
        if (selectedMentee === clickedNode.id) {
          onSelectMentee(null);
        } else {
          onSelectMentee(clickedNode.id);
        }
      }
    }
  };

  // Calculate all recommendations for selected mentor/mentee (memoized)
  // Top 3 get green badges, rest get gray badges
  const topMatches = useMemo(() => {
    const recommendations: Array<{ match: Match; rank: number; nodeId: string; nodeType: 'mentor' | 'mentee' }> = [];
    
    if (selectedMentor) {
      // Find all mentees for selected mentor (not just top 3)
      const mentorMatches = matches
        .filter(m => m.mentorId === selectedMentor)
        .filter(m => {
          // Exclude manual non-matches and -inf scores
          const status = getMatchStatus(m.mentorId, m.menteeId);
          if (status === 'manual-non-match') return false;
          if (m.globalScore === -Infinity || (typeof m.globalScore === 'number' && !isFinite(m.globalScore) && m.globalScore < 0)) return false;
          return true;
        })
        .sort((a, b) => {
          // Sort by score descending, prioritizing manual matches
          const aStatus = getMatchStatus(a.mentorId, a.menteeId);
          const bStatus = getMatchStatus(b.mentorId, b.menteeId);
          
          // Manual matches always come first
          if (aStatus === 'manual-match' && bStatus !== 'manual-match') return -1;
          if (bStatus === 'manual-match' && aStatus !== 'manual-match') return 1;
          
          // Then sort by score (handle Infinity properly)
          const aScore = typeof a.globalScore === 'number' && isFinite(a.globalScore) ? a.globalScore : a.globalScore === Infinity ? 1000 : -1000;
          const bScore = typeof b.globalScore === 'number' && isFinite(b.globalScore) ? b.globalScore : b.globalScore === Infinity ? 1000 : -1000;
          return bScore - aScore;
        });
      // Don't slice - include all matches for ranking
      
      mentorMatches.forEach((match, index) => {
        recommendations.push({
          match,
          rank: index + 1,
          nodeId: match.menteeId,
          nodeType: 'mentee'
        });
      });
    }
    
    if (selectedMentee) {
      // Find all mentors for selected mentee (not just top 3)
      const menteeMatches = matches
        .filter(m => m.menteeId === selectedMentee)
        .filter(m => {
          // Exclude manual non-matches and -inf scores
          const status = getMatchStatus(m.mentorId, m.menteeId);
          if (status === 'manual-non-match') return false;
          if (m.globalScore === -Infinity || (typeof m.globalScore === 'number' && !isFinite(m.globalScore) && m.globalScore < 0)) return false;
          return true;
        })
        .sort((a, b) => {
          // Sort by score descending, prioritizing manual matches
          const aStatus = getMatchStatus(a.mentorId, a.menteeId);
          const bStatus = getMatchStatus(b.mentorId, b.menteeId);
          
          // Manual matches always come first
          if (aStatus === 'manual-match' && bStatus !== 'manual-match') return -1;
          if (bStatus === 'manual-match' && aStatus !== 'manual-match') return 1;
          
          // Then sort by score (handle Infinity properly)
          const aScore = typeof a.globalScore === 'number' && isFinite(a.globalScore) ? a.globalScore : a.globalScore === Infinity ? 1000 : -1000;
          const bScore = typeof b.globalScore === 'number' && isFinite(b.globalScore) ? b.globalScore : b.globalScore === Infinity ? 1000 : -1000;
          return bScore - aScore;
        });
      // Don't slice - include all matches for ranking
      
      menteeMatches.forEach((match, index) => {
        recommendations.push({
          match,
          rank: index + 1,
          nodeId: match.mentorId,
          nodeType: 'mentor'
        });
      });
    }
    
    return recommendations;
  }, [matches, selectedMentor, selectedMentee, getMatchStatus]);

  return (
    <div className="relative">
      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 border-2 border-purple-600 border-dashed bg-transparent"></div>
          <span className="text-sm text-gray-600">Recommended</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-600">High Match ({'>'}0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Manual Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-600">Manual Non-Match</span>
        </div>
      </div>

      <div className="relative border rounded-lg bg-white overflow-auto" style={{ height: '600px' }}>
          <canvas
          ref={canvasRef}
          width={800}
          height={Math.max(600, Math.max(mentors.length, mentees.length) * 80 + 100)}
          onClick={handleCanvasClick}
          className="cursor-pointer"
        />

        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width="800"
          height={Math.max(600, Math.max(mentors.length, mentees.length) * 80 + 100)}
        >
          {nodes.map(node => {
            const isSelected = node.type === 'mentor' 
              ? selectedMentor === node.id 
              : selectedMentee === node.id;
            
            // Check if this node is in top 3 recommendations
            const topMatch = topMatches.find(tm => tm.nodeId === node.id && tm.nodeType === node.type);
            const isRecommended = !!topMatch;

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width="120"
                  height="40"
                  rx="8"
                  fill={isSelected ? '#3b82f6' : node.type === 'mentor' ? '#f3f4f6' : '#fef3c7'}
                  stroke={isSelected ? '#2563eb' : isRecommended ? '#10b981' : '#e5e7eb'}
                  strokeWidth={isSelected ? 2 : isRecommended ? 2 : 1}
                  className="pointer-events-none"
                />
                <text
                  x={node.x + 60}
                  y={node.y + 20}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#1f2937'}
                  fontSize="14"
                  fontWeight="600"
                  className="pointer-events-none"
                >
                  {node.type === 'mentor' 
                    ? `Mentor ${node.id}` 
                    : `Mentee ${node.id}`}
                </text>
                {/* Show recommendation badge */}
                {isRecommended && !isSelected && (
                  <g>
                    <circle
                      cx={node.type === 'mentor' ? node.x + 110 : node.x + 10}
                      cy={node.y + 10}
                      r="10"
                      fill={topMatch.rank <= 3 ? "#10b981" : "#9ca3af"}
                      className="pointer-events-none"
                    />
                    <text
                      x={node.type === 'mentor' ? node.x + 110 : node.x + 10}
                      y={node.y + 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="700"
                      className="pointer-events-none"
                    >
                      {topMatch.rank}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

    </div>
  );
}
