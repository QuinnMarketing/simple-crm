import { prisma } from './prisma'

const API_BASE = 'https://api.apollo.io/api/v1'

// Personal/consumer email domains — Apollo's org enrichment needs a real
// business domain, and person-match accuracy is much lower without one.
// Most leads in this CRM are homeowners on personal email, so many
// enrichment attempts will legitimately come back thin — that's expected,
// Apollo is fundamentally a B2B sales-intelligence dataset.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.com.au', 'hotmail.com', 'outlook.com',
  'live.com', 'icloud.com', 'me.com', 'bigpond.com', 'optusnet.com.au',
  'aol.com', 'msn.com',
])

export interface ProfileEnrichment {
  title?: string
  linkedinUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  emailStatus?: string
  company?: {
    name?: string
    domain?: string
    industry?: string
    employeeCount?: number
    linkedinUrl?: string
  }
}

async function getApolloKey(accountId: string): Promise<string | null> {
  const row = await prisma.accountIntegration.findUnique({
    where: { accountId_platform: { accountId, platform: 'apollo' } },
  })
  if (!row?.enabled) return null
  try {
    const cfg = JSON.parse(row.config) as { apiKey?: string }
    return cfg.apiKey || null
  } catch {
    return null
  }
}

export async function enrichLeadProfile(accountId: string, email: string): Promise<ProfileEnrichment | null> {
  const apiKey = await getApolloKey(accountId)
  if (!apiKey) return null

  const domain = email.split('@')[1]?.toLowerCase()
  const isBusinessDomain = !!domain && !FREE_EMAIL_DOMAINS.has(domain)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }

  const personRes = await fetch(`${API_BASE}/people/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, ...(isBusinessDomain ? { domain } : {}) }),
  })
  if (!personRes.ok) throw new Error(`Apollo people/match failed (${personRes.status})`)
  const personData = await personRes.json()
  const person = personData.person

  const result: ProfileEnrichment = {
    title: person?.title || undefined,
    linkedinUrl: person?.linkedin_url || undefined,
    facebookUrl: person?.facebook_url || undefined,
    twitterUrl: person?.twitter_url || undefined,
    emailStatus: person?.email_status || undefined,
  }

  if (isBusinessDomain) {
    try {
      const orgRes = await fetch(`${API_BASE}/organizations/enrich?${new URLSearchParams({ domain: domain! })}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (orgRes.ok) {
        const orgData = await orgRes.json()
        const org = orgData.organization
        if (org) {
          result.company = {
            name: org.name || undefined,
            domain: org.primary_domain || domain,
            industry: org.industry || undefined,
            employeeCount: org.estimated_num_employees || undefined,
            linkedinUrl: org.linkedin_url || undefined,
          }
        }
      }
    } catch (e) {
      console.error('Apollo organization enrich failed:', e)
    }
  } else if (person?.organization) {
    // Person match sometimes carries the employer inline even without a domain lookup
    const org = person.organization
    result.company = {
      name: org.name || undefined,
      domain: org.primary_domain || undefined,
      industry: org.industry || undefined,
      employeeCount: org.estimated_num_employees || undefined,
      linkedinUrl: org.linkedin_url || undefined,
    }
  }

  return result
}
