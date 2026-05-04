import OpenAI from 'openai'
import { NextResponse } from 'next/server'

function stripNonKorean(obj: unknown): unknown {
  if (typeof obj === 'string') return obj.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2E80-\u2EFF]/g, '')
  if (Array.isArray(obj)) return obj.map(stripNonKorean)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripNonKorean(v)]))
  return obj
}

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'placeholder',
  baseURL: 'https://api.groq.com/openai/v1',
})

const purposeMap: Record<string, string> = {
  product: '제품사진',
  food: '음식 사진',
  portrait: '인물 사진',
  space: '공간/인테리어 사진',
  landscape: '풍경 사진',
}

async function analyzeWithVision(imageBase64: string, mimeType: string, purpose: string) {
  const models = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: `촬영 목적: ${purposeMap[purpose] || purpose}\n\n반드시 순수한 한국어로만 작성하세요. 한자, 영어 단어를 절대 사용하지 마세요.\n\n다음 JSON만 반환:\n{"brightness":정수,"contrast":정수,"saturation":정수,"warmth":정수,"sharpness":정수,"analysis":{"composition":"순수 한국어 한문장","lighting":"순수 한국어 한문장","background":"순수 한국어 한문장","color":"순수 한국어 한문장"}}` },
          ],
        }],
      })
      const text = completion.choices[0].message.content || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
    } catch (e) {
      console.error(`Vision model ${model} failed:`, e)
    }
  }
  return null
}

async function analyzeWithText(purpose: string) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `${purposeMap[purpose] || purpose} 촬영을 위한 일반적인 보정 수치와 사진 분석을 JSON으로 반환해주세요. 반드시 순수한 한국어로만 작성하세요. 한자, 영어 단어를 절대 사용하지 마세요.\n{"brightness":정수(-50~50),"contrast":정수(-50~50),"saturation":정수(-50~50),"warmth":정수(-50~50),"sharpness":정수(0~100),"analysis":{"composition":"순수 한국어 설명","lighting":"순수 한국어 설명","background":"순수 한국어 설명","color":"순수 한국어 설명"}}`,
      }],
    })
    const text = completion.choices[0].message.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch (e) {
    console.error('Text fallback failed:', e)
  }
  return null
}

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, purpose } = await req.json()

    const defaultAnalysis = { composition: '중앙 구도로 피사체를 배치했습니다', lighting: '자연광이 활용된 사진입니다', background: '배경이 깔끔하게 처리되었습니다', color: '자연스러운 색감의 사진입니다' }
    const fallback = { brightness: 10, contrast: 5, saturation: 10, warmth: 5, sharpness: 30, analysis: defaultAnalysis }

    const raw = await analyzeWithVision(imageBase64, mimeType, purpose)
      ?? await analyzeWithText(purpose)
      ?? fallback

    const result = {
      ...fallback,
      ...raw,
      analysis: (raw?.analysis && typeof raw.analysis === 'object') ? { ...defaultAnalysis, ...raw.analysis } : defaultAnalysis,
    }

    return NextResponse.json(stripNonKorean(result))
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ brightness: 10, contrast: 5, saturation: 10, warmth: 5, sharpness: 30, analysis: { composition: '중앙 구도로 피사체를 배치했습니다', lighting: '자연광이 활용된 사진입니다', background: '배경이 깔끔하게 처리되었습니다', color: '자연스러운 색감의 사진입니다' } })
  }
}
