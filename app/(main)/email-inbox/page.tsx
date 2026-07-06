import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import EmailInboxSection from './EmailInboxSection'

export default async function EmailInboxPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Email Inbox</h1>
        <p className="text-slate-500 mt-1 text-sm">Emails synced from Gmail/Outlook that don't match an existing lead</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <EmailInboxSection />
      </div>
    </div>
  )
}
