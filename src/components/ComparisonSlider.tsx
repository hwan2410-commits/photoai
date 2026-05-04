'use client'
import { useRef, useState } from 'react'

interface Props {
  before: string
  after: string
}

export default function ComparisonSlider({ before, after }: Props) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleMove(clientX: number) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setPosition(pct)
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl cursor-col-resize"
      style={{ userSelect: 'none' }}
      onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="보정 후" className="w-full block" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="보정 전" className="block" style={{ width: `${10000 / position}%`, maxWidth: 'none' }} draggable={false} />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8H1M1 8L3 6M1 8L3 10M11 8H15M15 8L13 6M15 8L13 10" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">원본</div>
      <div className="absolute top-2 right-2 bg-indigo-600/80 text-white text-xs px-2 py-1 rounded">보정 후</div>
    </div>
  )
}
