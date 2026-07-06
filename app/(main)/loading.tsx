import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  )
}
