import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CampaignEditor from '../CampaignEditor'

export default function NewCampaignPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/campaigns" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New Campaign</h1>
        <p className="text-slate-500 text-sm mt-1">Compose an email and choose who receives it</p>
      </div>
      <CampaignEditor />
    </div>
  )
}
