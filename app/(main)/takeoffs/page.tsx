import { Ruler } from 'lucide-react'

export default function TakeoffsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Takeoffs & Estimating</h1>
        <p className="text-slate-500 text-sm mt-1">Create detailed takeoffs and cost estimates for your projects</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
          <Ruler className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Takeoffs & Estimating</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          This module is coming soon. You'll be able to create detailed material takeoffs, labour estimates, and professional quotes directly from your projects.
        </p>
      </div>
    </div>
  )
}
