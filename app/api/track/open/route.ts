import { prisma } from '@/lib/prisma'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

// 1×1 transparent GIF
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s')
  if (sendId) {
    after(async () => {
      const result = await prisma.emailCampaignSend.updateMany({
        where: { id: sendId, openedAt: null },
        data: { openedAt: new Date() },
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
            title: '📧 Email Opened',
            body: `${who} opened "${send.campaign.name}"`,
            url: send.leadId ? `/leads/${send.leadId}` : `/campaigns/${send.campaign.id}`,
          })
        }
      }
    })
  }
  return new NextResponse(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
