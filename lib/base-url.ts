/**
 * Canonical public URL for links that leave the app (emails: magic links,
 * password resets, campaign tracking, quote links). Prefer APP_URL so email
 * links always use the stable domain, never a deployment-specific VERCEL_URL
 * (those are behind Vercel SSO and break for recipients). Uses || not ?? so
 * empty-string env vars fall through.
 */
export function getBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:3000'
  )
}
