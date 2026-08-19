import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { runAutomations } from '@/lib/automations'
import { sendPushToAccount } from '@/lib/push'
import { appendLeadToSheet } from '@/lib/google-sheets'
import { syncLeadToTrackingSheet } from '@/lib/lead-tracking-sheet'
import { fetchLeadData } from '@/lib/meta-leads'
import { after } from 'next/server'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function fieldValue(fieldData: { name?: string; values?: string[] }[], ...names: string[]): string | null {
  for (const n of names) {
    const f = fieldData.find((x) => (x.name ?? '').toLowerCase() === n)
    const v = f?.values?.[0]?.trim()
    if (v) return v
  }
  return null
}

export type IngestResult = 'created' | 'duplicate' | 'error'

// Fetch one Instant Form lead (System User token) and create a CRM lead in the
// mapped account, with the same after-effects as every other lead source.
// Shared by the live webhook and the manual backfill so behaviour is identical.
export async function ingestMetaLead(
  accountId: string,
  opts: { leadgenId: string; pageId: string; formId?: string },
): Promise<IngestResult> {
  const { leadgenId, pageId } = opts
  if (!leadgenId) return 'error'

  // Idempotency — skip if we've already ingested this leadgen_id for the account.
  const existing = await prisma.lead.findFirst({
    where: { accountId, formData: { contains: leadgenId } },
    select: { id: true },
  })
  if (existing) return 'duplicate'

  const r = await fetchLeadData(leadgenId)
  if (!r.data) return 'error'
  const data = r.data

  const fieldData: { name?: string; values?: string[] }[] = Array.isArray(data.field_data)
    ? (data.field_data as { name?: string; values?: string[] }[])
    : []
  const campaignName = str(data.campaign_name)
  const adName = str(data.ad_name)

  const first = fieldValue(fieldData, 'first_name')
  const last = fieldValue(fieldData, 'last_name')
  const name =
    fieldValue(fieldData, 'full_name', 'name') ||
    [first, last].filter(Boolean).join(' ').trim() ||
    'Facebook Lead'
  const email = fieldValue(fieldData, 'email')
  const phone = fieldValue(fieldData, 'phone_number', 'phone', 'work_phone_number')

  const answers: Record<string, string> = {}
  for (const f of fieldData) if (f.name) answers[f.name] = (f.values ?? []).join(', ')
  const formPayload = {
    ...answers,
    _leadgenId: leadgenId,
    _pageId: pageId,
    _formId: opts.formId ?? str(data.form_id),
    _adId: str(data.ad_id),
    _campaign: campaignName,
  }

  const extra = fieldData
    .filter((f) => !['full_name', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'].includes((f.name ?? '').toLowerCase()))
    .map((f) => `${f.name}: ${(f.values ?? []).join(', ')}`)
  const notesParts = [
    campaignName ? `Campaign: ${campaignName}` : '',
    adName ? `Ad: ${adName}` : '',
    ...extra,
  ].filter(Boolean)

  const lead = await prisma.lead.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      source: 'facebook',
      status: 'new',
      service: fieldValue(fieldData, 'service', 'what_service_are_you_interested_in') ?? null,
      notes: notesParts.length ? notesParts.join('\n') : 'Meta Instant Form lead',
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: campaignName || null,
      formData: JSON.stringify(formPayload),
      accountId,
    },
  })

  after(() => appendLeadToSheet(lead))
  after(() => syncLeadToTrackingSheet(accountId, lead))
  after(() => runAutomations('lead_created', lead))
  after(() => logAudit({ accountId, action: 'lead.created', entityType: 'lead', entityId: lead.id, entityLabel: lead.name }))
  after(() => sendPushToAccount(accountId, {
    title: `New Lead: ${lead.name}`,
    body: [lead.service, 'Facebook Instant Form'].filter(Boolean).join(' · '),
    url: `/leads/${lead.id}`,
  }))

  return 'created'
}
