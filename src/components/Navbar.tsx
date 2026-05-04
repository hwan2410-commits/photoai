'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-indigo-600">PhotoAI</Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`text-sm font-medium ${pathname === '/' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            보정하기
          </Link>
          <Link
            href="/history"
            className={`text-sm font-medium ${pathname === '/history' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            히스토리
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  )
}
