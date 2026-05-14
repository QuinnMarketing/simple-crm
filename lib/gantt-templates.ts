export interface TaskTemplate {
  name: string
  startOffset: number  // days from project start date
  durationDays: number
  status: string
  progress: number
  notes?: string
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  emoji: string
  category: string
  color: string
  totalWeeks: number
  tasks: TaskTemplate[]
}

export const GANTT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'trade_job',
    name: 'Trade Job',
    description: 'Quote through to invoice for a standard trade/service job',
    emoji: '🔧',
    category: 'Operations',
    color: '#f59e0b',
    totalWeeks: 2,
    tasks: [
      { name: 'Client quote & approval', startOffset: 0, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Materials & equipment order', startOffset: 3, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Site preparation', startOffset: 5, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Main works', startOffset: 6, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Quality inspection & sign-off', startOffset: 11, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Invoice & follow-up', startOffset: 12, durationDays: 1, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'website_launch',
    name: 'Website Launch',
    description: 'Full website project from discovery to go-live',
    emoji: '🌐',
    category: 'Marketing',
    color: '#6366f1',
    totalWeeks: 8,
    tasks: [
      { name: 'Discovery & brief', startOffset: 0, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Wireframes & design concepts', startOffset: 7, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Client feedback & revisions', startOffset: 18, durationDays: 4, status: 'not_started', progress: 0 },
      { name: 'Content creation', startOffset: 14, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Development', startOffset: 22, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Testing & QA', startOffset: 36, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Client review & approval', startOffset: 42, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Launch & go-live', startOffset: 46, durationDays: 1, status: 'not_started', progress: 0, notes: 'DNS propagation may take 24–48hrs' },
      { name: 'Post-launch monitoring', startOffset: 47, durationDays: 7, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'home_renovation',
    name: 'Home Renovation',
    description: 'Full renovation from planning to handover',
    emoji: '🏠',
    category: 'Construction',
    color: '#10b981',
    totalWeeks: 8,
    tasks: [
      { name: 'Scope of works & quote', startOffset: 0, durationDays: 4, status: 'not_started', progress: 0 },
      { name: 'Permits & council approvals', startOffset: 5, durationDays: 10, status: 'not_started', progress: 0, notes: 'Allow extra time if heritage listed' },
      { name: 'Materials procurement', startOffset: 7, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Site preparation & demolition', startOffset: 15, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Structural & rough-in works', startOffset: 18, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Fit-out & finishing', startOffset: 28, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Paint & final details', startOffset: 38, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Final inspection & handover', startOffset: 44, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Defects period', startOffset: 46, durationDays: 7, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'marketing_campaign',
    name: 'Marketing Campaign',
    description: 'End-to-end campaign from strategy to results',
    emoji: '📣',
    category: 'Marketing',
    color: '#ec4899',
    totalWeeks: 6,
    tasks: [
      { name: 'Strategy & brief', startOffset: 0, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Creative development', startOffset: 7, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Approvals & revisions', startOffset: 14, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Campaign setup & scheduling', startOffset: 18, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Campaign live', startOffset: 21, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Monitor & optimise', startOffset: 21, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Results & reporting', startOffset: 36, durationDays: 3, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'event_planning',
    name: 'Event Planning',
    description: 'Corporate or community event from concept to wrap-up',
    emoji: '🎉',
    category: 'Events',
    color: '#8b5cf6',
    totalWeeks: 8,
    tasks: [
      { name: 'Concept, theme & budget', startOffset: 0, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Venue selection & booking', startOffset: 5, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Vendors & suppliers confirmed', startOffset: 7, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Invitations & promotion', startOffset: 14, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Catering & AV finalised', startOffset: 28, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Run sheet & briefings', startOffset: 35, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Event day', startOffset: 42, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Post-event review & follow-up', startOffset: 43, durationDays: 5, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'new_business_launch',
    name: 'New Business Launch',
    description: 'Everything needed to launch a new business',
    emoji: '🚀',
    category: 'Business',
    color: '#0ea5e9',
    totalWeeks: 12,
    tasks: [
      { name: 'Market research & validation', startOffset: 0, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Business plan & financials', startOffset: 7, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Legal structure & registration', startOffset: 14, durationDays: 14, status: 'not_started', progress: 0, notes: 'ABN, ACN, business name registration' },
      { name: 'Branding & logo', startOffset: 21, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Website & social profiles', startOffset: 35, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Banking & accounting setup', startOffset: 28, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Marketing & lead gen setup', startOffset: 42, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Soft launch & testing', startOffset: 56, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Grand opening', startOffset: 63, durationDays: 1, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'onboarding',
    name: 'Staff Onboarding',
    description: 'New employee onboarding over two weeks',
    emoji: '👋',
    category: 'HR',
    color: '#14b8a6',
    totalWeeks: 2,
    tasks: [
      { name: 'Welcome & introductions', startOffset: 0, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Accounts, access & equipment setup', startOffset: 0, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Company policies & procedures review', startOffset: 2, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Role-specific training', startOffset: 4, durationDays: 5, status: 'not_started', progress: 0 },
      { name: 'Buddy / mentoring period', startOffset: 4, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'End of first-week check-in', startOffset: 5, durationDays: 1, status: 'not_started', progress: 0 },
      { name: '2-week performance review', startOffset: 12, durationDays: 1, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'software_sprint',
    name: 'Software Sprint',
    description: '2-week agile development sprint',
    emoji: '💻',
    category: 'Technology',
    color: '#6366f1',
    totalWeeks: 2,
    tasks: [
      { name: 'Sprint planning & backlog grooming', startOffset: 0, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Design & UX', startOffset: 1, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Frontend development', startOffset: 4, durationDays: 6, status: 'not_started', progress: 0 },
      { name: 'Backend development', startOffset: 1, durationDays: 9, status: 'not_started', progress: 0 },
      { name: 'Integration & testing', startOffset: 10, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Code review', startOffset: 11, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Deployment & sprint review', startOffset: 13, durationDays: 1, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'property_sale',
    name: 'Property Sale',
    description: 'Listing to settlement for a real estate sale',
    emoji: '🏡',
    category: 'Real Estate',
    color: '#f59e0b',
    totalWeeks: 10,
    tasks: [
      { name: 'Property appraisal & agent briefing', startOffset: 0, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Styling & photography', startOffset: 4, durationDays: 3, status: 'not_started', progress: 0 },
      { name: 'Marketing campaign live', startOffset: 7, durationDays: 21, status: 'not_started', progress: 0 },
      { name: 'Open homes', startOffset: 7, durationDays: 21, status: 'not_started', progress: 0 },
      { name: 'Offers & negotiation', startOffset: 21, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Contract exchange', startOffset: 28, durationDays: 2, status: 'not_started', progress: 0 },
      { name: 'Pre-settlement inspection', startOffset: 58, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Settlement', startOffset: 60, durationDays: 1, status: 'not_started', progress: 0 },
    ],
  },
  {
    id: 'product_launch',
    name: 'Product Launch',
    description: 'Bring a new product or service to market',
    emoji: '📦',
    category: 'Business',
    color: '#ef4444',
    totalWeeks: 8,
    tasks: [
      { name: 'Product finalisation & pricing', startOffset: 0, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Brand assets & packaging', startOffset: 5, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Landing page & online store', startOffset: 14, durationDays: 10, status: 'not_started', progress: 0 },
      { name: 'Pre-launch marketing & waitlist', startOffset: 21, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Press & influencer outreach', startOffset: 28, durationDays: 7, status: 'not_started', progress: 0 },
      { name: 'Launch day', startOffset: 42, durationDays: 1, status: 'not_started', progress: 0 },
      { name: 'Post-launch ads & promotion', startOffset: 43, durationDays: 14, status: 'not_started', progress: 0 },
      { name: 'Review & iteration', startOffset: 56, durationDays: 5, status: 'not_started', progress: 0 },
    ],
  },
]

export function buildTasksFromTemplate(template: ProjectTemplate, startDate: string): { name: string; startDate: string; endDate: string; status: string; progress: number; notes?: string }[] {
  const base = new Date(startDate + 'T00:00:00')
  return template.tasks.map(t => {
    const s = new Date(base)
    s.setDate(s.getDate() + t.startOffset)
    const e = new Date(s)
    e.setDate(e.getDate() + t.durationDays - 1)
    return {
      name: t.name,
      startDate: s.toISOString().slice(0, 10),
      endDate: e.toISOString().slice(0, 10),
      status: t.status,
      progress: t.progress,
      ...(t.notes ? { notes: t.notes } : {}),
    }
  })
}
