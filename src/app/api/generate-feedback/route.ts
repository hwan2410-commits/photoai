import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const HANJA_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2E80-\u2EFF]/

function hasHanja(obj: unknown): boolean {
  const str = JSON.stringify(obj)
  return HANJA_REGEX.test(str)
}

async function fixHanja(groq: OpenAI, text: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: '당신은 한국어 교정 전문가입니다. 입력된 텍스트에서 한자(漢字)나 중국어 글자를 찾아 문맥에 맞는 자연스러운 한글로 바꿔주세요. 예: 單→단순한, 美→아름다운, 色→색상. 텍스트 구조(JSON 형식 등)는 절대 변경하지 말고 한자만 교체하세요.',
      },
      {
        role: 'user',
        content: `다음 텍스트에서 한자만 한글로 교체해주세요. 다른 내용은 절대 변경하지 마세요:\n\n${text}`,
      },
    ],
  })
  return completion.choices[0].message.content || text
}

export async function POST(req: Request) {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'placeholder',
    baseURL: 'https://api.groq.com/openai/v1',
  })
  try {
    const { purpose, corrections, analysis } = await req.json()

    const purposeMap: Record<string, string> = {
      product: '제품사진',
      food: '음식 사진',
      portrait: '인물 사진',
      space: '공간/인테리어 사진',
      landscape: '풍경 사진',
    }

    const systemPrompt = '당신은 전문 사진작가이자 사진 보정 전문가입니다. 반드시 순수한 한국어(한글)로만 작성하세요. 한자(漢字)나 중국어 글자(예: 單, 美, 色, 簡 등)를 절대 사용하지 마세요. 영어 단어도 사용하지 마세요. 오직 한글과 숫자, 기본 문장부호만 사용하세요.'

    const userPrompt = `사진 분석 결과를 바탕으로 촬영 피드백 리포트를 JSON으로 작성해주세요.

촬영 목적: ${purposeMap[purpose] || purpose}
보정 수치: 밝기 ${corrections.brightness}, 대비 ${corrections.contrast}, 채도 ${corrections.saturation}, 색온도 ${corrections.warmth}, 선명도 ${corrections.sharpness}
AI 분석:
- 구도: ${analysis.composition}
- 조명: ${analysis.lighting}
- 배경: ${analysis.background}
- 색감: ${analysis.color}

다음 JSON 형식으로 반환하세요 (모든 텍스트는 반드시 한글로만):
{
  "score": 0에서 100 사이 정수 (사진 품질 점수),
  "correction_summary": "보정 내용 요약 한 문장",
  "good_points": ["잘된 점 1", "잘된 점 2", "잘된 점 3"],
  "improvements": [
    {
      "title": "개선 제목",
      "problem": "문제점 설명",
      "solution": "해결 방법"
    }
  ],
  "next_shot_tip": "다음 촬영을 위한 핵심 팁 한 문장"
}`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    let text = completion.choices[0].message.content || ''

    // 한자가 있으면 LLM으로 한글 교체 후 재파싱
    if (HANJA_REGEX.test(text)) {
      text = await fixHanja(groq, text)
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const fixed = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    )
    const parsed = JSON.parse(fixed)

    // 교체 후에도 한자가 남아있으면 한 번 더 처리
    if (hasHanja(parsed)) {
      const retryText = await fixHanja(groq, JSON.stringify(parsed))
      const retryMatch = retryText.match(/\{[\s\S]*\}/)
      if (retryMatch) {
        try { return NextResponse.json(JSON.parse(retryMatch[0])) } catch { /* fallthrough */ }
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Groq error:', error)
    return NextResponse.json({
      score: 70,
      correction_summary: '기본 보정이 적용되었습니다.',
      good_points: ['사진이 업로드되었습니다', '보정이 완료되었습니다', '다운로드 가능합니다'],
      improvements: [
        { title: '조명 개선', problem: '조명이 불균일합니다', solution: '자연광을 활용해보세요' },
      ],
      next_shot_tip: '다음에는 더 밝은 환경에서 촬영해보세요.',
    })
  }
}
