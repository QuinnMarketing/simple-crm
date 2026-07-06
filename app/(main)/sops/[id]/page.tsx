'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Trash2, PenLine, Printer, Bot, X } from 'lucide-react'

type Sop = {
  id: string
  title: string
  industry: string | null
  category: string | null
  content: string
  source: string
  updatedAt: string
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

/** Minimal markdown renderer for SOP content — headings, bold, bullets, numbered lists. */
function renderBold(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  )
}

function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushList = (key: number) => {
    if (!list) return
    const items = list.items.map((item, i) => (
      <li key={i} className="text-slate-700 leading-relaxed">{renderBold(item, `li-${key}-${i}`)}</li>
    ))
    blocks.push(
      list.type === 'ul'
        ? <ul key={`l-${key}`} className="list-disc pl-5 space-y-1 my-2">{items}</ul>
        : <ol key={`l-${key}`} className="list-decimal pl-5 space-y-1.5 my-2">{items}</ol>
    )
    list = null
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^[-*]\s+(.*)/)
    const numbered = line.match(/^\d+[.)]\s+(.*)/)

    if (bullet) {
      if (!list || list.type !== 'ul') { flushList(i); list = { type: 'ul', items: [] } }
      list.items.push(bullet[1])
      return
    }
    if (numbered) {
      if (!list || list.type !== 'ol') { flushList(i); list = { type: 'ol', items: [] } }
      list.items.push(numbered[1])
      return
    }
    flushList(i)

    if (line.startsWith('### ')) blocks.push(<h4 key={i} className="text-base font-semibold text-slate-900 mt-5 mb-1">{line.slice(4)}</h4>)
    else if (line.startsWith('## ')) blocks.push(<h3 key={i} className="text-lg font-bold text-slate-900 mt-6 mb-2">{line.slice(3)}</h3>)
    else if (line.startsWith('# ')) blocks.push(<h2 key={i} className="text-xl font-bold text-slate-900 mt-2 mb-3">{line.slice(2)}</h2>)
    else if (line.trim() === '') blocks.push(<div key={i} className="h-1" />)
    else blocks.push(<p key={i} className="text-slate-700 leading-relaxed my-1.5">{renderBold(line, `p-${i}`)}</p>)
  })
  flushList(lines.length)

  return <div>{blocks}</div>
}

export default function SopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sp = useSearchParams()
  const accountParam = sp.get('account')

  const [sop, setSop] = useState<Sop | null>(null)
  const [editing, setEditing] = useState(sp.get('edit') === '1')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/sops/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Sop | null) => {
        if (data) {
          setSop(data)
          setTitle(data.title)
          setContent(data.content)
          setCategory(data.category ?? '')
        }
      })
  }, [id])

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/sops/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, category }),
    })
    if (res.ok) {
      const data = await res.json()
      setSop(data)
      setEditing(false)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!sop || !confirm(`Delete "${sop.title}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/sops/${id}`, { method: 'DELETE' })
    if (res.ok) router.push(`/sops${accountParam ? `?account=${accountParam}` : ''}`)
    else setDeleting(false)
  }

  if (!sop) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 print:hidden">
        <Link href={`/sops${accountParam ? `?account=${accountParam}` : ''}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> SOPs
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={`${inputCls} text-lg font-bold max-w-xl`} />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900">{sop.title}</h1>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 flex-wrap">
              {sop.source === 'ai' && <span className="flex items-center gap-1 text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full"><Bot className="w-3 h-3" /> AI generated</span>}
              {editing ? (
                <select value={category} onChange={e => setCategory(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white">
                  <option value="">No category</option>
                  {['Safety', 'Operations', 'Sales', 'Admin', 'Quality'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                sop.category && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{sop.category}</span>
              )}
              {sop.industry && <span>{sop.industry}</span>}
              <span>Updated {new Date(sop.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setTitle(sop.title); setContent(sop.content); setCategory(sop.category ?? '') }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </>
            ) : (
              <>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                  <PenLine className="w-4 h-4" /> Edit
                </button>
              </>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 print:border-0 print:p-0">
        {editing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={28}
            className="w-full font-mono text-sm border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder={'# Title\n\n**Purpose** — why this SOP exists\n\n## Procedure\n1. First step\n2. Second step\n\n## Safety requirements\n- ...'}
          />
        ) : (
          <Markdown content={sop.content || '_This SOP is empty — click Edit to write it._'} />
        )}
      </div>

      {!editing && (
        <div className="flex justify-end mt-4 print:hidden">
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete SOP
          </button>
        </div>
      )}
    </div>
  )
}
