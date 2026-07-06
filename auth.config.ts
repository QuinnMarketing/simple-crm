import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname

      if (path.startsWith('/api/webhooks')) return true
      if (path.startsWith('/api/calendar/callback')) return true
      // System + public-facing endpoints: cron runner, email tracking pixels,
      // unsubscribe links, quote accept/decline links, inbound receipt emails.
      // Each does its own auth (cron secret, tokens) — login sessions don't apply.
      if (path.startsWith('/api/cron')) return true
      if (path.startsWith('/api/track')) return true
      if (path.startsWith('/api/unsubscribe')) return true
      if (/^\/api\/quotes\/[^/]+\/respond/.test(path)) return true
      if (path.startsWith('/api/receipts/email')) return true
      if (path.startsWith('/api/auth/forgot-password')) return true
      if (path.startsWith('/api/auth/reset-password')) return true
      if (path.startsWith('/api/auth/magic-link')) return true
      if (path === '/magic-link') return true
      if (path.startsWith('/api/book')) return true
      if (path.startsWith('/api/review')) return true
      if (path === '/forgot-password') return true
      if (path.startsWith('/reset-password')) return true
      if (path.startsWith('/book')) return true
      if (path.startsWith('/review')) return true
      if (path.startsWith('/lp')) return true // public landing pages (drafts gate themselves via auth() in the page)
      if (path === '/login') {
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl))
        return true
      }
      if (!isLoggedIn) return false

      // /accounts is master_admin only
      if (path.startsWith('/accounts')) {
        return auth?.user?.role === 'master_admin'
      }

      return true
    },
    // Must live here (edge-compatible) so middleware can read custom session fields
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.accountId = (token.accountId ?? null) as string | null
      session.user.accountIds = (token.accountIds ?? (token.accountId ? [token.accountId as string] : [])) as string[]
      session.user.role = (token.role ?? 'account_user') as string
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
