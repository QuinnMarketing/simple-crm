import { prisma } from './prisma'
import { listRecentInboxMessages as listGmail } from './gmail'
import { listRecentInboxMessages as listOutlook } from './outlook'
import type { NormalizedMessage } from './gmail'
import { sendPushToAccount } from './push'

const DEFAULT_LOOKBACK_MS = 48 * 3_600_000 // 48h if this is the first sync (no cursor yet)

type EmailProvider = 'gmail' | 'outlook'

async function storeMessages(provider: EmailProvider, accountId: string, messages: NormalizedMessage[]) {
  let synced = 0
  let matched = 0

  for (const msg of messages) {
    const existing = await prisma.syncedEmail.findUnique({
      where: { provider_externalId: { provider, externalId: msg.externalId } },
      select: { id: true },
    })
    if (existing) continue // already synced on a previous, overlapping poll

    const lead = await prisma.lead.findFirst({
      where: { accountId, email: { equals: msg.fromEmail, mode: 'insensitive' } },
      select: { id: true },
    })

    await prisma.syncedEmail.create({
      data: {
        provider,
        externalId: msg.externalId,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName ?? null,
        toEmail: msg.toEmail ?? null,
        subject: msg.subject ?? null,
        snippet: msg.snippet,
        sentAt: msg.sentAt,
        leadId: lead?.id ?? null,
        accountId,
      },
    })
    synced++
    if (lead) matched++
  }

  return { synced, matched }
}

/**
 * Polls every connected Gmail/Outlook account for new inbox messages since
 * its last sync, matches senders to existing leads by email, and stores
 * everything as SyncedEmail (matched messages show on the lead's timeline;
 * unmatched ones surface in /email-inbox for manual "create lead" action).
 * Runs from the existing cron — no webhooks/push subscriptions to renew.
 */
export async function syncAllEmailAccounts(): Promise<{ synced: number; matched: number; errors: number }> {
  let totalSynced = 0
  let totalMatched = 0
  let errors = 0

  const integrations = await prisma.accountIntegration.findMany({
    where: { platform: { in: ['gmail', 'outlook'] }, enabled: true },
  })

  for (const integration of integrations) {
    if (!integration.accountId) continue

    let config: { refreshToken?: string; lastSyncedAt?: string }
    try {
      config = JSON.parse(integration.config)
    } catch {
      continue
    }
    if (!config.refreshToken) continue

    const since = config.lastSyncedAt ? new Date(config.lastSyncedAt) : new Date(Date.now() - DEFAULT_LOOKBACK_MS)
    const now = new Date()
    const provider = integration.platform as EmailProvider

    try {
      const messages = provider === 'gmail'
        ? await listGmail({ refreshToken: config.refreshToken }, Math.floor(since.getTime() / 1000))
        : await listOutlook({ refreshToken: config.refreshToken }, since.toISOString())

      const result = await storeMessages(provider, integration.accountId, messages)
      totalSynced += result.synced
      totalMatched += result.matched

      await prisma.accountIntegration.update({
        where: { id: integration.id },
        data: { config: JSON.stringify({ ...config, lastSyncedAt: now.toISOString() }) },
      })

      const unmatchedCount = result.synced - result.matched
      if (unmatchedCount > 0) {
        await sendPushToAccount(integration.accountId, {
          title: '📧 New email from an unknown sender',
          body: `${unmatchedCount} email${unmatchedCount !== 1 ? 's' : ''} synced with no matching lead`,
          url: '/email-inbox',
        })
      }
    } catch (e) {
      console.error(`Email sync failed for account ${integration.accountId} (${provider}):`, e)
      errors++
    }
  }

  return { synced: totalSynced, matched: totalMatched, errors }
}
