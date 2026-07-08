import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import IntegrationsForm from './IntegrationsForm'
import CopyButton from './CopyButton'
import DocumentTemplatesSection from './DocumentTemplatesSection'
import BusinessInfoForm from './BusinessInfoForm'
import CustomFieldsSection from './CustomFieldsSection'
import BookingSettingsForm from './BookingSettingsForm'
import BookingTypesManager from './BookingTypesManager'
import BookingStaffManager from './BookingStaffManager'
import ReviewSettingsForm from './ReviewSettingsForm'
import DocumentNumberingForm from './DocumentNumberingForm'
import OutboundIntegrationsForm from './OutboundIntegrationsForm'
import CollapsibleSection from './CollapsibleSection'
import Link from 'next/link'
import { UserCog, History, Mail } from 'lucide-react'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; gcal?: string; ganalytics?: string; google?: string; meta?: string; linkedin?: string; gmail?: string; outlook?: string; msg?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { account: accountParam, gcal, ganalytics, google, meta, linkedin, gmail, outlook, msg } = await searchParams

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
    include: { integrations: true, bookingSettings: true, reviewSettings: true, documentSettings: true, outboundIntegrations: { orderBy: { createdAt: 'asc' } } },
  })

  if (!account) redirect('/accounts')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/webhooks/form?token=${account.webhookToken}`
  const emailWebhookUrl = `${baseUrl}/api/webhooks/email?token=${account.webhookToken}`

  const integrationConfigs: Record<string, Record<string, string>> = {}
  for (const integration of account.integrations) {
    try {
      const raw = JSON.parse(integration.config)
      // Strip refresh/access tokens from OAuth platforms — never expose to client
      if (integration.platform === 'google') {
        integrationConfigs.google = { connected: 'true', email: raw.email ?? '' }
      } else if (integration.platform === 'meta') {
        integrationConfigs.meta = {
          connected: 'true',
          userName: raw.userName ?? '',
          adAccounts: JSON.stringify(raw.adAccounts ?? []),
          pages: JSON.stringify(raw.pages ?? []),
        }
      } else if (integration.platform === 'linkedin') {
        integrationConfigs.linkedin = {
          connected: 'true',
          personName: raw.personName ?? '',
          organizations: JSON.stringify(raw.organizations ?? []),
        }
      } else if (integration.platform === 'gmail' || integration.platform === 'outlook') {
        integrationConfigs[integration.platform] = {
          connected: 'true',
          email: raw.email ?? '',
          lastSyncedAt: raw.lastSyncedAt ?? '',
        }
      } else {
        integrationConfigs[integration.platform] = raw
      }
    } catch {
      integrationConfigs[integration.platform] = {}
    }
  }
  // google_ads config — only customer/conversion IDs (no OAuth secrets)
  const adsDefaults: Record<string, string> = {}
  integrationConfigs.google_ads = { ...adsDefaults, ...integrationConfigs.google_ads }

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
      {google === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Google connected successfully. Configure your Ads and Analytics resources below.
        </div>
      )}
      {google === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Google connection failed{msg ? `: ${decodeURIComponent(msg)}` : '. Check your credentials and try again.'}
        </div>
      )}
      {meta === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Meta connected successfully. Configure your Pixel and Ad Account below.
        </div>
      )}
      {meta === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Meta connection failed{msg ? `: ${decodeURIComponent(msg)}` : '. Check your Facebook App settings and try again.'}
        </div>
      )}
      {linkedin === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          LinkedIn connected successfully.
        </div>
      )}
      {linkedin === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          LinkedIn connection failed{msg ? `: ${decodeURIComponent(msg)}` : '. Check your LinkedIn App settings and try again.'}
        </div>
      )}
      {gmail === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Gmail connected. New emails from matching leads will start appearing on their timeline after the next sync.
        </div>
      )}
      {gmail === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Gmail connection failed{msg ? `: ${decodeURIComponent(msg)}` : '. Check your Google OAuth credentials and try again.'}
        </div>
      )}
      {outlook === 'connected' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800 font-medium">
          Outlook connected. New emails from matching leads will start appearing on their timeline after the next sync.
        </div>
      )}
      {outlook === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-800 font-medium">
          Outlook connection failed{msg ? `: ${decodeURIComponent(msg)}` : '. Check your Microsoft App credentials and try again.'}
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

        {/* 5. Document Numbering */}
        <DocumentNumberingForm
          accountId={accountId}
          initial={{
            quotePrefix: account.documentSettings?.quotePrefix ?? 'Q-',
            invoicePrefix: account.documentSettings?.invoicePrefix ?? 'INV-',
            nextQuoteNum: account.documentSettings?.nextQuoteNum ?? 1,
            nextInvoiceNum: account.documentSettings?.nextInvoiceNum ?? 1,
            numberPadding: account.documentSettings?.numberPadding ?? 3,
          }}
        />

        {/* 6. Booking Widget */}
        <CollapsibleSection
          title="Booking Widget"
          description="Allow clients to book appointments directly from your website"
          ok={account.bookingSettings?.enabled ?? false}
        >
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
        </CollapsibleSection>

        {/* 6b. Booking Services */}
        <CollapsibleSection
          title="Booking Services"
          description="Define the services clients can choose when booking — each with its own duration and price"
        >
          <BookingTypesManager accountId={accountId} />
        </CollapsibleSection>

        {/* 6c. Booking Staff */}
        <CollapsibleSection
          title="Booking Staff"
          description="Assign team members to services with their own hours, or keep one shared calendar"
        >
          <BookingStaffManager accountId={accountId} />
        </CollapsibleSection>

        {/* 7. Review Widget */}
        <CollapsibleSection
          title="Review Widget"
          description="Collect and display customer reviews on your website"
          ok={account.reviewSettings?.enabled ?? false}
        >
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
        </CollapsibleSection>

        {/* 7. Integrations */}
        <div>
          <h2 className="font-semibold text-slate-900 text-lg mb-5">Integrations</h2>
          <div className="space-y-5">
            {/* Webhook */}
            <CollapsibleSection
              title="Webhook Endpoint"
              description="Receive leads from any form builder — Elementor, Typeform, JotForm, Gravity Forms"
              ok
              statusLabel="Active"
            >
              {/* Form webhook */}
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Form Webhook URL</p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                <code className="text-sm font-mono text-slate-700 flex-1 break-all">{webhookUrl}</code>
                <CopyButton text={webhookUrl} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 mb-6">
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

              {/* Email inbound */}
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email Inbound URL</p>
              <p className="text-xs text-slate-500 mb-2">Forward lead notification emails to this URL via Mailgun, SendGrid, Postmark, or Cloudflare Email Routing. The email body is automatically parsed into a lead.</p>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                <code className="text-sm font-mono text-slate-700 flex-1 break-all">{emailWebhookUrl}</code>
                <CopyButton text={emailWebhookUrl} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold text-slate-900 mb-2">Mailgun</p>
                  <p className="text-slate-500 text-xs">Receiving → Routes → Create Route → Match recipient → Forward to URL above. Your inbox: <span className="font-mono">leads@mg.yourdomain.com</span></p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold text-slate-900 mb-2">SendGrid</p>
                  <p className="text-slate-500 text-xs">Settings → Inbound Parse → Add Host & URL → paste URL above. Your inbox: <span className="font-mono">leads@yourdomain.com</span></p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold text-slate-900 mb-2">Cloudflare</p>
                  <p className="text-slate-500 text-xs">Email Routing → Workers → create a Worker that POSTs the raw email to the URL above. Free on all plans.</p>
                </div>
              </div>
            </CollapsibleSection>

            <IntegrationsForm accountId={accountId} initialConfigs={integrationConfigs} />

            <CollapsibleSection
              title="Outbound Integrations"
              description="Push lead data to any platform via webhook — custom URL, any auth method"
              ok={account.outboundIntegrations.length > 0}
              statusLabel={account.outboundIntegrations.length > 0 ? `${account.outboundIntegrations.length} configured` : 'None configured'}
            >
              <OutboundIntegrationsForm initial={account.outboundIntegrations} />
            </CollapsibleSection>


          </div>
        </div>
      </div>
    </div>
  )
}
