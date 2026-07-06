/**
 * Authorizes cron requests. Accepts Vercel's own cron runner (x-vercel-cron
 * header, set at Vercel's edge) or a matching CRON_SECRET passed as
 * ?secret=... or Authorization: Bearer. Denies everything else — including
 * when CRON_SECRET is unset, so the endpoints are never accidentally public.
 */
export function isAuthorizedCron(req: Request): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided =
    new URL(req.url).searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return provided === secret
}
