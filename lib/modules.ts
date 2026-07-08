// Central module registry — the single source of truth for which features
// exist, how they appear in nav, which API routes they own, and their default
// on/off state. Client-safe: no server/prisma imports, so both the Sidebar
// (client) and route guards (server) can import it.

export type ModuleKey =
  | 'calendar'
  | 'quotes'
  | 'takeoffs'
  | 'projects'
  | 'companies'
  | 'expenses'
  | 'email_inbox'
  | 'live_chat'
  | 'automations'
  | 'tasks'
  | 'reports'
  | 'campaigns'
  | 'social'
  | 'ads'
  | 'reviews'
  | 'sops'
  | 'time'

export type ModuleDef = {
  key: ModuleKey
  label: string
  description: string
  // Default state when an account has no explicit AccountModule override.
  // Everything is on by default except opt-in modules like Takeoffs.
  defaultOn: boolean
  // Nav hrefs this module owns (hidden from the sidebar when disabled)
  navHrefs: string[]
  // API/page path prefixes this module owns (blocked when disabled)
  routePrefixes: string[]
}

export const MODULES: ModuleDef[] = [
  { key: 'calendar', label: 'Calendar & Booking', description: 'Appointment calendar and public online booking', defaultOn: true, navHrefs: ['/calendar'], routePrefixes: ['/api/appointments', '/api/calendar', '/api/book', '/api/settings/booking'] },
  { key: 'quotes', label: 'Quotes & Invoices', description: 'Quotes, invoices, payments and the price book', defaultOn: true, navHrefs: ['/quotes', '/price-book'], routePrefixes: ['/api/quotes', '/api/price-book'] },
  { key: 'takeoffs', label: 'Takeoffs & Estimating', description: 'Plan takeoffs and measured estimating', defaultOn: false, navHrefs: ['/takeoffs'], routePrefixes: ['/api/takeoffs'] },
  { key: 'projects', label: 'Projects & Gantt', description: 'Project tracking and Gantt charts', defaultOn: true, navHrefs: ['/gantt', '/projects'], routePrefixes: ['/api/gantt', '/api/projects'] },
  { key: 'companies', label: 'Companies', description: 'Company records linked to leads', defaultOn: true, navHrefs: ['/companies'], routePrefixes: ['/api/companies'] },
  { key: 'expenses', label: 'Expenses & Receipts', description: 'Expense tracking and receipt inbox with OCR', defaultOn: true, navHrefs: ['/expenses', '/receipts'], routePrefixes: ['/api/expenses', '/api/pending-receipts', '/api/receipts'] },
  { key: 'email_inbox', label: 'Email Inbox', description: 'Two-way email sync with leads', defaultOn: true, navHrefs: ['/email-inbox'], routePrefixes: ['/api/email-inbox'] },
  { key: 'live_chat', label: 'Live Chat', description: 'Website live-chat widget and inbox', defaultOn: true, navHrefs: ['/live-chat'], routePrefixes: ['/api/live-chat'] },
  { key: 'automations', label: 'Automations', description: 'Trigger-based workflow automations', defaultOn: true, navHrefs: ['/automations'], routePrefixes: ['/api/automations'] },
  { key: 'tasks', label: 'Tasks', description: 'Team task management', defaultOn: true, navHrefs: ['/tasks'], routePrefixes: ['/api/tasks'] },
  { key: 'reports', label: 'Reports & Analytics', description: 'Reporting dashboards and website analytics', defaultOn: true, navHrefs: ['/reports', '/analytics'], routePrefixes: ['/api/reports', '/api/analytics'] },
  { key: 'campaigns', label: 'Campaigns & Landing Pages', description: 'Email marketing campaigns and landing pages', defaultOn: true, navHrefs: ['/campaigns', '/landing-pages'], routePrefixes: ['/api/campaigns', '/api/landing-pages'] },
  { key: 'social', label: 'Social', description: 'Social media scheduling and publishing', defaultOn: true, navHrefs: ['/social'], routePrefixes: ['/api/social'] },
  { key: 'ads', label: 'Ad Manager', description: 'Google and Meta ad campaign management', defaultOn: true, navHrefs: ['/ads'], routePrefixes: ['/api/ads'] },
  { key: 'reviews', label: 'Reviews', description: 'Review collection, widget and Google sync', defaultOn: true, navHrefs: ['/reviews'], routePrefixes: ['/api/reviews', '/api/settings/reviews'] },
  { key: 'sops', label: 'SOPs', description: 'Standard operating procedures with AI generation', defaultOn: true, navHrefs: ['/sops'], routePrefixes: ['/api/sops'] },
  { key: 'time', label: 'Time Tracking', description: 'Time entries and timesheets', defaultOn: true, navHrefs: ['/time'], routePrefixes: ['/api/time-entries'] },
]

// Nav hrefs that are always available and never gated (the CRM core).
export const CORE_NAV_HREFS = ['/', '/leads', '/settings', '/accounts']

const NAV_MODULE = new Map<string, ModuleKey>()
const MODULE_BY_KEY = new Map<ModuleKey, ModuleDef>()
for (const m of MODULES) {
  MODULE_BY_KEY.set(m.key, m)
  for (const href of m.navHrefs) NAV_MODULE.set(href, m.key)
}

export function moduleForNavHref(href: string): ModuleKey | null {
  return NAV_MODULE.get(href) ?? null
}

export function getModule(key: ModuleKey): ModuleDef | undefined {
  return MODULE_BY_KEY.get(key)
}

// Which module (if any) owns a given request path. Returns null for core/
// ungated paths. Longest-prefix wins so nested routes resolve correctly.
export function moduleForPath(pathname: string): ModuleKey | null {
  let best: { key: ModuleKey; len: number } | null = null
  for (const m of MODULES) {
    for (const prefix of m.routePrefixes) {
      if ((pathname === prefix || pathname.startsWith(prefix + '/')) && (!best || prefix.length > best.len)) {
        best = { key: m.key, len: prefix.length }
      }
    }
  }
  return best?.key ?? null
}

export const DEFAULT_ON_KEYS: ModuleKey[] = MODULES.filter(m => m.defaultOn).map(m => m.key)
