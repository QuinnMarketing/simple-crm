'use client'
import { useState } from 'react'
import { CheckCircle, Pencil, X, CalendarDays, Loader2 } from 'lucide-react'

const SUGGESTIONS: Record<string, string> = {
  new:        'Give them a call — introduce yourself and qualify their needs',
  contacted:  'Follow up if no response within 48 hours',
  qualified:  'Prepare and send a quote',
  won:        'Create an invoice and confirm the project start date',
  lost:       'Document the reason and consider re-engaging in 90 days',
}

function formatDue(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function isOverdue(dateStr: string) {
  return dateStr < new Date().toISOString().slice(0, 10)
}

export default function NextStepsCard({
  leadId,
  status,
  initialNextStep,
  initialNextStepDue,
}: {
  leadId: string
  status: string
  initialNextStep: string | null
  initialNextStepDue: string | null
}) {
  const [nextStep, setNextStep] = useState(initialNextStep)
  const [nextStepDue, setNextStepDue] = useState(initialNextStepDue ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNextStep ?? '')
  const [draftDue, setDraftDue] = useState(initialNextStepDue ?? '')
  const [saving, setSaving] = useState(false)

  async function save(step: string | null, due: string | null) {
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextStep: step || null, nextStepDue: due || null }),
    })
    setNextStep(step)
    setNextStepDue(due ?? '')
    setSaving(false)
    setEditing(false)
  }

  async function markDone() {
    await save(null, null)
    setDraft('')
    setDraftDue('')
  }

  const suggestion = SUGGESTIONS[status] ?? 'Review this lead and determine the next action'
  const overdue = nextStepDue ? isOverdue(nextStepDue) : false

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-indigo-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900 text-sm">Next Step</h2>
          <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={suggestion}
          rows={2}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={draftDue}
              onChange={(e) => setDraftDue(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => save(draft, draftDue || null)}
            disabled={saving || !draft.trim()}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    )
  }

  if (nextStep) {
    return (
      <div className={`bg-white rounded-xl border p-5 ${overdue ? 'border-red-200' : 'border-indigo-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900 text-sm">Next Step</h2>
          {nextStepDue && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              overdue ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {overdue ? 'Overdue · ' : ''}{formatDue(nextStepDue)}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-800 leading-snug mb-4">{nextStep}</p>
        <div className="flex gap-2">
          <button
            onClick={markDone}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Done
          </button>
          <button
            onClick={() => { setDraft(nextStep); setDraftDue(nextStepDue); setEditing(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-5">
      <h2 className="font-semibold text-slate-900 text-sm mb-1">Next Step</h2>
      <p className="text-sm text-slate-600 mb-3 leading-snug">{suggestion}</p>
      <button
        onClick={() => { setDraft(''); setDraftDue(''); setEditing(true) }}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
      >
        + Set a custom next step
      </button>
    </div>
  )
}
