// Central module registry — the single source of truth for which features
// exist, how they appear in nav, which API routes they own, and their default
// on/off state. Client-safe: no server/prisma imports, so both the Sidebar
// (client) and route guards (server) can import it.

export type ModuleKey =
  | 'target_customer'
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
  | 'gallery'
  | 'products'
  | 'team'
  | 'blog'

export type ModuleDef = {
  key: ModuleKey
  label: string
  description: string
  // Default state when an account has no explicit AccountModule override.
  // Lean default: only Target Customer and Quotes & Invoices are on out of the
  // box (alongside the always-on core: Dashboard, Leads, Settings). Every other
  // module is opt-in and must be switched on per account.
  defaultOn: boolean
  // Nav hrefs this module owns (hidden from the sidebar when disabled)
  navHrefs: string[]
  // API/page path prefixes this module owns (blocked when disabled)
  routePrefixes: string[]
}

export const MODULES: ModuleDef[] = [
  { key: 'target_customer', label: 'Target Customer', description: 'The ideal-customer avatar shown on login — who the business should be targeting', defaultOn: true, navHrefs: ['/target-customer'], routePrefixes: ['/api/target-customer'] },
  { key: 'calendar', label: 'Calendar & Booking', description: 'Appointment calendar and public online booking', defaultOn: false, navHrefs: ['/calendar'], routePrefixes: ['/api/appointments', '/api/calendar', '/api/book', '/api/settings/booking'] },
  { key: 'quotes', label: 'Quotes & Invoices', description: 'Quotes, invoices, payments and the price book', defaultOn: true, navHrefs: ['/quotes', '/price-book'], routePrefixes: ['/api/quotes', '/api/price-book'] },
  { key: 'takeoffs', label: 'Takeoffs & Estimating', description: 'Plan takeoffs and measured estimating', defaultOn: false, navHrefs: ['/takeoffs'], routePrefixes: ['/api/takeoffs'] },
  { key: 'projects', label: 'Projects & Gantt', description: 'Project tracking and Gantt charts', defaultOn: false, navHrefs: ['/gantt', '/projects'], routePrefixes: ['/api/gantt', '/api/projects'] },
  { key: 'companies', label: 'Companies', description: 'Company records linked to leads', defaultOn: false, navHrefs: ['/companies'], routePrefixes: ['/api/companies'] },
  { key: 'expenses', label: 'Expenses & Receipts', description: 'Expense tracking and receipt inbox with OCR', defaultOn: false, navHrefs: ['/expenses', '/receipts'], routePrefixes: ['/api/expenses', '/api/pending-receipts', '/api/receipts'] },
  { key: 'email_inbox', label: 'Email Inbox', description: 'Two-way email sync with leads', defaultOn: false, navHrefs: ['/email-inbox'], routePrefixes: ['/api/email-inbox'] },
  { key: 'live_chat', label: 'Live Chat', description: 'Website live-chat widget and inbox', defaultOn: false, navHrefs: ['/live-chat'], routePrefixes: ['/api/live-chat'] },
  { key: 'automations', label: 'Automations', description: 'Trigger-based workflow automations', defaultOn: false, navHrefs: ['/automations'], routePrefixes: ['/api/automations'] },
  { key: 'tasks', label: 'Tasks', description: 'Team task management', defaultOn: false, navHrefs: ['/tasks'], routePrefixes: ['/api/tasks'] },
  { key: 'reports', label: 'Reports & Analytics', description: 'Reporting dashboards and website analytics', defaultOn: false, navHrefs: ['/reports', '/analytics'], routePrefixes: ['/api/reports', '/api/analytics'] },
  { key: 'campaigns', label: 'Campaigns & Landing Pages', description: 'Email marketing campaigns and landing pages', defaultOn: false, navHrefs: ['/campaigns', '/landing-pages'], routePrefixes: ['/api/campaigns', '/api/landing-pages'] },
  { key: 'social', label: 'Social', description: 'Social media scheduling and publishing', defaultOn: false, navHrefs: ['/social'], routePrefixes: ['/api/social'] },
  { key: 'ads', label: 'Ad Manager', description: 'Google and Meta ad campaign management', defaultOn: false, navHrefs: ['/ads', '/click-quality'], routePrefixes: ['/api/ads', '/api/click-quality'] },
  { key: 'reviews', label: 'Reviews', description: 'Review collection, widget and Google sync', defaultOn: false, navHrefs: ['/reviews'], routePrefixes: ['/api/reviews', '/api/settings/reviews'] },
  { key: 'sops', label: 'SOPs', description: 'Standard operating procedures with AI generation', defaultOn: false, navHrefs: ['/sops'], routePrefixes: ['/api/sops'] },
  { key: 'time', label: 'Time Tracking', description: 'Time entries and timesheets', defaultOn: false, navHrefs: ['/time'], routePrefixes: ['/api/time-entries'] },
  { key: 'gallery', label: 'Website Gallery', description: 'Project photo gallery published to the client website', defaultOn: false, navHrefs: ['/gallery'], routePrefixes: ['/api/gallery'] },
  { key: 'products', label: 'Featured Products', description: 'Featured products/packages shown on the client website', defaultOn: false, navHrefs: ['/products'], routePrefixes: ['/api/featured-items'] },
  { key: 'team', label: 'Team', description: 'Team member profiles for the client website', defaultOn: false, navHrefs: ['/team'], routePrefixes: ['/api/team-members'] },
  { key: 'blog', label: 'Blog', description: 'Blog posts published to the client website', defaultOn: false, navHrefs: ['/blog'], routePrefixes: ['/api/blog-posts'] },
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
