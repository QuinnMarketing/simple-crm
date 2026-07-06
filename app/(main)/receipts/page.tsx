import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ReceiptEmailSection from '../settings/ReceiptEmailSection'
import PendingReceiptsSection from '../settings/PendingReceiptsSection'

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { account: accountParam } = await searchParams

  let accountId: string | null = null

  if (session.user.role === 'master_admin') {
    accountId = accountParam ?? null
    if (!accountId) {
      return (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Receipts</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <p className="text-amber-900 font-medium">No account selected</p>
            <p className="text-amber-700 text-sm mt-1">
              Select an account from the sidebar to view receipts.
            </p>
          </div>
        </div>
      )
    }
  } else {
    accountId = session.user.accountId
    if (!accountId) {
      return (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Receipts</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800">Your account is not configured. Contact your administrator.</p>
          </div>
        </div>
      )
    }
  }

  const projects = await prisma.ganttProject.findMany({
    where: { accountId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Receipts</h1>
        <p className="text-slate-500 mt-1 text-sm">Email receipts for automatic processing and project assignment</p>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <ReceiptEmailSection />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <PendingReceiptsSection projects={projects} />
        </div>
      </div>
    </div>
  )
}
