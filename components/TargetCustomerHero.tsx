import Link from 'next/link'
import { Crosshair, Target, Heart, Megaphone, Sparkles } from 'lucide-react'
import HoloAvatar, { type HoloFact } from './HoloAvatar'

export type AvatarView = {
  name: string
  tagline?: string | null
  imageUrl?: string | null
  ageRange?: string | null
  gender?: string | null
  occupation?: string | null
  location?: string | null
  income?: string | null
  goals?: string | null
  painPoints?: string | null
  channels?: string | null
}

function lines(v?: string | null): string[] {
  return (v ?? '').split('\n').map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
}

/**
 * The visual ideal-customer card. Presentational (server-safe) so it can render
 * as the dashboard hero and on the Target Customer page. `href` adds a manage link.
 */
export default function TargetCustomerHero({ avatar, href }: { avatar: AvatarView; href?: string }) {
  const meta = [avatar.ageRange, avatar.gender, avatar.occupation, avatar.location, avatar.income].filter(Boolean) as string[]
  const holoFacts: HoloFact[] = [
    ...(avatar.ageRange ? [{ label: 'Age', value: avatar.ageRange }] : []),
    ...(avatar.location ? [{ label: 'Location', value: avatar.location }] : []),
    ...(avatar.income ? [{ label: 'Budget', value: avatar.income }] : []),
    ...lines(avatar.painPoints).slice(0, 2).map(v => ({ label: 'Key pain', value: v })),
    ...lines(avatar.channels).slice(0, 2).map(v => ({ label: 'Reach via', value: v })),
    ...(avatar.occupation ? [{ label: 'Profile', value: avatar.occupation }] : []),
  ]
  const goals = lines(avatar.goals).slice(0, 4)
  const pains = lines(avatar.painPoints).slice(0, 4)
  const channels = lines(avatar.channels).slice(0, 4)

  return (
    <div className="rounded-2xl overflow-hidden border border-indigo-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-white/95 text-xs font-semibold uppercase tracking-wide">
          <Crosshair className="w-4 h-4" /> Who you should be targeting
        </span>
        {href && (
          <Link href={href} className="text-white/90 hover:text-white text-xs font-medium underline underline-offset-2">
            View &amp; edit
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-0">
        {/* Next-gen holographic profile */}
        <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[300px]">
          <HoloAvatar name={avatar.name} facts={holoFacts} />
        </div>

        {/* Details */}
        <div className="p-5 sm:p-6">
          <h2 className="text-2xl font-bold text-slate-900">{avatar.name}</h2>
          {avatar.tagline && <p className="text-slate-600 mt-1 leading-relaxed">{avatar.tagline}</p>}

          {meta.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {meta.map((m, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">{m}</span>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-5">
            {goals.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5"><Target className="w-3.5 h-3.5" /> They want</p>
                <ul className="space-y-1">
                  {goals.map((g, i) => <li key={i} className="text-sm text-slate-700 flex gap-1.5"><span className="text-emerald-500 mt-0.5">✓</span>{g}</li>)}
                </ul>
              </div>
            )}
            {pains.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1.5"><Heart className="w-3.5 h-3.5" /> You solve</p>
                <ul className="space-y-1">
                  {pains.map((p, i) => <li key={i} className="text-sm text-slate-700 flex gap-1.5"><span className="text-rose-400 mt-0.5">•</span>{p}</li>)}
                </ul>
              </div>
            )}
          </div>

          {channels.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2"><Megaphone className="w-3.5 h-3.5" /> Reach them via</p>
              <div className="flex flex-wrap gap-1.5">
                {channels.map((c, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Empty-state prompt shown when no persona exists yet. */
export function TargetCustomerPrompt({ href }: { href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition-colors p-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3">
        <Crosshair className="w-6 h-6" />
      </div>
      <p className="font-semibold text-slate-900">Define your ideal customer</p>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Every login should remind you who you&apos;re chasing. Let AI build your target-customer avatar from your services and wins.</p>
      <span className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-indigo-600"><Sparkles className="w-4 h-4" /> Create it now</span>
    </Link>
  )
}
