'use client'
export const dynamic = 'force-dynamic'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ManualSliders from '@/components/ManualSliders'
import ComparisonSlider from '@/components/ComparisonSlider'
import { PURPOSES } from '@/lib/utils'
import { applyCorrections } from '@/lib/imageProcessor'
import { Corrections, GeminiAnalysis, GroqFeedback } from '@/types'

type Step = 'upload' | 'analyzing' | 'result'

const DEFAULT_CORRECTIONS: Corrections = {
  brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpness: 0,
}

export default function HomePage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [purpose, setPurpose] = useState('product')
  const [originalDataUrl, setOriginalDataUrl] = useState('')
  const [editedDataUrl, setEditedDataUrl] = useState('')
  const [imageBase64, setImageBase64] = useState('')
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [corrections, setCorrections] = useState<Corrections>(DEFAULT_CORRECTIONS)
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null)
  const [feedback, setFeedback] = useState<GroqFeedback | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [saving, setSaving] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMimeType('image/jpeg')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        try {
          const MAX = 1200
          let { naturalWidth: w, naturalHeight: h } = img
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX }
            else { w = Math.round(w * MAX / h); h = MAX }
          }
          const c = document.createElement('canvas')
          c.width = w; c.height = h
          const ctx = c.getContext('2d')
          if (!ctx) {
            setOriginalDataUrl(dataUrl)
            setImageBase64(dataUrl.split(',')[1])
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const resized = c.toDataURL('image/jpeg', 0.85)
          setOriginalDataUrl(resized)
          setImageBase64(resized.split(',')[1])
        } catch {
          setOriginalDataUrl(dataUrl)
          setImageBase64(dataUrl.split(',')[1])
        }
      }
      img.onerror = () => {
        setOriginalDataUrl(dataUrl)
        setImageBase64(dataUrl.split(',')[1])
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const applyAndPreview = useCallback(async (corr: Corrections, src: string) => {
    if (!canvasRef.current || !src) return
    try {
      const result = await applyCorrections(canvasRef.current, src, corr)
      setEditedDataUrl(result)
    } catch {
      setEditedDataUrl(src)
    }
  }, [])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSliderChange(corr: Corrections) {
    setCorrections(corr)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      applyAndPreview(corr, originalDataUrl)
    }, 150)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  async function handleAnalyze() {
    if (!imageBase64) return
    setStep('analyzing')
    setStatusMsg('AI가 사진을 분석하는 중...')

    try {
      const geminiRes = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, purpose }),
      })
      const geminiData: GeminiAnalysis = await geminiRes.json()
      setAnalysis(geminiData)

      const corr: Corrections = {
        brightness: geminiData.brightness,
        contrast: geminiData.contrast,
        saturation: geminiData.saturation,
        warmth: geminiData.warmth,
        sharpness: geminiData.sharpness,
      }
      setCorrections(corr)
      await applyAndPreview(corr, originalDataUrl)

      setStatusMsg('피드백 리포트 생성 중...')
      const groqRes = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, corrections: corr, analysis: geminiData.analysis }),
      })
      const groqData: GroqFeedback = await groqRes.json()
      setFeedback(groqData)
      setStep('result')
    } catch (err) {
      console.error(err)
      setStatusMsg('오류가 발생했습니다. 다시 시도해주세요.')
      setStep('upload')
    }
  }


  async function handleSave() {
    if (!feedback || !analysis) return
    setSaving(true)
    try {
      setStatusMsg('업로드 중...')
      const [origUpload, editUpload] = await Promise.all([
        fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType, folder: 'photo-enhancer/originals' }),
        }).then(r => r.json()),
        fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: editedDataUrl.split(',')[1],
            mimeType: 'image/jpeg',
            folder: 'photo-enhancer/edited',
          }),
        }).then(r => r.json()),
      ])

      const saveRes = await fetch('/api/save-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_url: origUpload.url,
          edited_url: editUpload.url,
          purpose,
          corrections,
          gemini_analysis: analysis,
          groq_feedback: feedback,
          score: feedback.score,
        }),
      })
      const saved = await saveRes.json()
      if (saved.id) router.push(`/result/${saved.id}`)
    } catch (err) {
      console.error(err)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  function handleDownload() {
    if (!editedDataUrl) return
    const a = document.createElement('a')
    a.href = editedDataUrl
    a.download = `photoai_${Date.now()}.jpg`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <canvas ref={canvasRef} className="hidden" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">AI 사진 자동 보정</h1>
              <p className="text-gray-500 mt-2">사진을 업로드하면 AI가 최적의 보정을 적용합니다</p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
            >
              {originalDataUrl ? (
                <img src={originalDataUrl} alt="업로드된 사진" className="max-h-64 mx-auto rounded-xl object-contain" />
              ) : (
                <div className="space-y-3">
                  <div className="text-5xl">📷</div>
                  <p className="text-lg font-medium text-gray-700">사진을 클릭하여 업로드</p>
                  <p className="text-sm text-gray-400">JPG, PNG, WEBP 지원</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">촬영 목적</p>
              <div className="flex flex-wrap gap-2">
                {PURPOSES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPurpose(p.value)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      purpose === p.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    <span>{p.emoji}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!originalDataUrl}
              className="w-full bg-indigo-600 text-white rounded-xl py-4 text-lg font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              AI 보정 시작
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg text-gray-700 font-medium">{statusMsg}</p>
          </div>
        )}

        {step === 'result' && editedDataUrl && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">보정 결과</h2>
              <button
                onClick={() => { setStep('upload'); setOriginalDataUrl(''); setEditedDataUrl(''); setFeedback(null); setAnalysis(null); setCorrections(DEFAULT_CORRECTIONS) }}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                새 사진 업로드
              </button>
            </div>

            <ComparisonSlider before={originalDataUrl} after={editedDataUrl} />

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">수동 조정</h3>
              <ManualSliders corrections={corrections} onChange={handleSliderChange} />
            </div>

            {feedback && (
              <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">AI 피드백 리포트</h3>
                  <div className="text-3xl font-bold text-indigo-600">{feedback.score}점</div>
                </div>
                <p className="text-gray-600 text-sm">{feedback.correction_summary}</p>

                <div>
                  <p className="text-sm font-semibold text-green-700 mb-2">잘된 점</p>
                  <ul className="space-y-1">
                    {feedback.good_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>

                {feedback.improvements.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-orange-700 mb-2">개선할 점</p>
                    <div className="space-y-3">
                      {feedback.improvements.map((imp, i) => (
                        <div key={i} className="bg-orange-50 rounded-xl p-3">
                          <p className="font-medium text-sm text-orange-800">{imp.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{imp.problem}</p>
                          <p className="text-xs text-indigo-700 mt-1 font-medium">→ {imp.solution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-800 mb-1">다음 촬영 팁</p>
                  <p className="text-sm text-indigo-700">{feedback.next_shot_tip}</p>
                </div>
              </div>
            )}

            {analysis && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">사진 분석</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '구도', value: analysis.analysis.composition },
                    { label: '조명', value: analysis.analysis.lighting },
                    { label: '배경', value: analysis.analysis.background },
                    { label: '색감', value: analysis.analysis.color },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-sm text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-medium hover:bg-gray-900 transition-colors"
              >
                다운로드
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '저장 & 결과 보기'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
