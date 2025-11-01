import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  isRecommendedPair: (mentorId: string, menteeId: string) => boolean;
  finalMatches?: any[]; // Optional final matches from backend
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
  finalMatches = [],
}: MatchingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Update container size on resize using ResizeObserver for better accuracy
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableWidth = rect.width || 800;
        const calculatedHeight = Math.max(600, Math.max(mentors.length, mentees.length) * 80 + 200);
        setContainerSize({
          width: Math.max(800, availableWidth), // Min width 800
          height: calculatedHeight,
        });
      }
    };

    updateSize();
    
    // Use ResizeObserver for better accuracy when container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Also listen to window resize as fallback
    window.addEventListener('resize', updateSize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [mentors.length, mentees.length]);

  useEffect(() => {
    // Calculate node positions dynamically based on container width
    const nodeWidth = 120;
    const nodeHeight = 40;
    const padding = 40; // Padding from edges
    const spacing = containerSize.width - 2 * padding - 2 * nodeWidth; // Space between mentor and mentee columns
    
    const mentorX = padding;
    const menteeX = padding + nodeWidth + spacing;
    
    // Ensure mentee nodes don't go beyond container
    const maxMenteeX = containerSize.width - padding - nodeWidth;
    const actualMenteeX = Math.min(menteeX, maxMenteeX - nodeWidth);
    
    // Find all matched pairs (manual matches)
    const matchedPairs: Array<{ mentorId: string; menteeId: string; mentorIndex: number; menteeIndex: number }> = [];
    const matchedMentorIds = new Set<string>();
    const matchedMenteeIds = new Set<string>();
    
    mentors.forEach((mentor, mentorIndex) => {
      mentees.forEach((mentee, menteeIndex) => {
        const status = getMatchStatus(mentor.id, mentee.id);
        if (status === 'manual-match') {
          matchedPairs.push({
            mentorId: mentor.id,
            menteeId: mentee.id,
            mentorIndex,
            menteeIndex,
          });
          matchedMentorIds.add(mentor.id);
          matchedMenteeIds.add(mentee.id);
        }
      });
    });
    
    // Sort matched pairs to maintain consistent ordering
    matchedPairs.sort((a, b) => {
      // First sort by mentor index, then by mentee index
      if (a.mentorIndex !== b.mentorIndex) {
        return a.mentorIndex - b.mentorIndex;
      }
      return a.menteeIndex - b.menteeIndex;
    });
    
    // Create all mentor and mentee nodes
    const allMentorNodes: Node[] = mentors.map((mentor, originalIndex) => ({
      id: mentor.id,
      type: 'mentor' as const,
      x: mentorX,
      y: 0, // Will be set below
      name: mentor.name,
      data: mentor,
    }));
    
    const allMenteeNodes: Node[] = mentees.map((mentee, originalIndex) => ({
      id: mentee.id,
      type: 'mentee' as const,
      x: actualMenteeX,
      y: 0, // Will be set below
      name: mentee.name || `Mentee ${mentee.id}`,
      data: mentee,
    }));
    
    // Position matched pairs at the top in the same row
    matchedPairs.forEach((pair, rowIndex) => {
      const mentorNode = allMentorNodes.find(n => n.id === pair.mentorId);
      const menteeNode = allMenteeNodes.find(n => n.id === pair.menteeId);
      const yPosition = 100 + rowIndex * 80;
      
      if (mentorNode) {
        mentorNode.y = yPosition;
      }
      if (menteeNode) {
        menteeNode.y = yPosition;
      }
    });
    
    // Position unmatched nodes below matched pairs in original order
    const startY = 100 + matchedPairs.length * 80;
    const unmatchedMentors = allMentorNodes
      .filter(node => !matchedMentorIds.has(node.id))
      .map((node, index) => {
        // Find original index in mentors array
        const originalIndex = mentors.findIndex(m => m.id === node.id);
        return { node, originalIndex };
      })
      .sort((a, b) => a.originalIndex - b.originalIndex);
    
    const unmatchedMentees = allMenteeNodes
      .filter(node => !matchedMenteeIds.has(node.id))
      .map((node, index) => {
        // Find original index in mentees array
        const originalIndex = mentees.findIndex(m => m.id === node.id);
        return { node, originalIndex };
      })
      .sort((a, b) => a.originalIndex - b.originalIndex);
    
    // Position unmatched mentors and mentees maintaining their original relative order
    unmatchedMentors.forEach((item, index) => {
      item.node.y = startY + index * 80;
    });
    
    unmatchedMentees.forEach((item, index) => {
      item.node.y = startY + index * 80;
    });
    
    setNodes([...allMentorNodes, ...allMenteeNodes]);
  }, [mentors, mentees, containerSize.width, getMatchStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`[MatchingGraph] Rendering ${matches.length} matches`);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find all nodes that have manual matches (green edges)
    // These nodes should only show their manual match edge, all other edges should be hidden
    const nodesWithManualMatches = new Set<string>();
    matches.forEach(match => {
      const status = getMatchStatus(match.mentorId, match.menteeId);
      if (status === 'manual-match') {
        nodesWithManualMatches.add(`mentor-${match.mentorId}`);
        nodesWithManualMatches.add(`mentee-${match.menteeId}`);
      }
    });

    // Draw ALL connections - show all edges, not just recommended ones
    let drawnConnections = 0;
    matches.forEach(match => {
      const mentorNode = nodes.find(n => n.id === match.mentorId && n.type === 'mentor');
      const menteeNode = nodes.find(n => n.id === match.menteeId && n.type === 'mentee');

      if (!mentorNode || !menteeNode) return;

      const status = getMatchStatus(match.mentorId, match.menteeId);
      
      // Check if this edge should be hidden because one of its nodes has a manual match
      // But show it if this edge itself is the manual match
      const mentorHasManualMatch = nodesWithManualMatches.has(`mentor-${match.mentorId}`);
      const menteeHasManualMatch = nodesWithManualMatches.has(`mentee-${match.menteeId}`);
      const shouldHideEdge = (mentorHasManualMatch || menteeHasManualMatch) && status !== 'manual-match';
      
      // Skip drawing this edge if it should be hidden
      if (shouldHideEdge) {
        return;
      }
      const isSelected = (selectedMentor === match.mentorId && selectedMentee === match.menteeId) ||
        selectedMentor === match.mentorId ||
        selectedMentee === match.menteeId;
      
      // Check if either node is selected (for making edges bold)
      const isMentorSelected = selectedMentor === match.mentorId;
      const isMenteeSelected = selectedMentee === match.menteeId;
      const hasSelectedNode = isMentorSelected || isMenteeSelected;
      
      // Check if both nodes are selected (for making edge extra bold)
      const bothSelected = isMentorSelected && isMenteeSelected;
      
      // Check if this is a recommended pair (optimal matching)
      const isRecommended = isRecommendedPair(match.mentorId, match.menteeId);

      // Determine line style based on final_score
      // 0: completely light gray, 1: blue, inf: green, -inf: red
      // Recommended pairs: purple dashed line
      let strokeStyle = '#e5e7eb'; // light gray-200 (for score = 0)
      let lineWidth = hasSelectedNode ? 1.2 : 0.7; // Slightly thicker for both selected and non-selected
      let lineDash: number[] | undefined = undefined;

      // Check status only if match actually has scores (not initial 0 scores)
      // For initial matches with score 0, check if manual selection exists, otherwise show gray
      const isInitialMatch = match.globalScore === 0 && 
        match.scores.gender === 0 && 
        match.scores.academia === 0 && 
        match.scores.languages === 0 && 
        match.scores.ageDifference === 0 && 
        match.scores.geographicProximity === 0;

      // Priority order: manual selections > score = 0 (red) > recommended pairs > score-based colors
      // Manual matches/non-matches take highest priority
      if (status === 'manual-match') {
        strokeStyle = '#10b981'; // green-500 (manual match = inf)
        lineWidth = bothSelected ? 5.5 : (hasSelectedNode ? 3.5 : 2.3);
        lineDash = undefined; // Solid line
      } else if (status === 'manual-non-match') {
        strokeStyle = '#fca5a5'; // red-300 (lighter red for manual non-match = -inf)
        lineWidth = bothSelected ? 4.3 : (hasSelectedNode ? 2.3 : 1.2);
      } else if (match.globalScore === Infinity || match.globalScore === 1000 || (typeof match.globalScore === 'string' && (match.globalScore === 'Infinity' || match.globalScore === 'inf'))) {
        strokeStyle = '#10b981'; // green-500 (inf)
        lineWidth = bothSelected ? 5.5 : (hasSelectedNode ? 3.5 : 2.3);
      } else if (match.globalScore === -Infinity || (typeof match.globalScore === 'string' && (match.globalScore === '-Infinity' || match.globalScore === '-inf')) || (typeof match.globalScore === 'number' && !isFinite(match.globalScore) && match.globalScore < 0)) {
        strokeStyle = '#fca5a5'; // red-300 (lighter red for -inf)
        lineWidth = bothSelected ? 4.3 : (hasSelectedNode ? 2.3 : 1.2);
      } else if (match.globalScore === 0 || (typeof match.globalScore === 'number' && Math.abs(match.globalScore) < 0.001)) {
        // Score = 0 should be red, even if recommended
        strokeStyle = '#fca5a5'; // red-300 (lighter red for score = 0)
        lineWidth = bothSelected ? 2.2 : (hasSelectedNode ? 1.2 : 0.7);
      } else if (isRecommended) {
        // Recommended pair (optimal matching) - purple dashed line (only if score > 0)
        strokeStyle = '#9333ea'; // purple-600
        lineWidth = bothSelected ? 5.5 : (hasSelectedNode ? 3.5 : 2.3);
        lineDash = [5, 5]; // Dashed line
      } else if (isInitialMatch) {
        // Initial matches before matching - always red (score = 0)
        // Manual statuses are already handled above, so this is only for auto status
        strokeStyle = '#fca5a5'; // red-300 (lighter red for score = 0)
        lineWidth = bothSelected ? 2.2 : (hasSelectedNode ? 1.2 : 0.7);
      } else if (match.globalScore === 1 || (typeof match.globalScore === 'number' && Math.abs(match.globalScore - 1) < 0.001)) {
        strokeStyle = '#3b82f6'; // blue-500 (score = 1)
        lineWidth = bothSelected ? 4.3 : (hasSelectedNode ? 2.3 : 1.2);
      } else if (isSelected) {
        // Interpolate color based on score (0 = light gray, 1 = blue)
        const score = Math.max(0, Math.min(1, match.globalScore));
        if (score > 0.5) {
          // Between 0.5 and 1: interpolate from gray to blue
          const t = (score - 0.5) * 2; // t: 0 (at 0.5) to 1 (at 1.0)
          strokeStyle = `rgba(59, 130, 246, ${0.5 + t * 0.5})`; // blue with increasing opacity
          const baseWidth = hasSelectedNode ? (1.2 + t * 0.8) : (0.7 + t * 0.5);
          lineWidth = bothSelected ? baseWidth + 2 : baseWidth;
        } else {
          // Between 0 and 0.5: interpolate from light gray to slightly blue
          const t = score * 2; // t: 0 (at 0) to 1 (at 0.5)
          strokeStyle = `rgba(229, 231, 235, ${1 - t * 0.3})`; // light gray fading
          lineWidth = bothSelected ? 3.2 : (hasSelectedNode ? 1.2 : 0.7);
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
          const baseWidth = hasSelectedNode ? (1.2 + t * 0.8) : (0.7 + t * 0.5); // 0.7 to 1.2 for non-selected, 1.2 to 2 for selected
          lineWidth = bothSelected ? baseWidth + 2 : baseWidth;
        } else {
          // Between 0 and 0.5: stay light gray
          strokeStyle = '#e5e7eb'; // light gray-200
          lineWidth = bothSelected ? 3.2 : (hasSelectedNode ? 1.2 : 0.7);
        }
      }

      ctx.beginPath();
      // Start from right edge of mentor node (node width is 120)
      // Account for stroke width so the line visually touches the node boundary
      const mentorX = mentorNode.x + 120 + (lineWidth / 2);
      const mentorY = mentorNode.y + 20; // Vertical center (node height is 40)
      // End at left edge of mentee node
      // Account for stroke width so the line visually touches the node boundary
      // The stroke is centered on the path, so extend into the node by half the stroke width
      const menteeX = menteeNode.x - (lineWidth / 2);
      const menteeY = menteeNode.y + 20; // Vertical center (node height is 40)
      ctx.moveTo(mentorX, mentorY);
      ctx.lineTo(menteeX, menteeY);
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
  }, [nodes, matches, selectedMentor, selectedMentee, getMatchStatus, isRecommendedPair, finalMatches, containerSize]);

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
          <span className="text-sm text-gray-600">High connection ({'>'}0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-600">Non-Match</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative border rounded-lg bg-white overflow-auto w-full"
        style={{ minHeight: '600px', height: `${containerSize.height}px` }}
      >
        <canvas
          ref={canvasRef}
          width={containerSize.width}
          height={containerSize.height}
          onClick={handleCanvasClick}
          className="cursor-pointer"
          style={{ display: 'block', width: '100%', height: '100%' }}
        />

        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={containerSize.width}
          height={containerSize.height}
        >
          {nodes.map(node => {
            const isSelected = node.type === 'mentor' 
              ? selectedMentor === node.id 
              : selectedMentee === node.id;
            
            // Check if this node is in top recommendations
            const topMatch = topMatches.find(tm => tm.nodeId === node.id && tm.nodeType === node.type);
            const isRecommended = !!topMatch;
            
            // Check if this node is part of a recommended pair (has purple dashed line)
            // This happens when the opposite node type is selected and this node is the recommended match
            const isPartOfRecommendedPair = (node.type === 'mentor' && selectedMentee && isRecommendedPair(node.id, selectedMentee)) ||
                                            (node.type === 'mentee' && selectedMentor && isRecommendedPair(selectedMentor, node.id));
            
            // Determine edge color for this node based on connections to selected node
            // This applies to both selected and non-selected nodes
            let edgeColor: 'red' | 'purple' | 'green' | 'blue' | 'gray' = 'gray';
            let connectedMatch: Match | undefined = undefined;
            let redEdgeRank: number | undefined = undefined;
            
            // Find the relevant edge based on selection
            // Priority: Check connection to the selected opposite node
            if ((selectedMentor || selectedMentee) && 
                !(node.type === 'mentor' && node.id === selectedMentor) && 
                !(node.type === 'mentee' && node.id === selectedMentee)) {
              // Node is NOT selected, check connection to selected opposite node
              if (node.type === 'mentor' && selectedMentee) {
                // Check edge from this mentor to selected mentee
                connectedMatch = matches.find(m => m.mentorId === node.id && m.menteeId === selectedMentee);
              } else if (node.type === 'mentee' && selectedMentor) {
                // Check edge from selected mentor to this mentee
                connectedMatch = matches.find(m => m.mentorId === selectedMentor && m.menteeId === node.id);
              }
            } else if (node.type === 'mentor' && node.id === selectedMentor && selectedMentee) {
              // This mentor is selected, check edge to selected mentee
              connectedMatch = matches.find(m => m.mentorId === node.id && m.menteeId === selectedMentee);
            } else if (node.type === 'mentee' && node.id === selectedMentee && selectedMentor) {
              // This mentee is selected, check edge from selected mentor
              connectedMatch = matches.find(m => m.mentorId === selectedMentor && m.menteeId === node.id);
            }
            
            if (connectedMatch) {
              const status = getMatchStatus(connectedMatch.mentorId, connectedMatch.menteeId);
              const isRecommended = isRecommendedPair(connectedMatch.mentorId, connectedMatch.menteeId);
              
              // Determine edge color based on the same logic as edge drawing
              if (status === 'manual-match' || connectedMatch.globalScore === Infinity || 
                  connectedMatch.globalScore === 1000 || 
                  (typeof connectedMatch.globalScore === 'string' && (connectedMatch.globalScore === 'Infinity' || connectedMatch.globalScore === 'inf'))) {
                edgeColor = 'green';
              } else if (status === 'manual-non-match' || 
                        connectedMatch.globalScore === -Infinity || 
                        (typeof connectedMatch.globalScore === 'string' && (connectedMatch.globalScore === '-Infinity' || connectedMatch.globalScore === '-inf')) ||
                        (typeof connectedMatch.globalScore === 'number' && !isFinite(connectedMatch.globalScore) && connectedMatch.globalScore < 0) ||
                        connectedMatch.globalScore === 0 ||
                        (typeof connectedMatch.globalScore === 'number' && Math.abs(connectedMatch.globalScore) < 0.001)) {
                edgeColor = 'red';
              } else if (isRecommended) {
                edgeColor = 'purple';
              } else if (connectedMatch.globalScore === 1 || 
                        (typeof connectedMatch.globalScore === 'number' && Math.abs(connectedMatch.globalScore - 1) < 0.001)) {
                edgeColor = 'blue';
              }
              
              // Calculate rank for red edges
              if (edgeColor === 'red') {
                if (node.type === 'mentor' && selectedMentee) {
                  const allMatchesForMentee = matches
                    .filter(m => m.menteeId === selectedMentee)
                    .sort((a, b) => {
                      const aScore = typeof a.globalScore === 'number' && isFinite(a.globalScore) ? a.globalScore : a.globalScore === Infinity ? 1000 : -1000;
                      const bScore = typeof b.globalScore === 'number' && isFinite(b.globalScore) ? b.globalScore : b.globalScore === Infinity ? 1000 : -1000;
                      return bScore - aScore;
                    });
                  const rankIndex = allMatchesForMentee.findIndex(m => m.mentorId === node.id);
                  redEdgeRank = rankIndex >= 0 ? rankIndex + 1 : undefined;
                } else if (node.type === 'mentee' && selectedMentor) {
                  const allMatchesForMentor = matches
                    .filter(m => m.mentorId === selectedMentor)
                    .sort((a, b) => {
                      const aScore = typeof a.globalScore === 'number' && isFinite(a.globalScore) ? a.globalScore : a.globalScore === Infinity ? 1000 : -1000;
                      const bScore = typeof b.globalScore === 'number' && isFinite(b.globalScore) ? b.globalScore : b.globalScore === Infinity ? 1000 : -1000;
                      return bScore - aScore;
                    });
                  const rankIndex = allMatchesForMentor.findIndex(m => m.menteeId === node.id);
                  redEdgeRank = rankIndex >= 0 ? rankIndex + 1 : undefined;
                }
              }
            }
            
            // For backward compatibility, set isConnectedViaRedEdge
            const isConnectedViaRedEdge = edgeColor === 'red';

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width="120"
                  height="40"
                  rx="8"
                  fill={isSelected ? '#3b82f6' : node.type === 'mentor' ? '#f3f4f6' : '#fef3c7'}
                  stroke={
                    edgeColor === 'red'
                      ? '#ef4444'  // Red for red edges
                      : edgeColor === 'purple'
                      ? '#9333ea'  // Purple for recommended pairs
                      : edgeColor === 'green'
                      ? '#10b981'  // Green for high matches
                      : edgeColor === 'blue'
                      ? '#3b82f6'  // Blue for score = 1
                      : isSelected
                      ? '#2563eb'  // Blue for selected nodes (if no edge color)
                      : '#e5e7eb'  // Gray for regular nodes
                  }
                  strokeWidth={(isSelected || edgeColor !== 'gray') ? 2 : 1}
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
                {/* Show badge based on edge color - visible even when selected */}
                {(edgeColor !== 'gray' || (isRecommended && topMatch)) && (
                  <g>
                    <circle
                      cx={node.type === 'mentor' ? node.x + 110 : node.x + 10}
                      cy={node.y + 10}
                      r="10"
                      fill={
                        edgeColor === 'red'
                          ? "#ef4444"  // Red for red edges
                          : edgeColor === 'purple'
                          ? "#9333ea"  // Purple for recommended pairs
                          : edgeColor === 'green'
                          ? "#10b981"  // Green for high matches
                          : edgeColor === 'blue'
                          ? "#3b82f6"  // Blue for score = 1
                          : (isRecommended && topMatch && topMatch.rank <= 3)
                          ? "#10b981"  // Green for top 3 recommendations
                          : "#9ca3af"  // Gray for other recommendations
                      }
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
                      {edgeColor === 'red' && redEdgeRank
                        ? redEdgeRank
                        : isRecommended && topMatch
                        ? topMatch.rank
                        : '!'}
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
