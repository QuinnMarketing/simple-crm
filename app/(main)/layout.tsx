import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SidebarShell from '@/components/SidebarShell'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  let accountName: string | null = null
  let accounts: { id: string; name: string }[] = []
  let featTakeoffs = false

  if (session.user.role === 'master_admin') {
    accounts = await prisma.account.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    featTakeoffs = true // master admin sees everything
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
        select: { name: true, featTakeoffs: true },
      })
      accountName = account?.name ?? null
      featTakeoffs = account?.featTakeoffs ?? false
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarShell user={session.user} accountName={accountName} accounts={accounts} featTakeoffs={featTakeoffs} />
      <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
