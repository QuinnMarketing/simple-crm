'use client'
import { useState } from 'react'
import { Sparkles, Loader2, Linkedin, Facebook, Twitter, BadgeCheck, Building2, RefreshCw } from 'lucide-react'

type ProfileData = {
  title?: string
  linkedinUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  emailStatus?: string
  company?: {
    name?: string
    industry?: string
    employeeCount?: number
    linkedinUrl?: string
  }
}

export default function ProfileEnrichmentCard({
  leadId,
  hasEmail,
  initialProfileData,
  initialEnrichedAt,
}: {
  leadId: string
  hasEmail: boolean
  initialProfileData: string | null
  initialEnrichedAt: string | null
}) {
  const [profile, setProfile] = useState<ProfileData | null>(() => {
    if (!initialProfileData) return null
    try { return JSON.parse(initialProfileData) } catch { return null }
  })
  const [enrichedAt, setEnrichedAt] = useState(initialEnrichedAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!hasEmail) return null

  async function enrich() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setProfile(data.profileData)
      setEnrichedAt(data.profileEnrichedAt)
    } else {
      setError(data.error ?? 'Enrichment failed')
    }
    setLoading(false)
  }

  const hasAnyData = profile && (profile.title || profile.company || profile.linkedinUrl || profile.facebookUrl || profile.twitterUrl)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Profile
        </h3>
        <button
          onClick={enrich}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : profile ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {profile ? 'Re-enrich' : 'Enrich'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {!profile && !error && (
        <p className="text-xs text-slate-400 mt-2">Not enriched yet — pull job title, company, and social profiles from this lead's email.</p>
      )}

      {profile && !hasAnyData && (
        <p className="text-xs text-slate-400 mt-2">No public profile data found for this email.</p>
      )}

      {profile && hasAnyData && (
        <div className="mt-3 space-y-2">
          {profile.title && (
            <p className="text-sm text-slate-700">{profile.title}</p>
          )}
          {profile.company && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-800">{profile.company.name}</span>
                {(profile.company.industry || profile.company.employeeCount) && (
                  <p className="text-xs text-slate-400">
                    {[profile.company.industry, profile.company.employeeCount ? `${profile.company.employeeCount} employees` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}
          {profile.emailStatus && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <BadgeCheck className={`w-3.5 h-3.5 ${profile.emailStatus === 'verified' ? 'text-emerald-500' : 'text-slate-300'}`} />
              Email {profile.emailStatus}
            </p>
          )}
          {(profile.linkedinUrl || profile.facebookUrl || profile.twitterUrl) && (
            <div className="flex items-center gap-3 pt-1">
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors"><Linkedin className="w-4 h-4" /></a>
              )}
              {profile.facebookUrl && (
                <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors"><Facebook className="w-4 h-4" /></a>
              )}
              {profile.twitterUrl && (
                <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors"><Twitter className="w-4 h-4" /></a>
              )}
            </div>
          )}
        </div>
      )}

      {enrichedAt && (
        <p className="text-xs text-slate-300 mt-3">
          Last enriched {new Date(enrichedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
