import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ configured: false })
  const accountId = session.user.accountId
  if (!accountId) return NextResponse.json({ configured: false })

  const integration = await prisma.accountIntegration.findFirst({
    where: { accountId, platform: 'servicem8', enabled: true },
    select: { config: true },
  })

  if (!integration) return NextResponse.json({ configured: false })

  try {
    const cfg = JSON.parse(integration.config) as Record<string, string>
    return NextResponse.json({ configured: !!cfg.apiKey })
  } catch {
    return NextResponse.json({ configured: false })
  }
}
