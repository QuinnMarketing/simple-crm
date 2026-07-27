'use client'
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

type DayConfig = { enabled: boolean; start: string; end: string }

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_DAY: DayConfig = { enabled: false, start: '09:00', end: '17:00' }

const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
  'Pacific/Auckland',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Tokyo',
]

type Props = {
  accountId: string
  accountSlug: string
  initial: {
    enabled: boolean
    title: string
    description: string
    slotDuration: number
    bufferTime: number
    timezone: string
    availableHours: string
    maxDaysAhead: number
    minNoticeHours: number
    cancellationHours: number
    policyText: string
    notifyConfirmation: boolean
    notifyReminder: boolean
  } | null
}

export default function BookingSettingsForm({ accountId, accountSlug, initial }: Props) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const bookingUrl = `${baseUrl}/book/${accountSlug}`
  const embedCode = `<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" style="border:none;border-radius:12px;"></iframe>`

  const parseHours = (raw: string): Record<string, DayConfig> => {
    try { return JSON.parse(raw) } catch { return {} }
  }

  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [title, setTitle] = useState(initial?.title ?? 'Book an Appointment')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [slotDuration, setSlotDuration] = useState(String(initial?.slotDuration ?? 60))
  const [bufferTime, setBufferTime] = useState(String(initial?.bufferTime ?? 0))
  const [timezone, setTimezone] = useState(initial?.timezone ?? 'Australia/Sydney')
  const [maxDaysAhead, setMaxDaysAhead] = useState(String(initial?.maxDaysAhead ?? 60))
  const [minNoticeHours, setMinNoticeHours] = useState(String(initial?.minNoticeHours ?? 24))
  const [cancellationHours, setCancellationHours] = useState(String(initial?.cancellationHours ?? 24))
  const [policyText, setPolicyText] = useState(initial?.policyText ?? '')
  const [notifyConfirmation, setNotifyConfirmation] = useState(initial?.notifyConfirmation ?? true)
  const [notifyReminder, setNotifyReminder] = useState(initial?.notifyReminder ?? true)
  const [hours, setHours] = useState<Record<string, DayConfig>>(parseHours(initial?.availableHours ?? '{}'))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null)

  function getDay(key: string): DayConfig {
    return hours[key] ?? { ...DEFAULT_DAY }
  }

  function setDay(key: string, patch: Partial<DayConfig>) {
    setHours((h) => ({ ...h, [key]: { ...getDay(key), ...patch } }))
  }

  function copyText(text: string, type: 'url' | 'embed') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/settings/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          enabled,
          title,
          description,
          slotDuration: parseInt(slotDuration) || 60,
          bufferTime: parseInt(bufferTime) || 0,
          timezone,
          availableHours: JSON.stringify(hours),
          maxDaysAhead: parseInt(maxDaysAhead) || 60,
          minNoticeHours: parseInt(minNoticeHours) || 24,
          cancellationHours: parseInt(cancellationHours) || 0,
          policyText,
          notifyConfirmation,
          notifyReminder,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Widget status</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-slate-600">{enabled ? 'Enabled' : 'Disabled'}</span>
          <button
            type="button"
            onClick={() => setEnabled((e) => !e)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
      </div>

      {/* Public URL + embed */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Booking URL</p>
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <code className="text-xs font-mono text-slate-700 flex-1 break-all">{bookingUrl}</code>
            <button onClick={() => copyText(bookingUrl, 'url')} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              {copied === 'url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Embed Code</p>
          <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <code className="text-xs font-mono text-slate-700 flex-1 break-all">{embedCode}</code>
            <button onClick={() => copyText(embedCode, 'embed')} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
              {copied === 'embed' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* General settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Slot duration (min)</label>
          <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            {[15, 30, 45, 60, 90, 120].map((v) => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Buffer between slots (min)</label>
          <select value={bufferTime} onChange={(e) => setBufferTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            {[0, 5, 10, 15, 30].map((v) => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Max days ahead</label>
          <select value={maxDaysAhead} onChange={(e) => setMaxDaysAhead(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            {[7, 14, 30, 60, 90].map((v) => <option key={v} value={v}>{v} days</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Min notice</label>
          <select value={minNoticeHours} onChange={(e) => setMinNoticeHours(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            {[1, 2, 4, 8, 24, 48].map((v) => <option key={v} value={v}>{v}h</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cancel window</label>
          <select value={cancellationHours} onChange={(e) => setCancellationHours(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            <option value={0}>No online cancel</option>
            {[1, 2, 4, 12, 24, 48, 72].map((v) => <option key={v} value={v}>{v}h before</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation policy <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
          rows={2}
          placeholder="e.g. Cancellations within 24 hours may incur a fee."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">Shown on the booking page, the confirmation email, and the manage-booking page.</p>
      </div>

      {/* Notification emails */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Notification emails</p>
        <label className="flex items-start gap-2.5 mb-2">
          <input
            type="checkbox"
            checked={notifyConfirmation}
            onChange={(e) => setNotifyConfirmation(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">
            Send a confirmation email at booking time
            <span className="block text-xs text-slate-400">Emails the customer and your business the moment a booking is made.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={notifyReminder}
            onChange={(e) => setNotifyReminder(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">
            Send a reminder ~24 hours before the appointment
            <span className="block text-xs text-slate-400">Reminds the customer and your business the day before. Turn off if you run your own reminder automation.</span>
          </span>
        </label>
      </div>

      {/* Working hours */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Working Hours</p>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = getDay(key)
            return (
              <div key={key} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => setDay(key, { enabled: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <span className={`text-sm ${day.enabled ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{label}</span>
                </label>
                {day.enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.start}
                      onChange={(e) => setDay(key, { start: e.target.value })}
                      className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <span className="text-slate-400 text-sm">–</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={(e) => setDay(key, { end: e.target.value })}
                      className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}
                {!day.enabled && <span className="text-slate-400 text-sm">Unavailable</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
        <button
          onClick={save}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Booking Settings'}
        </button>
      </div>
    </div>
  )
}
