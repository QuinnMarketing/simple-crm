// The landing page content model. The AI fills this in; fixed section
// components render it. Keeping pages as structured copy (never free-form
// HTML) is what makes them safe to serve from our origin, instantly
// editable, and consistently conversion-optimised.

export type LandingPageContent = {
  theme: {
    primaryColor: string // hex — buttons, accents
  }
  hero: {
    badge: string        // trust line above the headline, e.g. "Licensed & Insured · Serving the Hills District"
    headline: string
    subheadline: string
    ctaLabel: string
    backgroundImage: string   // stock photo URL rendered behind a dark overlay; '' = plain dark hero
    imageOptions: string[]    // alternative photo URLs fetched at generation time — editor cycles through these
  }
  benefits: {
    title: string
    items: { title: string; description: string }[]
  }
  offer: {
    enabled: boolean
    title: string        // e.g. "$99 Drain Camera Inspection"
    description: string
    urgency: string      // e.g. "This month only" — keep honest
  }
  reviews: {
    enabled: boolean
    title: string
    items: { name: string; rating: number; text: string }[]
  }
  faq: {
    enabled: boolean
    title: string
    items: { question: string; answer: string }[]
  }
  finalCta: {
    headline: string
    ctaLabel: string
    backgroundImage: string   // optional second photo behind the closing CTA, heavy overlay
  }
  form: {
    title: string
    buttonLabel: string
    fields: string[]     // subset of: name, phone, email, address, message
  }
  thankYou: {
    headline: string
    message: string
  }
  meta: {
    title: string
    description: string
  }
}

export const EMPTY_CONTENT: LandingPageContent = {
  theme: { primaryColor: '#4f46e5' },
  hero: { badge: '', headline: '', subheadline: '', ctaLabel: 'Get a Free Quote', backgroundImage: '', imageOptions: [] },
  benefits: { title: 'Why choose us', items: [] },
  offer: { enabled: false, title: '', description: '', urgency: '' },
  reviews: { enabled: false, title: 'What our customers say', items: [] },
  faq: { enabled: false, title: 'Common questions', items: [] },
  finalCta: { headline: '', ctaLabel: 'Get Started', backgroundImage: '' },
  form: { title: 'Request your free quote', buttonLabel: 'Send Request', fields: ['name', 'phone', 'message'] },
  thankYou: { headline: 'Thanks — we got your request', message: "We'll be in touch shortly." },
  meta: { title: '', description: '' },
}

/** Parses stored content, back-filling anything missing so renderers never see undefined sections. */
export function parseContent(raw: string | null | undefined): LandingPageContent {
  let parsed: Partial<LandingPageContent> = {}
  try { parsed = raw ? JSON.parse(raw) : {} } catch { /* fall through to defaults */ }
  return {
    theme: { ...EMPTY_CONTENT.theme, ...parsed.theme },
    hero: { ...EMPTY_CONTENT.hero, ...parsed.hero },
    benefits: { ...EMPTY_CONTENT.benefits, ...parsed.benefits },
    offer: { ...EMPTY_CONTENT.offer, ...parsed.offer },
    reviews: { ...EMPTY_CONTENT.reviews, ...parsed.reviews },
    faq: { ...EMPTY_CONTENT.faq, ...parsed.faq },
    finalCta: { ...EMPTY_CONTENT.finalCta, ...parsed.finalCta },
    form: { ...EMPTY_CONTENT.form, ...parsed.form },
    thankYou: { ...EMPTY_CONTENT.thankYou, ...parsed.thankYou },
    meta: { ...EMPTY_CONTENT.meta, ...parsed.meta },
  }
}
