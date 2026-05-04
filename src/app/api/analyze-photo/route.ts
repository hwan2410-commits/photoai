import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'placeholder',
    baseURL: 'https://api.groq.com/openai/v1',
  })

  try {
    const { imageBase64, mimeType, purpose } = await req.json()

    const purposeMap: Record<string, string> = {
      product: '제품사진',
      food: '음식 사진',
      portrait: '인물 사진',
      space: '공간/인테리어 사진',
      landscape: '풍경 사진',
    }

    const prompt = `촬영 목적: ${purposeMap[purpose] || purpose}

이 사진을 분석하고 아래 JSON 형식으로만 답해주세요. 다른 설명은 하지 마세요.

{
  "brightness": (정수, -50~50),
  "contrast": (정수, -50~50),
  "saturation": (정수, -50~50),
  "warmth": (정수, -50~50),
  "sharpness": (정수, 0~100),
  "analysis": {
    "composition": "구도 설명",
    "lighting": "조명 설명",
    "background": "배경 설명",
    "color": "색감 설명"
  }
}`

    const visionModels = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
    let text = ''

    for (const model of visionModels) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        })
        text = completion.choices[0].message.content || ''
        if (text) break
      } catch (e) {
        console.error(`Model ${model} failed:`, e)
        continue
      }
    }

    if (!text) throw new Error('All vision models failed')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const fixed = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    )
    const parsed = JSON.parse(fixed)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      brightness: 10, contrast: 5, saturation: 10, warmth: 5, sharpness: 30,
      analysis: { composition: '분석 실패', lighting: '분석 실패', background: '분석 실패', color: '분석 실패' }
    })
  }
}
