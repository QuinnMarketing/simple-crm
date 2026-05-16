import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import IntegrationsForm from './IntegrationsForm'
import CopyButton from './CopyButton'
import DocumentTemplatesSection from './DocumentTemplatesSection'
import BusinessInfoForm from './BusinessInfoForm'
import CustomFieldsSection from './CustomFieldsSection'
import ChangePasswordForm from './ChangePasswordForm'
import BookingSettingsForm from './BookingSettingsForm'
import ReviewSettingsForm from './ReviewSettingsForm'
import Link from 'next/link'
import { UserCog, History } from 'lucide-react'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; gcal?: string; ganalytics?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { account: accountParam, gcal, ganalytics } = await searchParams

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
    include: { integrations: true, bookingSettings: true, reviewSettings: true },
  })

  if (!account) redirect('/accounts')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/webhooks/form?token=${account.webhookToken}`

  const googleAdsDefaults: Record<string, string> = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '',
  }

  const integrationConfigs: Record<string, Record<string, string>> = {}
  for (const integration of account.integrations) {
    try {
      integrationConfigs[integration.platform] = JSON.parse(integration.config)
    } catch {
      integrationConfigs[integration.platform] = {}
    }
  }
  integrationConfigs.google_ads = { ...googleAdsDefaults, ...integrationConfigs.google_ads }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">{account.name}</p>
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
      {ganalytics === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Google Analytics connected. Enter your GA4 Property ID below to start pulling data.
        </div>
      )}
      {ganalytics === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Google Analytics connection failed. Check your credentials and try again.
        </div>
      )}

      <div className="space-y-6">
        {/* 1. Business Information */}
        <BusinessInfoForm
          accountId={accountId}
          initial={{
            abn: account.abn ?? '',
            businessAddress: account.businessAddress ?? '',
            businessPhone: account.businessPhone ?? '',
            businessEmail: account.businessEmail ?? '',
            businessWebsite: account.businessWebsite ?? '',
            slaHours: account.slaHours != null ? String(account.slaHours) : '',
            idleAlertDays: account.idleAlertDays != null ? String(account.idleAlertDays) : '',
          }}
        />

        {/* 2. Users + Audit Log */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href={`/users${accountParam ? `?account=${accountParam}` : ''}`}
            className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
          >
            <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
              <UserCog className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Users</p>
              <p className="text-xs text-slate-500 mt-0.5">Manage team members and roles</p>
            </div>
          </Link>
          <Link
            href={`/audit${accountParam ? `?account=${accountParam}` : ''}`}
            className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
          >
            <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
              <History className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Audit Log</p>
              <p className="text-xs text-slate-500 mt-0.5">Full history of all CRM actions</p>
            </div>
          </Link>
        </div>

        {/* 3. Custom Fields */}
        <CustomFieldsSection accountId={accountId} />

        {/* 4. Document Templates */}
        <DocumentTemplatesSection />

        {/* 5. Booking Widget */}
        <BookingSettingsForm
          accountId={accountId}
          accountSlug={account.slug}
          initial={account.bookingSettings ? {
            enabled: account.bookingSettings.enabled,
            title: account.bookingSettings.title,
            description: account.bookingSettings.description ?? '',
            slotDuration: account.bookingSettings.slotDuration,
            bufferTime: account.bookingSettings.bufferTime,
            timezone: account.bookingSettings.timezone,
            availableHours: account.bookingSettings.availableHours,
            maxDaysAhead: account.bookingSettings.maxDaysAhead,
            minNoticeHours: account.bookingSettings.minNoticeHours,
          } : null}
        />

        {/* 6. Review Widget */}
        <ReviewSettingsForm
          accountId={accountId}
          accountSlug={account.slug}
          initial={account.reviewSettings ? {
            enabled: account.reviewSettings.enabled,
            title: account.reviewSettings.title,
            description: account.reviewSettings.description ?? '',
            autoApprove: account.reviewSettings.autoApprove,
            autoReply: account.reviewSettings.autoReply,
            replyTemplates: account.reviewSettings.replyTemplates,
          } : null}
        />

        {/* 7. Change Password */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Change Password</h2>
          <p className="text-slate-500 text-sm mb-5">Update the password for your own account.</p>
          <ChangePasswordForm />
        </div>

        {/* 7. Integrations */}
        <div>
          <h2 className="font-semibold text-slate-900 text-lg mb-5">Integrations</h2>
          <div className="space-y-5">
            {/* Webhook */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-1">Webhook Endpoint</h3>
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
      </div>
    </div>
  )
}
