'use client'
import { Corrections } from '@/types'

interface Props {
  corrections: Corrections
  onChange: (corrections: Corrections) => void
}

const sliders = [
  { key: 'brightness', label: '밝기', min: -50, max: 50 },
  { key: 'contrast', label: '대비', min: -50, max: 50 },
  { key: 'saturation', label: '채도', min: -50, max: 50 },
  { key: 'warmth', label: '색온도', min: -50, max: 50 },
  { key: 'sharpness', label: '선명도', min: 0, max: 100 },
] as const

export default function ManualSliders({ corrections, onChange }: Props) {
  return (
    <div className="space-y-4">
      {sliders.map(({ key, label, min, max }) => (
        <div key={key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900">{corrections[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={corrections[key]}
            onChange={(e) => onChange({ ...corrections, [key]: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      ))}
    </div>
  )
}
