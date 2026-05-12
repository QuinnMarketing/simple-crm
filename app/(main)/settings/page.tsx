import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import IntegrationsForm from './IntegrationsForm'
import CopyButton from './CopyButton'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; gcal?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { account: accountParam, gcal } = await searchParams

  let accountId: string | null = null

  if (session.user.role === 'master_admin') {
    accountId = accountParam ?? null
    if (!accountId) {
      return (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <p className="text-amber-900 font-medium">No account selected</p>
            <p className="text-amber-700 text-sm mt-1">
              Select an account from the sidebar to view and edit its settings, or go to{' '}
              <a href="/accounts" className="font-medium underline">Accounts</a> to manage client accounts.
            </p>
          </div>
        </div>
      )
    }
  } else {
    accountId = session.user.accountId
    if (!accountId) {
      return (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800">Your account is not configured. Contact your administrator.</p>
          </div>
        </div>
      )
    }
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { integrations: true },
  })

  if (!account) redirect('/accounts')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/webhooks/form?token=${account.webhookToken}`

  const integrationConfigs: Record<string, Record<string, string>> = {}
  for (const integration of account.integrations) {
    try {
      integrationConfigs[integration.platform] = JSON.parse(integration.config)
    } catch {
      integrationConfigs[integration.platform] = {}
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">{account.name} — integrations and webhook</p>
      </div>

      {gcal === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Google Calendar connected successfully.
        </div>
      )}
      {gcal === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Google Calendar connection failed. Check your credentials and try again.
        </div>
      )}

      <div className="space-y-6">
        {/* Webhook */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Webhook Endpoint</h2>
          <p className="text-slate-500 text-sm mb-4">
            POST form submissions to this URL. The token authenticates this account automatically —
            no additional headers required.
          </p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <code className="text-sm font-mono text-slate-700 flex-1 break-all">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-900 mb-2">Elementor</p>
              <p className="text-slate-500 text-xs">Edit form → Actions After Submit → Add Action → Webhook → paste URL. Requires Elementor Pro.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-900 mb-2">Typeform</p>
              <p className="text-slate-500 text-xs">Connect → Webhooks → Add webhook URL above.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-900 mb-2">JotForm</p>
              <p className="text-slate-500 text-xs">Settings → Integrations → Webhooks → paste URL.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-900 mb-2">Gravity Forms</p>
              <p className="text-slate-500 text-xs">Form Settings → Webhooks → Add New → paste URL.</p>
            </div>
          </div>
        </div>

        <IntegrationsForm accountId={accountId} initialConfigs={integrationConfigs} />
      </div>
    </div>
  )
}
