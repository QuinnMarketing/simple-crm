import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { pushToGA4, type GA4Config } from '@/lib/google-ga4'
import { pushToGoogleAds, type GoogleAdsConfig } from '@/lib/google-ads'
import { pushToFacebook, type FacebookConfig } from '@/lib/facebook'
import { getAccountFilter } from '@/lib/account-scope'
import { NextRequest, NextResponse } from 'next/server'

async function getIntegrationConfig(accountId: string | null, platform: string) {
  if (!accountId) return null
  const integration = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform } },
  })
  if (!integration?.enabled) return null
  try { return JSON.parse(integration.config) } catch { return null }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { platform } = await req.json()

  const filter = getAccountFilter(session.user)
  const lead = await prisma.lead.findFirst({ where: { id, ...filter } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const accountId = lead.accountId ?? session.user.accountId ?? null
  const config = await getIntegrationConfig(accountId, platform)

  let result: { success: boolean; error?: string }

  if (platform === 'google_ga4') {
    result = await pushToGA4(
      { name: lead.name, email: lead.email, phone: lead.phone, gclid: lead.gclid, value: lead.value, source: lead.source },
      config as GA4Config | undefined
    )
  } else if (platform === 'google_ads') {
    result = await pushToGoogleAds(
      { gclid: lead.gclid, value: lead.value, createdAt: lead.createdAt },
      config as GoogleAdsConfig | undefined
    )
  } else if (platform === 'facebook') {
    result = await pushToFacebook(
      {
        name: lead.name, email: lead.email, phone: lead.phone,
        fbclid: lead.fbclid, fbp: lead.fbp, fbc: lead.fbc,
        ipAddress: lead.ipAddress, userAgent: lead.userAgent, pageUrl: lead.pageUrl,
        value: lead.value, createdAt: lead.createdAt,
      },
      config as FacebookConfig | undefined
    )
  } else {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  await prisma.conversionEvent.create({
    data: {
      leadId: id,
      platform,
      eventName: platform === 'facebook' ? 'Lead' : 'generate_lead',
      value: lead.value,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      response: JSON.stringify(result),
    },
  })

  return NextResponse.json(result)
}
