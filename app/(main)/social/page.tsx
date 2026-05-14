import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import SocialPage from './SocialPage'

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    }>
      <SocialPage />
    </Suspense>
  )
}
