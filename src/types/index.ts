export interface Corrections {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  sharpness: number
}

export interface GeminiAnalysis {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  sharpness: number
  analysis: {
    composition: string
    lighting: string
    background: string
    color: string
  }
}

export interface FeedbackItem {
  title: string
  problem: string
  solution: string
}

export interface GroqFeedback {
  score: number
  correction_summary: string
  good_points: string[]
  improvements: FeedbackItem[]
  next_shot_tip: string
}

export interface PhotoEdit {
  id: string
  user_id: string
  original_url: string
  edited_url: string | null
  purpose: string
  corrections: Corrections | null
  gemini_analysis: GeminiAnalysis | null
  groq_feedback: GroqFeedback | null
  score: number | null
  created_at: string
}
