import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sendId = req.nextUrl.searchParams.get('s')

  if (sendId) {
    const send = await prisma.emailCampaignSend.findUnique({ where: { id: sendId }, select: { leadId: true } })
    if (send?.leadId) {
      await prisma.lead.update({ where: { id: send.leadId }, data: { unsubscribed: true } })
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
    <style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;}
    .box{text-align:center;padding:48px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;max-width:400px;}
    h1{font-size:24px;color:#1e293b;margin-bottom:8px;}p{color:#64748b;}</style>
    </head><body><div class="box">
    <h1>Unsubscribed</h1>
    <p>You've been removed from this mailing list and won't receive further emails.</p>
    </div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
