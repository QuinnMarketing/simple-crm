import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import * as MetaAds from './meta-ads'
import * as GoogleAdsApi from './google-ads-api'

function sha256(value: string) {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export interface SegmentFilter {
  statuses?: string[]
  sources?: string[]
  leadIds?: string[]
}

export async function buildMemberList(accountId: string, filter: SegmentFilter) {
  const leads = await prisma.lead.findMany({
    where: {
      accountId,
      ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      ...(filter.sources?.length ? { source: { in: filter.sources } } : {}),
      ...(filter.leadIds?.length ? { id: { in: filter.leadIds } } : {}),
    },
    select: { email: true, phone: true, name: true },
  })

  return leads.map(l => ({
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    name: l.name ?? undefined,
    hashedEmail: l.email ? sha256(l.email) : undefined,
    hashedPhone: l.phone ? sha256(l.phone.replace(/\D/g, '')) : undefined,
  }))
}

export async function syncAudienceToMeta(audienceId: string): Promise<void> {
  const audience = await prisma.adAudience.findUnique({
    where: { id: audienceId },
    include: { adPlatformAccount: true },
  })
  if (!audience) throw new Error('Audience not found')
  if (!audience.adPlatformAccount.accessToken) throw new Error('No access token')

  await prisma.adAudience.update({
    where: { id: audienceId },
    data: { status: 'uploading' },
  })

  try {
    const filter: SegmentFilter = JSON.parse(audience.segmentFilter || '{}')
    const members = await buildMemberList(audience.accountId, filter)

    let platformAudienceId = audience.platformAudienceId

    if (!platformAudienceId) {
      platformAudienceId = await MetaAds.createCustomAudience(
        audience.adPlatformAccount.accessToken,
        audience.adPlatformAccount.platformAccountId,
        audience.name,
        audience.description ?? ''
      )
    }

    const count = await MetaAds.uploadAudienceMembers(
      audience.adPlatformAccount.accessToken,
      platformAudienceId,
      members
    )

    await prisma.adAudience.update({
      where: { id: audienceId },
      data: {
        status: 'ready',
        platformAudienceId,
        memberCount: count,
        uploadedAt: new Date(),
        errorMessage: null,
      },
    })
  } catch (e) {
    await prisma.adAudience.update({
      where: { id: audienceId },
      data: { status: 'failed', errorMessage: String(e) },
    })
    throw e
  }
}

export async function syncAudienceToGoogle(audienceId: string): Promise<void> {
  const audience = await prisma.adAudience.findUnique({
    where: { id: audienceId },
    include: { adPlatformAccount: true },
  })
  if (!audience) throw new Error('Audience not found')
  if (!audience.adPlatformAccount.refreshToken) throw new Error('No refresh token')

  await prisma.adAudience.update({ where: { id: audienceId }, data: { status: 'uploading' } })

  try {
    const filter: SegmentFilter = JSON.parse(audience.segmentFilter || '{}')
    const members = await buildMemberList(audience.accountId, filter)
    const hashedMembers: GoogleAdsApi.HashedMember[] = members.map(m => ({
      hashedEmail: m.hashedEmail,
      hashedPhone: m.hashedPhone,
    }))

    const listId = await GoogleAdsApi.createCustomerMatchList(
      audience.adPlatformAccount.refreshToken,
      audience.adPlatformAccount.platformAccountId,
      audience.name,
      hashedMembers,
      audience.adPlatformAccount.developerToken ?? undefined
    )

    await prisma.adAudience.update({
      where: { id: audienceId },
      data: {
        status: 'ready',
        platformAudienceId: listId,
        memberCount: hashedMembers.length,
        uploadedAt: new Date(),
        errorMessage: null,
      },
    })
  } catch (e) {
    await prisma.adAudience.update({
      where: { id: audienceId },
      data: { status: 'failed', errorMessage: String(e) },
    })
    throw e
  }
}
