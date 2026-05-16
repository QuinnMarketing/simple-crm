import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import CalendarView from './CalendarView'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}) {
  const session = await auth()
  const { account: accountParam } = await searchParams

  const rawFilter = getAccountFilter(session!.user, accountParam)
  // Only use a single string accountId — { in: [...] } means no specific account selected
  const accountId: string | null = typeof rawFilter.accountId === 'string' ? rawFilter.accountId : null

  const gcalConnected = accountId
    ? !!(await prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId, platform: 'google_calendar' } },
        select: { enabled: true, config: true },
      }).then((r) => {
        if (!r || !r.enabled) return false
        try { return !!JSON.parse(r.config).refreshToken } catch { return false }
      }))
    : false

  return <CalendarView gcalConnected={gcalConnected} accountId={accountId} />
}
