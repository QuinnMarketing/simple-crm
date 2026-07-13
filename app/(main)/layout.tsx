import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SidebarShell from '@/components/SidebarShell'
import { getEnabledModules } from '@/lib/account-modules'
import { DEFAULT_ON_KEYS } from '@/lib/modules'
import TrialBanner from '@/components/TrialBanner'
import type { TrialAccount } from '@/lib/trial'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  let accountName: string | null = null
  let accounts: { id: string; name: string }[] = []
  let enabledModules: string[] = DEFAULT_ON_KEYS
  let trialAccount: TrialAccount | null = null

  if (session.user.role === 'master_admin') {
    accounts = await prisma.account.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    enabledModules = [...(await getEnabledModules(session.user, null))] // master sees all
  } else {
    const userAccountIds = session.user.accountIds ?? (session.user.accountId ? [session.user.accountId] : [])
    if (userAccountIds.length > 1) {
      accounts = await prisma.account.findMany({
        where: { id: { in: userAccountIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    } else if (session.user.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: session.user.accountId },
        select: { name: true },
      })
      accountName = account?.name ?? null
    }
    enabledModules = [...(await getEnabledModules(session.user, session.user.accountId ?? null))]

    // Trial banner state for the user's primary account (single-account users).
    if (session.user.accountId) {
      trialAccount = await prisma.account.findUnique({
        where: { id: session.user.accountId },
        select: { subscriptionStatus: true, trialEndsAt: true },
      })
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarShell user={session.user} accountName={accountName} accounts={accounts} enabledModules={enabledModules} />
      <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
        {trialAccount && <TrialBanner account={trialAccount} />}
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
