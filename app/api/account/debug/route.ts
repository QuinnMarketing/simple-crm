import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()

  return NextResponse.json({
    hasSession: !!session,
    user: session?.user ? {
      id: session.user.id,
      email: session.user.email,
      accountId: session.user.accountId,
      accountIds: session.user.accountIds,
      role: session.user.role,
    } : null,
  })
}
