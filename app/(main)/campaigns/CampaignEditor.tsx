'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bold, Italic, Underline, Link2, List, ListOrdered, Heading2,
  Code2, Loader2, Send, CalendarDays, ChevronDown, ChevronUp,
  Check, Search, AlertCircle, LayoutTemplate, X,
} from 'lucide-react'
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES, type EmailTemplate } from '@/lib/email-templates'

type Lead = { id: string; name: string; email: string | null; status: string; source: string | null; unsubscribed: boolean }

type SegmentFilter = { statuses?: string[]; sources?: string[]; leadIds?: string[] }

type Props = {
  campaignId?: string
  accountId?: string | null
  initial?: {
    name: string; subject: string; bodyHtml: string; bodyText: string
    segmentFilter: string; trackOpens: boolean; trackClicks: boolean
    scheduledAt: string | null; status: string
  }
}

const MERGE_TAGS = [
  { label: '{{name}}', desc: 'Lead full name' },
  { label: '{{email}}', desc: 'Lead email' },
  { label: '{{phone}}', desc: 'Lead phone' },
  { label: '{{service}}', desc: 'Lead service' },
  { label: '{{business_name}}', desc: 'Your business name' },
]

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'junk']
const SOURCES = ['website', 'referral', 'google_ads', 'facebook_ads', 'cold_outreach', 'webhook', 'other']

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-purple-100 text-purple-700', won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${colors[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function TemplateModal({ onSelect, onClose }: { onSelect: (t: EmailTemplate) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [preview, setPreview] = useState<EmailTemplate | null>(null)

  const filtered = activeCategory === 'All'
    ? EMAIL_TEMPLATES
    : EMAIL_TEMPLATES.filter((t) => t.category === activeCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Email Templates</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose a template to pre-fill your campaign</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: template list */}
          <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200">
            {/* Category filter */}
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-1.5">
              {['All', ...TEMPLATE_CATEGORIES].map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    activeCategory === cat
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => setPreview(t)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${preview?.id === t.id ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>
                    </div>
                  </div>
                  <span className="mt-2 inline-block text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{t.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {preview ? (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{preview.emoji}</span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{preview.name}</h3>
                      <p className="text-sm text-slate-500">{preview.description}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Subject Line</p>
                    <p className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">{preview.subject}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email Body Preview</p>
                    <div
                      className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-4 text-slate-700 prose prose-sm max-w-none [&_h2]:text-base [&_h2]:font-semibold [&_a]:text-indigo-600 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  <button onClick={() => { onSelect(preview); onClose() }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    <LayoutTemplate className="w-4 h-4" /> Use This Template
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center px-8">
                <div>
                  <LayoutTemplate className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Select a template on the left to preview it</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CampaignEditor({ campaignId, accountId, initial }: Props) {
  const router = useRouter()
  const editorRef = useRef<HTMLDivElement>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? '')
  const [bodyText, setBodyText] = useState(initial?.bodyText ?? '')
  const [editorTab, setEditorTab] = useState<'visual' | 'html' | 'text'>('visual')
  const [htmlSource, setHtmlSource] = useState(initial?.bodyHtml ?? '')
  const [trackOpens, setTrackOpens] = useState(initial?.trackOpens ?? true)
  const [trackClicks, setTrackClicks] = useState(initial?.trackClicks ?? true)
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : ''
  )
  const [mergeTags, setMergeTags] = useState(false)

  // Recipients
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterSources, setFilterSources] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [recipientOpen, setRecipientOpen] = useState(true)

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  function applyTemplate(t: EmailTemplate) {
    if (!name) setName(t.name)
    setSubject(t.subject)
    setBodyHtml(t.bodyHtml)
    setHtmlSource(t.bodyHtml)
    setBodyText(t.bodyText)
    setEditorTab('visual')
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = t.bodyHtml }, 0)
  }

  // Load leads
  useEffect(() => {
    const qs = accountId ? `?account=${accountId}` : ''
    fetch(`/api/leads${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setLeads(d)
        else if (Array.isArray(d.leads)) setLeads(d.leads)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore selected from initial segmentFilter
  useEffect(() => {
    if (initial?.segmentFilter) {
      try {
        const f: SegmentFilter = JSON.parse(initial.segmentFilter)
        if (f.leadIds?.length) setSelectedIds(new Set(f.leadIds))
      } catch { /* ignore */ }
    }
  }, [initial])

  // Init contenteditable
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = bodyHtml
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncHtmlFromEditor = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ''
    setBodyHtml(html)
    setHtmlSource(html)
  }, [])

  function switchTab(tab: 'visual' | 'html' | 'text') {
    if (editorTab === 'visual') syncHtmlFromEditor()
    if (tab === 'visual' && editorTab === 'html') {
      setBodyHtml(htmlSource)
      setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = htmlSource }, 0)
    }
    if (tab === 'html' && editorTab === 'visual') {
      const html = editorRef.current?.innerHTML ?? ''
      setHtmlSource(html)
    }
    setEditorTab(tab)
  }

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined)
    editorRef.current?.focus()
  }

  function insertMergeTag(tag: string) {
    editorRef.current?.focus()
    document.execCommand('insertText', false, tag)
    setMergeTags(false)
  }

  function insertLink() {
    const url = prompt('Enter URL:')
    if (url) execCmd('createLink', url)
  }

  // Filtered leads for recipient table
  const filteredLeads = leads.filter((l) => {
    if (!l.email) return false
    if (filterStatuses.length && !filterStatuses.includes(l.status)) return false
    if (filterSources.length && (!l.source || !filterSources.includes(l.source))) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.name.toLowerCase().includes(q) && !l.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const eligibleSelected = filteredLeads.filter((l) => selectedIds.has(l.id))
  const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id))

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredLeads.forEach((l) => next.delete(l.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredLeads.forEach((l) => next.add(l.id))
        return next
      })
    }
  }

  function toggleStatus(s: string) {
    setFilterStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function toggleSource(s: string) {
    setFilterSources((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function buildPayload() {
    const currentHtml = editorTab === 'visual'
      ? (editorRef.current?.innerHTML ?? bodyHtml)
      : editorTab === 'html' ? htmlSource : bodyHtml

    return {
      name, subject,
      bodyHtml: currentHtml,
      bodyText,
      segmentFilter: { leadIds: Array.from(selectedIds) } as SegmentFilter,
      trackOpens, trackClicks,
      scheduledAt: sendMode === 'scheduled' && scheduledAt ? scheduledAt : null,
      ...(accountId ? { accountId } : {}),
    }
  }

  async function saveDraft() {
    setSaving(true); setError(null)
    try {
      const payload = buildPayload()
      const method = campaignId ? 'PATCH' : 'POST'
      const url = campaignId ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      const data = await res.json()
      if (!campaignId) router.push(`/campaigns/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    if (selectedIds.size === 0) { setError('Select at least one recipient'); return }
    if (!subject.trim()) { setError('Add a subject line'); return }
    setSending(true); setError(null)
    try {
      // Save first
      const payload = buildPayload()
      const method = campaignId ? 'PATCH' : 'POST'
      const url = campaignId ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const saveRes = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!saveRes.ok) throw new Error((await saveRes.json()).error ?? 'Save failed')
      const saved = await saveRes.json()

      if (sendMode === 'scheduled') {
        await fetch(`/api/campaigns/${saved.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'scheduled' }),
        })
        router.push('/campaigns')
        return
      }

      const sendRes = await fetch(`/api/campaigns/${saved.id}/send`, { method: 'POST' })
      const result = await sendRes.json()
      if (!sendRes.ok) throw new Error(result.error ?? 'Send failed')
      router.push(`/campaigns/${saved.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  const emailCount = leads.filter((l) => l.email && selectedIds.has(l.id)).length

  return (
    <>
    {showTemplates && <TemplateModal onSelect={applyTemplate} onClose={() => setShowTemplates(false)} />}
    <div className="space-y-5 max-w-4xl">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Campaign Details</h2>
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 border border-indigo-200 transition-colors">
            <LayoutTemplate className="w-3.5 h-3.5" /> Use a Template
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Christmas Offer 2026"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Subject Line</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Special offer just for you 🎄"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h2 className="font-semibold text-slate-900 text-sm">Email Body</h2>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button onClick={() => setMergeTags(!mergeTags)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                <Code2 className="w-3.5 h-3.5" /> Merge Tags
              </button>
              {mergeTags && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-slate-200 shadow-lg z-20 overflow-hidden">
                  {MERGE_TAGS.map((t) => (
                    <button key={t.label} onClick={() => insertMergeTag(t.label)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center justify-between gap-2">
                      <code className="text-indigo-600 text-xs">{t.label}</code>
                      <span className="text-slate-400 text-xs">{t.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 mt-3 px-5 gap-4">
          {(['visual', 'html', 'text'] as const).map((tab) => (
            <button key={tab} onClick={() => switchTab(tab)}
              className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                editorTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab === 'html' ? 'HTML Source' : tab === 'text' ? 'Plain Text' : 'Visual'}
            </button>
          ))}
        </div>

        {/* Toolbar (visual only) */}
        {editorTab === 'visual' && (
          <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-100 flex-wrap">
            {[
              { icon: Bold, cmd: 'bold' }, { icon: Italic, cmd: 'italic' }, { icon: Underline, cmd: 'underline' },
            ].map(({ icon: Icon, cmd }) => (
              <button key={cmd} onMouseDown={(e) => { e.preventDefault(); execCmd(cmd) }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2') }}
              className="h-8 px-2 flex items-center text-xs font-bold rounded hover:bg-slate-100 text-slate-600 transition-colors">
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'p') }}
              className="h-8 px-2 flex items-center text-xs rounded hover:bg-slate-100 text-slate-600 transition-colors">
              P
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 transition-colors">
              <List className="w-3.5 h-3.5" />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList') }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 transition-colors">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button onMouseDown={(e) => { e.preventDefault(); insertLink() }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 transition-colors">
              <Link2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editor area */}
        <div className="p-5">
          {editorTab === 'visual' && (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={syncHtmlFromEditor}
              className="min-h-48 outline-none text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_a]:text-indigo-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
            />
          )}
          {editorTab === 'html' && (
            <textarea value={htmlSource} onChange={(e) => setHtmlSource(e.target.value)}
              className="w-full min-h-48 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              placeholder="<p>Hello {{name}},</p>" />
          )}
          {editorTab === 'text' && (
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)}
              className="w-full min-h-48 text-sm text-slate-700 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              placeholder="Plain text fallback. Hello {{name}}, ..." />
          )}
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button onClick={() => setRecipientOpen(!recipientOpen)}
          className="w-full flex items-center justify-between px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">Recipients</span>
            {selectedIds.size > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {emailCount} with emails
              </span>
            )}
          </div>
          {recipientOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {recipientOpen && (
          <div className="border-t border-slate-100">
            {/* Filters */}
            <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => toggleStatus(s)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors capitalize ${
                      filterStatuses.includes(s)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 text-slate-500 hover:border-indigo-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {SOURCES.map((s) => (
                  <button key={s} onClick={() => toggleSource(s)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      filterSources.includes(s)
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Select all row */}
            <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-slate-600">
                {allFilteredSelected ? 'Deselect all' : `Select all ${filteredLeads.length} shown`}
              </span>
              <span className="ml-auto text-xs text-slate-400">{selectedIds.size} selected</span>
            </div>

            {/* Lead list */}
            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
              {filteredLeads.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No leads match the current filters</p>
              ) : filteredLeads.map((l) => (
                <label key={l.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.has(l.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(l.id) : next.delete(l.id)
                        return next
                      })
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{l.name}</span>
                      {l.unsubscribed && <span className="text-xs text-red-500">unsubscribed</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{l.email}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </label>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <div className="px-5 py-2.5 border-t border-slate-100 bg-indigo-50 text-xs text-indigo-700 font-medium">
                {emailCount} recipient{emailCount !== 1 ? 's' : ''} will receive this email
                {eligibleSelected.length !== selectedIds.size && ` (${selectedIds.size - eligibleSelected.length} hidden by filter)`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 text-sm">Settings</h2>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trackOpens} onChange={(e) => setTrackOpens(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Track opens</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trackClicks} onChange={(e) => setTrackClicks(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Track clicks</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="sendMode" checked={sendMode === 'now'} onChange={() => setSendMode('now')}
              className="text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Send immediately</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="sendMode" checked={sendMode === 'scheduled'} onChange={() => setSendMode('scheduled')}
              className="text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Schedule</span>
          </label>
        </div>

        {sendMode === 'scheduled' && (
          <div className="relative inline-flex items-center gap-2">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <button onClick={saveDraft} disabled={saving}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Draft
        </button>
        <button onClick={sendNow} disabled={sending || saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sendMode === 'scheduled' ? <CalendarDays className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending…' : sendMode === 'scheduled' ? `Schedule to ${emailCount} lead${emailCount !== 1 ? 's' : ''}` : `Send to ${emailCount} lead${emailCount !== 1 ? 's' : ''}`}
          {!sending && emailCount > 0 && <Check className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
    </>
  )
}
