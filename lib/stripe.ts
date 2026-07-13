import Stripe from 'stripe'
import { prisma } from './prisma'

// Pin the API version to the one this SDK release ships with, so upgrading the
// stripe package never silently changes request/response shapes underneath us.
export const STRIPE_API_VERSION = '2026-06-24.dahlia'

export interface StripeAccountConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}

/**
 * Reads the raw Stripe config for an account from the generic AccountIntegration
 * store (platform 'stripe'). Returns null when Stripe is not configured/enabled.
 * Missing individual fields come back as empty strings.
 */
export async function getAccountStripeConfig(accountId: string): Promise<StripeAccountConfig | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'stripe' } },
  })
  if (!row?.enabled) return null
  try {
    const cfg = JSON.parse(row.config) as Partial<StripeAccountConfig>
    if (!cfg.secretKey) return null
    return {
      secretKey: cfg.secretKey,
      publishableKey: cfg.publishableKey ?? '',
      webhookSecret: cfg.webhookSecret ?? '',
    }
  } catch {
    return null
  }
}

/** True when the account has a usable Stripe secret key configured. */
export async function isStripeConfigured(accountId: string): Promise<boolean> {
  return (await getAccountStripeConfig(accountId)) !== null
}

/**
 * Returns a Stripe client configured with the account's own secret key. Each
 * business collects payments into their own Stripe account, so we never share
 * a platform key. Throws a clear Error when the account has not connected Stripe.
 */
export async function getAccountStripe(accountId: string): Promise<Stripe> {
  const cfg = await getAccountStripeConfig(accountId)
  if (!cfg) throw new Error('Stripe is not configured for this account')
  return new Stripe(cfg.secretKey, { apiVersion: STRIPE_API_VERSION })
}
