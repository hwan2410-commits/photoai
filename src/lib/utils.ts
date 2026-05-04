import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PURPOSES = [
  { value: 'product', label: '제품사진', emoji: '📦' },
  { value: 'food', label: '음식', emoji: '🍽️' },
  { value: 'portrait', label: '인물', emoji: '👤' },
  { value: 'space', label: '공간', emoji: '🏠' },
  { value: 'landscape', label: '풍경', emoji: '🌄' },
]

export function clamp(value: number): number {
  return Math.max(0, Math.min(255, value))
}
