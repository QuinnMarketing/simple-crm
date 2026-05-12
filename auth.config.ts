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
      session.user.role = (token.role ?? 'account_user') as string
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
