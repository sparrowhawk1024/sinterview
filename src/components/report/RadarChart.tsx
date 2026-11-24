import React, { useState } from "react";

interface RadarChartProps {
  scores: Record<string, number>; // relevance, technical_depth, structure, clarity, examples_metrics
  size?: number;
  className?: string;
}

interface DimensionMeta {
  key: string;
  label: string;
  description: string;
}

const DIMENSIONS: DimensionMeta[] = [
  {
    key: "relevance",
    label: "Relevance",
    description: "Addresses the exact question asked without evading or digressing.",
  },
  {
    key: "technical_depth",
    label: "Technical Depth",
    description: "Understanding of internal mechanisms, trade-offs, and edge cases.",
  },
  {
    key: "structure",
    label: "Structure (STAR)",
    description: "Coherent organization: STAR framework for behavioral, problem/solution for technical.",
  },
  {
    key: "clarity",
    label: "Clarity",
    description: "Concise articulation, coherent grammar, and zero circular jargon.",
  },
  {
    key: "examples_metrics",
    label: "Examples & Metrics",
    description: "Anchors explanations with production data, tooling, and concrete benchmarks.",
  },
];

export const RadarChart: React.FC<RadarChartProps> = ({
  scores,
  size = 340,
  className = "",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const center = size / 2;
  const radius = size * 0.36; // leave room for labels
  const totalAxes = DIMENSIONS.length;
  const angleStep = (Math.PI * 2) / totalAxes;
  // Rotate so first axis points directly up (-90 deg = -PI/2)
  const startAngle = -Math.PI / 2;

  // Grid levels (1 to 5)
  const levels = [1, 2, 3, 4, 5];

  // Helper to compute (x, y) given an angle and value (1 to 5)
  const getCoordinates = (angle: number, value: number, maxVal = 5) => {
    const clampedVal = Math.max(0, Math.min(maxVal, value));
    const r = (clampedVal / maxVal) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Polygon points for data
  const dataPoints = DIMENSIONS.map((dim, i) => {
    const angle = startAngle + i * angleStep;
    const score = scores[dim.key] ?? 0;
    return getCoordinates(angle, score);
  });

  const dataPolygonString = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="radarCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center ambient glow */}
        <circle cx={center} cy={center} r={radius} fill="url(#radarCenterGlow)" />

        {/* Concentric grid polygons (Levels 1 to 5) */}
        {levels.map((lvl) => {
          const points = DIMENSIONS.map((_, i) => {
            const angle = startAngle + i * angleStep;
            return getCoordinates(angle, lvl);
          })
            .map((p) => `${p.x},${p.y}`)
            .join(" ");

          return (
            <g key={`grid-level-${lvl}`}>
              <polygon
                points={points}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={lvl === 5 ? "1.5" : "1"}
                strokeDasharray={lvl < 5 ? "2 2" : undefined}
              />
              {/* Level number marker on vertical axis */}
              <text
                x={center + 4}
                y={center - (lvl / 5) * radius + 3}
                fontSize="9"
                fill="#94a3b8"
                fontWeight="bold"
              >
                {lvl}
              </text>
            </g>
          );
        })}

        {/* Axis Spokes from center to each vertex */}
        {DIMENSIONS.map((_, i) => {
          const angle = startAngle + i * angleStep;
          const outer = getCoordinates(angle, 5);
          return (
            <line
              key={`spoke-${i}`}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {/* Filled Data Polygon */}
        <polygon
          points={dataPolygonString}
          fill="url(#radarGradient)"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="transition-all duration-300 filter drop-shadow-sm"
        />

        {/* Vertices & Interactive Dots */}
        {dataPoints.map((p, i) => {
          const dim = DIMENSIONS[i];
          const val = scores[dim.key] ?? 0;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={`vertex-${dim.key}`}
              className="cursor-pointer group"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Outer halo on hover */}
              {isHovered && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="9"
                  fill="#6366f1"
                  fillOpacity="0.25"
                  className="animate-ping"
                />
              )}
              {/* Main Vertex Dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? "5.5" : "4"}
                fill="#4f46e5"
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all duration-150"
              />
            </g>
          );
        })}

        {/* Axis Labels & Score Badges */}
        {DIMENSIONS.map((dim, i) => {
          const angle = startAngle + i * angleStep;
          // Place label slightly beyond the outer ring (level 5.8)
          const labelCoord = getCoordinates(angle, 5.75);
          const score = scores[dim.key] ?? 0;
          const isHovered = hoveredIndex === i;

          // Align text depending on left/right side
          let textAnchor: "middle" | "start" | "end" = "middle";
          if (Math.abs(Math.cos(angle)) > 0.3) {
            textAnchor = Math.cos(angle) > 0 ? "start" : "end";
          }

          return (
            <g
              key={`label-${dim.key}`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <text
                x={labelCoord.x}
                y={labelCoord.y - 4}
                textAnchor={textAnchor}
                fontSize={isHovered ? "11.5" : "10.5"}
                fontWeight={isHovered ? "bold" : "600"}
                fill={isHovered ? "#4338ca" : "#334155"}
                className="transition-colors"
              >
                {dim.label}
              </text>
              <text
                x={labelCoord.x}
                y={labelCoord.y + 10}
                textAnchor={textAnchor}
                fontSize="10"
                fontWeight="bold"
                fill="#4f46e5"
              >
                {score > 0 ? `${score.toFixed(1)} / 5` : "N/A"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Active Dimension Tooltip Card */}
      {hoveredIndex !== null && (
        <div className="mt-2 p-2 px-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-950 max-w-xs text-center animate-fadeIn shadow-xs">
          <span className="font-bold text-primary block">
            {DIMENSIONS[hoveredIndex].label}: {(scores[DIMENSIONS[hoveredIndex].key] ?? 0).toFixed(1)} / 5.0
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block leading-snug">
            {DIMENSIONS[hoveredIndex].description}
          </span>
        </div>
      )}
    </div>
  );
};
