import { prisma } from './prisma'
import type { SmtpConfig } from './email'
import { getSmtpDefaults } from './platform-defaults'

function formatFromHeader(name: string, address: string): string {
  const safeName = name.replace(/"/g, "'").trim() || 'Simple CRM'
  return `"${safeName}" <${address}>`
}

/**
 * Fixed system identity for platform-level transactional email — login
 * links, password resets, user invites. Always sends via the system
 * provider (Resend) as "Simple CRM", regardless of any account's own SMTP
 * setup, so this branding stays consistent no matter which account (or no
 * account at all, e.g. master_admin) the recipient belongs to.
 */
export function getAdminSmtp(): SmtpConfig {
  const d = getSmtpDefaults()
  return { ...d, from: formatFromHeader('Simple CRM', d.from || d.user) }
}

type SavedAccountSmtp = Partial<SmtpConfig> & { fromName?: string }

/**
 * Account-branded email (campaigns, automations) — sent as if from that
 * specific business, not the platform. Uses the account's own SMTP server
 * and display name when fully configured (host+user+pass all set);
 * otherwise falls back to the system provider (Resend) with the account's
 * name as the display name. Never mixes the two (e.g. system "from"
 * address sent through a third-party SMTP server), which most providers
 * reject as spoofing.
 */
export async function getAccountSmtp(accountId: string): Promise<SmtpConfig> {
  const [account, smtpRow] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    prisma.accountIntegration.findUnique({
      where: { accountId_platform: { accountId, platform: 'email_smtp' } },
    }),
  ])
  const accountName = account?.name ?? 'Simple CRM'

  let saved: SavedAccountSmtp | null = null
  if (smtpRow?.enabled) {
    try { saved = JSON.parse(smtpRow.config) as SavedAccountSmtp } catch { saved = null }
  }

  const isCustom = !!(saved?.host && saved?.user && saved?.pass)
  if (isCustom) {
    const address = saved!.from || saved!.user!
    return {
      host: saved!.host!,
      port: saved!.port || '587',
      user: saved!.user!,
      pass: saved!.pass!,
      from: formatFromHeader(saved!.fromName || accountName, address),
    }
  }

  const d = getSmtpDefaults()
  return { ...d, from: formatFromHeader(accountName, d.from || d.user) }
}
