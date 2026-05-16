'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Zap } from 'lucide-react'
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/automation-templates'
import AutomationBuilder from '../AutomationBuilder'
import type { AutomationDefinition } from '@/lib/automation-types'

const EMPTY_DEF: AutomationDefinition = {
  trigger: { triggerType: 'lead_created', config: {} },
  steps: [],
}

type BuildState = {
  name: string
  description: string
  def: AutomationDefinition
}

export default function NewAutomationPage() {
  const searchParams = useSearchParams()
  const preselectedId = searchParams.get('template')

  const preselected = preselectedId ? AUTOMATION_TEMPLATES.find((t) => t.id === preselectedId) : null

  const [building, setBuilding] = useState<BuildState | null>(
    preselected
      ? { name: preselected.name, description: preselected.description, def: preselected.definition }
      : null
  )
  const [selectedCategory, setSelectedCategory] = useState('all')

  if (building) {
    return (
      <AutomationBuilder
        automationId={null}
        initialName={building.name}
        initialDescription={building.description}
        initialDef={building.def}
      />
    )
  }

  const filtered = AUTOMATION_TEMPLATES.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  )

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/automations" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Automation</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Start from a template or build from scratch</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Start from scratch */}
        {selectedCategory === 'all' && (
          <button
            onClick={() => setBuilding({ name: '', description: '', def: EMPTY_DEF })}
            className="bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl p-5 text-left transition-all group"
          >
            <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center mb-3 transition-colors">
              <Zap className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">Start from scratch</p>
            <p className="text-xs text-slate-500 mt-1">Build a custom automation with any trigger and steps</p>
          </button>
        )}

        {filtered.map((template) => (
          <button
            key={template.id}
            onClick={() => setBuilding({ name: template.name, description: template.description, def: template.definition })}
            className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-5 text-left transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{template.emoji}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{template.category}</span>
            </div>
            <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">{template.name}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{template.description}</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
              <span>{template.definition.steps.length} step{template.definition.steps.length !== 1 ? 's' : ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
