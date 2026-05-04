import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const HANJA_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2E80-\u2EFF]/

const purposeMap: Record<string, string> = {
  product: '제품사진',
  food: '음식 사진',
  portrait: '인물 사진',
  space: '공간/인테리어 사진',
  landscape: '풍경 사진',
}

async function fixHanja(groq: OpenAI, text: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: '한자(漢字)를 문맥에 맞는 자연스러운 한글로 교체해주세요. 다른 내용은 절대 변경하지 마세요.' },
      { role: 'user', content: `한자만 한글로 교체하세요:\n\n${text}` },
    ],
  })
  return completion.choices[0].message.content || text
}

async function fixParsedHanja(groq: OpenAI, obj: Record<string, unknown>): Promise<void> {
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string' && HANJA_REGEX.test(val)) {
      obj[key] = (await fixHanja(groq, val)).trim()
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === 'string' && HANJA_REGEX.test(val[i])) {
          val[i] = (await fixHanja(groq, val[i])).trim()
        } else if (val[i] && typeof val[i] === 'object') {
          await fixParsedHanja(groq, val[i] as Record<string, unknown>)
        }
      }
    } else if (val && typeof val === 'object') {
      await fixParsedHanja(groq, val as Record<string, unknown>)
    }
  }
}

function parseJsonSafe(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const sanitized = match[0].replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    )
    return JSON.parse(sanitized)
  } catch { return null }
}

const SYSTEM_PROMPT = '당신은 전문 사진작가이자 사진 보정 전문가입니다. 사진을 직접 보고 실제 내용을 바탕으로 구체적이고 정확한 피드백을 제공하세요. 반드시 순수한 한국어(한글)로만 작성하세요. 한자(漢字)나 중국어 글자를 절대 사용하지 마세요.'

function buildUserPrompt(purpose: string, corrections: Record<string, number>, analysis: Record<string, string>) {
  return `촬영 목적: ${purposeMap[purpose] || purpose}
적용된 보정: 밝기 ${corrections.brightness}, 대비 ${corrections.contrast}, 채도 ${corrections.saturation}, 색온도 ${corrections.warmth}, 선명도 ${corrections.sharpness}
사진 분석:
- 구도: ${analysis?.composition || ''}
- 조명: ${analysis?.lighting || ''}
- 배경: ${analysis?.background || ''}
- 색감: ${analysis?.color || ''}

위 사진을 직접 보고 실제로 보이는 내용을 바탕으로 피드백하세요. 절대 일반적인 말이나 가정을 쓰지 마세요.

다음 JSON 형식으로 반환 (모든 텍스트는 반드시 한글로만):
{
  "score": 0~100 정수,
  "correction_summary": "적용된 보정이 사진에 미친 실제 효과 한 문장",
  "good_points": ["실제로 잘 된 점 1", "실제로 잘 된 점 2", "실제로 잘 된 점 3"],
  "improvements": [
    {"title": "개선 항목", "problem": "실제로 보이는 문제점", "solution": "구체적인 해결 방법"}
  ],
  "next_shot_tip": "이 사진을 바탕으로 한 다음 촬영 핵심 팁 한 문장"
}`
}

export async function POST(req: Request) {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'placeholder',
    baseURL: 'https://api.groq.com/openai/v1',
  })

  try {
    const { purpose, corrections, analysis, imageBase64, mimeType } = await req.json()
    const userPrompt = buildUserPrompt(purpose, corrections, analysis)

    let parsed = null

    // 이미지가 있으면 비전 모델로 직접 보고 피드백
    if (imageBase64 && mimeType) {
      for (const model of ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']) {
        try {
          const completion = await groq.chat.completions.create({
            model,
            max_tokens: 1200,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                  { type: 'text', text: userPrompt },
                ],
              },
            ],
          })
          parsed = parseJsonSafe(completion.choices[0].message.content || '')
          if (parsed) break
        } catch (e) {
          console.error(`Vision feedback model ${model} failed:`, e)
        }
      }
    }

    // 비전 실패 시 텍스트 모델 폴백
    if (!parsed) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })
      parsed = parseJsonSafe(completion.choices[0].message.content || '')
    }

    if (!parsed) throw new Error('No valid JSON in response')

    if (HANJA_REGEX.test(JSON.stringify(parsed))) {
      await fixParsedHanja(groq, parsed)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json({
      score: 70,
      correction_summary: '기본 보정이 적용되었습니다.',
      good_points: ['사진이 업로드되었습니다', '보정이 완료되었습니다', '다운로드 가능합니다'],
      improvements: [{ title: '조명 개선', problem: '조명이 불균일합니다', solution: '자연광을 활용해보세요' }],
      next_shot_tip: '다음에는 더 밝은 환경에서 촬영해보세요.',
    })
  }
}
