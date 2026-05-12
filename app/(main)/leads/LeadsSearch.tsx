'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { useCallback, useTransition } from 'react'

export default function LeadsSearch({ defaultQ }: { defaultQ?: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(sp.toString())
      if (e.target.value) params.set('q', e.target.value)
      else params.delete('q')
      startTransition(() => router.push(`/leads?${params.toString()}`))
    },
    [router, sp]
  )

  return (
    <div className="relative flex-1 min-w-48 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="search"
        defaultValue={defaultQ}
        onChange={handleChange}
        placeholder="Search name, email, phone…"
        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
      />
    </div>
  )
}
