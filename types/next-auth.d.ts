import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    accountId?: string | null
    accountIds?: string[]
    role?: string
  }
  interface Session {
    user: {
      id: string
      accountId: string | null
      accountIds: string[]
      role: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    accountId?: string | null
    accountIds?: string[]
    role?: string
  }
}
