import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// 1×1 transparent GIF
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s')
  if (sendId) {
    prisma.emailCampaignSend
      .updateMany({ where: { id: sendId, openedAt: null }, data: { openedAt: new Date() } })
      .catch(() => {})
  }
  return new NextResponse(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
