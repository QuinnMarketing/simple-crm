import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/social-publish'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const due = await prisma.socialPost.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })

  const results = await Promise.allSettled(due.map(p => publishPost(p.id)))
  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length

  return NextResponse.json({ processed: due.length, succeeded })
}
