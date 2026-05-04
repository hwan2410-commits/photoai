'use client'

interface Props {
  score: number
  size?: number
}

export default function ScoreCircle({ score, size = 120 }: Props) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text
          x={size / 2}
          y={size / 2 + 6}
          textAnchor="middle"
          fontSize="24"
          fontWeight="bold"
          fill={color}
        >
          {score}
        </text>
      </svg>
      <span className="text-sm text-gray-500">점</span>
    </div>
  )
}
