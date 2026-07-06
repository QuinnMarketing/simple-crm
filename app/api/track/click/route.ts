import { prisma } from '@/lib/prisma'
import { getBaseUrl } from '@/lib/base-url'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s')
  const url = req.nextUrl.searchParams.get('u')

  // NextResponse.redirect requires an absolute URL
  const destination = url ? decodeURIComponent(url) : getBaseUrl()

  if (sendId) {
    try {
      const result = await prisma.emailCampaignSend.updateMany({
        where: { id: sendId, clickedAt: null },
        data: { clickedAt: new Date() },
      })
      if (result.count > 0) {
        const send = await prisma.emailCampaignSend.findUnique({
          where: { id: sendId },
          select: { name: true, email: true, leadId: true, campaign: { select: { id: true, accountId: true, name: true } } },
        })
        if (send?.campaign?.accountId) {
          const { sendPushToAccount } = await import('@/lib/push')
          const who = send.name ?? send.email
          await sendPushToAccount(send.campaign.accountId, {
            title: '🔗 Link Clicked',
            body: `${who} clicked a link in "${send.campaign.name}"`,
            url: send.leadId ? `/leads/${send.leadId}` : `/campaigns/${send.campaign.id}`,
          })
        }
      }
    } catch {
      // Swallow — never let tracking errors block the redirect
    }
  }

  return NextResponse.redirect(destination, { status: 302 })
}
