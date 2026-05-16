import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { userAccounts: { select: { accountId: true } } },
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null

        const extraIds = user.userAccounts.map(ua => ua.accountId)
        const allIds = Array.from(new Set([...(user.accountId ? [user.accountId] : []), ...extraIds]))

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          accountId: user.accountId,
          accountIds: allIds,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accountId = (user as { accountId?: string | null }).accountId ?? null
        token.accountIds = (user as { accountIds?: string[] }).accountIds ?? (token.accountId ? [token.accountId as string] : [])
        token.role = (user as { role?: string }).role ?? 'account_user'
      }
      // Backfill missing fields for stale tokens created before schema changes
      if (!token.role && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, accountId: true, userAccounts: { select: { accountId: true } } },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.accountId = dbUser.accountId ?? null
          const extraIds = dbUser.userAccounts.map(ua => ua.accountId)
          token.accountIds = Array.from(new Set([...(dbUser.accountId ? [dbUser.accountId] : []), ...extraIds]))
        }
      }
      return token
    },
  },
})
