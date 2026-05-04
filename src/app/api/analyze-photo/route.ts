import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, purpose } = await req.json()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const purposeMap: Record<string, string> = {
      product: '제품사진',
      food: '음식 사진',
      portrait: '인물 사진',
      space: '공간/인테리어 사진',
      landscape: '풍경 사진',
    }

    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      `이 사진을 분석하고 최적의 보정 수치를 JSON으로만 반환해주세요. 설명 없이 JSON만 출력하세요.
촬영 목적: ${purposeMap[purpose] || purpose}

{
  "brightness": -50에서 50 사이 정수,
  "contrast": -50에서 50 사이 정수,
  "saturation": -50에서 50 사이 정수,
  "warmth": -50에서 50 사이 정수,
  "sharpness": 0에서 100 사이 정수,
  "analysis": {
    "composition": "구도 분석 한 문장",
    "lighting": "조명 분석 한 문장",
    "background": "배경 분석 한 문장",
    "color": "색감 분석 한 문장"
  }
}`
    ])

    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const fixed = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    )
    const parsed = JSON.parse(fixed)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Gemini error:', error)
    return NextResponse.json({
      brightness: 10, contrast: 5, saturation: 10, warmth: 5, sharpness: 30,
      analysis: { composition: '분석 실패', lighting: '분석 실패', background: '분석 실패', color: '분석 실패' }
    })
  }
}
