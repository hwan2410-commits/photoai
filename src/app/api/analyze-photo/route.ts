import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const HANJA_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2E80-\u2EFF]/

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

async function fixHanja(text: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: '당신은 한국어 교정 전문가입니다. 입력된 텍스트에서 한자(漢字)나 중국어 글자를 찾아 문맥에 맞는 자연스러운 한글로 바꿔주세요. 예: 單→단순한, 美→아름다운, 色→색상. 텍스트 구조는 절대 변경하지 말고 한자만 교체하세요.',
      },
      {
        role: 'user',
        content: `다음 텍스트에서 한자만 한글로 교체해주세요. 다른 내용은 절대 변경하지 마세요:\n\n${text}`,
      },
    ],
  })
  return completion.choices[0].message.content || text
}

function safeCorrections(raw: Record<string, unknown>) {
  const n = (v: unknown, fallback: number) => {
    const num = Number(v)
    return isNaN(num) ? fallback : num
  }
  return {
    brightness: Math.max(-25, Math.min(25, n(raw.brightness, 5))),
    contrast:   Math.max(-25, Math.min(25, n(raw.contrast, 5))),
    saturation: Math.max(-25, Math.min(25, n(raw.saturation, 5))),
    warmth:     Math.max(-15, Math.min(15, n(raw.warmth, 0))),
    sharpness:  Math.max(0,   Math.min(50, n(raw.sharpness, 20))),
  }
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
            { type: 'text', text: `촬영 목적: ${purposeMap[purpose] || purpose}\n\n이 사진을 실제로 보고 보이는 것만 설명하세요. 절대 가정하거나 상상하지 마세요.\n\n특히:\n- 배경의 실제 색상과 질감을 정확히 설명하세요 (예: 흰색 벽, 나무 테이블, 잔디, 콘크리트 등)\n- 조명의 방향과 광원을 실제로 보이는 대로 설명하세요\n- 색감은 사진에 실제로 보이는 색을 설명하세요\n\n보정 수치는 자연스러운 결과를 위해 작은 값을 사용하세요. 수치가 너무 크면 이미지 품질이 저하됩니다.\n\n반드시 순수한 한국어(한글)로만 작성하세요. 한자 절대 금지.\n\n다음 JSON만 반환:\n{"brightness":정수(-25~25),"contrast":정수(-25~25),"saturation":정수(-25~25),"warmth":정수(-15~15),"sharpness":정수(0~50),"analysis":{"composition":"실제로 보이는 구도 한 문장","lighting":"실제로 보이는 조명 한 문장","background":"실제로 보이는 배경 색상과 질감 한 문장","color":"실제로 보이는 색감 한 문장"}}` },
          ],
        }],
      })
      const text = completion.choices[0].message.content || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) continue
      const parsed = JSON.parse(match[0])
      // 한자가 있으면 analysis 텍스트만 개별 교체
      if (HANJA_REGEX.test(text) && parsed.analysis) {
        for (const key of Object.keys(parsed.analysis)) {
          if (HANJA_REGEX.test(parsed.analysis[key])) {
            const fixed = await fixHanja(parsed.analysis[key])
            parsed.analysis[key] = fixed.trim()
          }
        }
      }
      return parsed
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
        content: `${purposeMap[purpose] || purpose} 촬영을 위한 자연스러운 보정 수치와 사진 분석을 JSON으로 반환해주세요. 수치가 너무 크면 이미지 품질이 저하되므로 작은 값을 사용하세요. 반드시 순수한 한국어(한글)로만 작성하세요. 한자 절대 금지.\n{"brightness":정수(-25~25),"contrast":정수(-25~25),"saturation":정수(-25~25),"warmth":정수(-15~15),"sharpness":정수(0~50),"analysis":{"composition":"한국어 설명","lighting":"한국어 설명","background":"한국어 설명","color":"한국어 설명"}}`,
      }],
    })
    let text = completion.choices[0].message.content || ''
    if (HANJA_REGEX.test(text)) text = await fixHanja(text)
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
      ...safeCorrections(raw),
      analysis: (raw?.analysis && typeof raw.analysis === 'object') ? { ...defaultAnalysis, ...raw.analysis } : defaultAnalysis,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ brightness: 5, contrast: 5, saturation: 5, warmth: 0, sharpness: 20, analysis: { composition: '중앙 구도로 피사체를 배치했습니다', lighting: '자연광이 활용된 사진입니다', background: '배경이 깔끔하게 처리되었습니다', color: '자연스러운 색감의 사진입니다' } })
  }
}
