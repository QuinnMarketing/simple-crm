// Suggested SOP topics per industry — quick-picks in the SOP creation UI.
// Client-safe module: must not import the Anthropic SDK or Prisma, since the
// SOPs list page (a client component) imports this for its industry dropdown.
export const INDUSTRY_SOP_SUGGESTIONS: Record<string, string[]> = {
  Plumbing: ['Emergency callout response', 'Hot water system installation', 'Blocked drain procedure', 'Quoting and invoicing process'],
  Electrical: ['Safety testing and tagging', 'Switchboard upgrade procedure', 'New job compliance checklist', 'Certificate of compliance process'],
  'HVAC / Air Conditioning': ['Split system installation', 'Preventative maintenance visit', 'Refrigerant handling procedure', 'Warranty claim process'],
  'Building / Renovation': ['Site setup and safety induction', 'Variation and change order process', 'Handover and defect inspection', 'Subcontractor onboarding'],
  Landscaping: ['New garden installation workflow', 'Maintenance round procedure', 'Quoting site visits', 'Equipment maintenance schedule'],
  Cleaning: ['End of lease clean checklist', 'New client onboarding', 'Chemical handling and safety', 'Quality inspection process'],
  Painting: ['Surface preparation standards', 'Interior repaint workflow', 'Colour consultation process', 'Final walkthrough checklist'],
  Roofing: ['Roof inspection procedure', 'Working at heights safety', 'Leak detection and repair', 'Insurance claim documentation'],
  General: ['New lead response process', 'Customer complaint handling', 'Invoice follow-up and collections', 'New employee onboarding'],
}
