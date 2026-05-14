import webpush from 'web-push'
import { prisma } from './prisma'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type PushPayload = {
  title: string
  body: string
  url?: string
}

export async function sendPushToAccount(accountId: string | null, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({
    where: accountId ? { accountId } : {},
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Subscription expired — clean it up
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )
}
