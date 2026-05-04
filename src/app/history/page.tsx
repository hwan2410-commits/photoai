'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PhotoEdit } from '@/types'
import ScoreCircle from '@/components/ScoreCircle'
import Navbar from '@/components/Navbar'
import { PURPOSES } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function HistoryPage() {
  const [edits, setEdits] = useState<PhotoEdit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('photo_edits')
        .select('*')
        .order('created_at', { ascending: false })
      setEdits(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    await fetch('/api/delete-edit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setEdits(prev => prev.filter(edit => edit.id !== id))
  }

  const purposeLabel = (value: string) =>
    PURPOSES.find(p => p.value === value)?.label || value

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">보정 히스토리</h1>

        {edits.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-gray-500 mb-4">아직 보정한 사진이 없습니다</p>
            <Link href="/" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700">
              첫 사진 보정하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {edits.map((edit) => (
              <div key={edit.id} className="relative">
                <Link href={`/result/${edit.id}`}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="grid grid-cols-2 h-40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={edit.original_url} alt="원본" className="w-full h-full object-cover" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={edit.edited_url || edit.original_url} alt="보정 후" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            {purposeLabel(edit.purpose)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(edit.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      {edit.score !== null && (
                        <ScoreCircle score={edit.score} size={60} />
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => handleDelete(e, edit.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg hover:bg-red-600 shadow"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
