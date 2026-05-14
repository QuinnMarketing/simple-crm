'use client'
import { useState, useEffect } from 'react'
import { UserPlus, ArrowRightLeft, Pencil, CalendarDays, FileText, Zap, StickyNote, Loader2, Mail, MailOpen, MousePointerClick } from 'lucide-react'
import type { TimelineEvent } from '@/app/api/leads/[id]/timeline/route'

const TYPE_CONFIG = {
  created:       { icon: UserPlus,          bg: 'bg-emerald-100', color: 'text-emerald-600' },
  status:        { icon: ArrowRightLeft,    bg: 'bg-indigo-100',  color: 'text-indigo-600'  },
  updated:       { icon: Pencil,            bg: 'bg-slate-100',   color: 'text-slate-500'   },
  note:          { icon: StickyNote,        bg: 'bg-amber-100',   color: 'text-amber-600'   },
  appointment:   { icon: CalendarDays,      bg: 'bg-blue-100',    color: 'text-blue-600'    },
  quote:         { icon: FileText,          bg: 'bg-violet-100',  color: 'text-violet-600'  },
  conversion:    { icon: Zap,              bg: 'bg-orange-100',  color: 'text-orange-600'  },
  email_sent:    { icon: Mail,             bg: 'bg-sky-100',     color: 'text-sky-600'     },
  email_opened:  { icon: MailOpen,         bg: 'bg-emerald-100', color: 'text-emerald-600' },
  email_clicked: { icon: MousePointerClick, bg: 'bg-indigo-100',  color: 'text-indigo-600'  },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LeadTimeline({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/leads/${leadId}/timeline`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setEvents(d) })
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading timeline…
      </div>
    )
  }

  if (events.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 mb-5">Timeline</h2>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />

        <div className="space-y-4">
          {events.map((event) => {
            const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.updated
            const Icon = cfg.icon
            return (
              <div key={event.id} className="flex gap-3 relative">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{event.title}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{timeAgo(event.date)}</span>
                  </div>
                  {event.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
