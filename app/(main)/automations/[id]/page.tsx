import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAccountFilter } from '@/lib/account-scope'
import { redirect } from 'next/navigation'
import AutomationBuilder from '../AutomationBuilder'
import type { AutomationDefinition, TriggerType } from '@/lib/automation-types'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ account?: string }>
}

function migrateLegacy(trigger: string, triggerConfig: string, actionConfig: string): AutomationDefinition | undefined {
  if (!trigger) return undefined
  let tc: Record<string, unknown> = {}
  let ac: Record<string, unknown> = {}
  try { tc = JSON.parse(triggerConfig) } catch {}
  try { ac = JSON.parse(actionConfig) } catch {}

  const triggerMap: Record<string, TriggerType> = {
    lead_created: 'lead_created',
    lead_status_changed: 'lead_status_changed',
    pending_quote_followup: 'pending_quote',
    idle_deal: 'idle_lead',
    appointment_booked: 'appointment_created',
    appointment_reminder: 'appointment_reminder',
  }

  const triggerType: TriggerType = triggerMap[trigger] ?? 'lead_created'
  const config =
    trigger === 'lead_status_changed' ? { toStatus: tc.toStatus as string } :
    trigger === 'pending_quote_followup' ? { days: (tc.days as number) ?? 3 } :
    trigger === 'idle_deal' ? { days: (tc.days as number) ?? 7, statuses: ['new', 'contacted', 'qualified'] } :
    trigger === 'appointment_reminder' ? { hoursBeforeAppointment: 24 } :
    {}

  const steps: AutomationDefinition['steps'] = ac.subject ? [{
    id: 's1',
    type: 'action' as const,
    actionType: 'send_email' as const,
    config: { to: '{{email}}', subject: (ac.subject as string) ?? '', body: (ac.body as string) ?? '' },
  }] : []

  return { trigger: { triggerType, config }, steps }
}

export default async function EditAutomationPage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const { account: qAccountId } = await searchParams
  const filter = getAccountFilter(session.user, qAccountId)

  const automation = await prisma.automation.findFirst({ where: { id, ...filter } })
  if (!automation) redirect('/automations')

  let initialDef: AutomationDefinition | undefined
  if (automation.steps !== '{}') {
    try { initialDef = JSON.parse(automation.steps) } catch {}
  } else if (automation.trigger) {
    initialDef = migrateLegacy(automation.trigger, automation.triggerConfig, automation.actionConfig)
  }

  return (
    <AutomationBuilder
      automationId={id}
      initialName={automation.name}
      initialDescription={automation.description ?? ''}
      initialEnabled={automation.enabled}
      initialAllowRepeat={automation.allowRepeat}
      initialDef={initialDef}
    />
  )
}
