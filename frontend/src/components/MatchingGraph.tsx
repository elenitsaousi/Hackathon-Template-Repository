import { useEffect, useRef, useState } from 'react';
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
}: MatchingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
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

      // Determine line style based on final_score
      // 0: completely light gray, 1: blue, inf: green, -inf: red
      let strokeStyle = '#e5e7eb'; // light gray-200 (for score = 0)
      let lineWidth = 1;

      if (status === 'manual-match') {
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
  }, [nodes, matches, selectedMentor, selectedMentee, getMatchStatus]);

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

  const handleCanvasMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hoveredNode = nodes.find(node => {
      const dx = x - node.x - 30;
      const dy = y - node.y - 20;
      return Math.sqrt(dx * dx + dy * dy) < 30;
    });

    setHoveredNode(hoveredNode || null);
  };

  return (
    <div className="relative">
      <div className="mb-4 flex gap-4 items-center">
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
          onMouseMove={handleCanvasMouseMove}
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
            const isHovered = hoveredNode?.id === node.id && hoveredNode?.type === node.type;

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width="120"
                  height="40"
                  rx="8"
                  fill={isSelected ? '#3b82f6' : node.type === 'mentor' ? '#f3f4f6' : '#fef3c7'}
                  stroke={isHovered ? '#1f2937' : isSelected ? '#2563eb' : '#e5e7eb'}
                  strokeWidth={isHovered || isSelected ? 2 : 1}
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
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredNode && (
        <div className="absolute top-4 right-4 bg-white border rounded-lg shadow-lg p-4 max-w-xs z-10">
          <h3 className="mb-2">{hoveredNode.type === 'mentor' ? 'Mentor' : 'Mentee'} {hoveredNode.id}</h3>
          <div className="space-y-1 text-sm">
            {hoveredNode.type === 'mentor' && (
              <>
                <p className="text-gray-600"><span className="font-medium">Gender:</span> {(hoveredNode.data as Mentor).gender || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Languages:</span> {(hoveredNode.data as Mentor).languages.join(', ') || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Location:</span> {(hoveredNode.data as Mentor).location || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Degree:</span> {(hoveredNode.data as Mentor).degree || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Age:</span> {(hoveredNode.data as Mentor).birthYear ? new Date().getFullYear() - (hoveredNode.data as Mentor).birthYear : 'N/A'}</p>
              </>
            )}
            {hoveredNode.type === 'mentee' && (
              <>
                <p className="text-gray-600"><span className="font-medium">Gender:</span> {(hoveredNode.data as Mentee).gender || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Languages:</span> {(hoveredNode.data as Mentee).languages.join(', ') || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Location:</span> {(hoveredNode.data as Mentee).location || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Degree:</span> {(hoveredNode.data as Mentee).degree || 'N/A'}</p>
                <p className="text-gray-600"><span className="font-medium">Age:</span> {(hoveredNode.data as Mentee).age || 'N/A'}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
