import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s')
  const url = req.nextUrl.searchParams.get('u')

  if (sendId) {
    prisma.emailCampaignSend
      .updateMany({ where: { id: sendId, clickedAt: null }, data: { clickedAt: new Date() } })
      .catch(() => {})
  }

  const destination = url ? decodeURIComponent(url) : '/'
  return NextResponse.redirect(destination, { status: 302 })
}
