import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import CalendarView from './CalendarView'

export default async function CalendarPage() {
  const session = await auth()
  const accountFilter = getAccountFilter(session!.user)
  const accountId = (accountFilter as { accountId?: string }).accountId ?? null

  const gcalConnected = accountId
    ? !!(await prisma.accountIntegration.findUnique({
        where: { accountId_platform: { accountId, platform: 'google_calendar' } },
        select: { enabled: true, config: true },
      }).then((r) => {
        if (!r || !r.enabled) return false
        try { return !!JSON.parse(r.config).refreshToken } catch { return false }
      }))
    : false

  return <CalendarView gcalConnected={gcalConnected} />
}
