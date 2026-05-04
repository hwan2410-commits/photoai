import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PhotoEdit } from '@/types'
import ScoreCircle from '@/components/ScoreCircle'
import Navbar from '@/components/Navbar'

async function getEdit(id: string): Promise<PhotoEdit | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data } = await supabase.from('photo_edits').select('*').eq('id', id).single()
  return data
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const edit = await getEdit(id)
  if (!edit) notFound()

  const feedback = edit.groq_feedback
  const analysis = edit.gemini_analysis

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">보정 결과</h1>
          <Link href="/history" className="text-sm text-indigo-600 hover:underline">히스토리 보기</Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-2 text-center">원본</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={edit.original_url} alt="원본" className="w-full rounded-xl object-cover" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2 text-center">보정 후</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={edit.edited_url || edit.original_url} alt="보정 후" className="w-full rounded-xl object-cover" />
          </div>
        </div>

        {feedback && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-6 mb-6">
              <ScoreCircle score={feedback.score} />
              <div>
                <p className="text-lg font-bold text-gray-900">종합 점수</p>
                <p className="text-sm text-gray-600 mt-1">{feedback.correction_summary}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-green-700 mb-2">잘된 점</p>
                <ul className="space-y-1">
                  {feedback.good_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>

              {feedback.improvements.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-orange-700 mb-2">개선할 점</p>
                  <div className="space-y-2">
                    {feedback.improvements.map((imp, i) => (
                      <div key={i} className="bg-orange-50 rounded-xl p-3">
                        <p className="font-medium text-sm text-orange-800">{imp.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{imp.problem}</p>
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
          <Link
            href="/"
            className="flex-1 text-center bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700"
          >
            새 사진 보정하기
          </Link>
          {edit.edited_url && (
            <a
              href={edit.edited_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center bg-gray-800 text-white rounded-xl py-3 font-medium hover:bg-gray-900"
            >
              다운로드
            </a>
          )}
        </div>
      </main>
    </div>
  )
}
