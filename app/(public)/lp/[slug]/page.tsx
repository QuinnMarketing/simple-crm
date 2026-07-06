import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseContent } from '@/lib/landing-page-types'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import type { Metadata } from 'next'
import LeadForm from './LeadForm'

type Props = { params: Promise<{ slug: string }> }

async function getPage(slug: string) {
  return prisma.landingPage.findUnique({
    where: { slug },
    include: { account: { select: { name: true, businessPhone: true, abn: true, webhookToken: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return {}
  const content = parseContent(page.content)
  return {
    title: content.meta.title || page.name,
    description: content.meta.description || undefined,
    robots: page.status === 'published' ? undefined : { index: false, follow: false },
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`w-4 h-4 ${i <= rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.077 10.1c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  )
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page || !page.account) notFound()

  // Drafts are only visible to logged-in CRM users (preview); the public gets a 404
  const isDraft = page.status !== 'published'
  if (isDraft) {
    const session = await auth()
    if (!session?.user) notFound()
  } else {
    after(async () => {
      await prisma.landingPage.update({ where: { id: page.id }, data: { views: { increment: 1 } } }).catch(() => {})
    })
  }

  const content = parseContent(page.content)
  const c = content
  const accent = c.theme.primaryColor || '#4f46e5'
  const phone = page.account.businessPhone
  const isCallGoal = page.goal === 'call' && !!phone
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined

  const heroCta = isCallGoal ? (
    <a href={telHref} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
      {c.hero.ctaLabel}
    </a>
  ) : (
    <a href="#enquire" className="inline-block px-8 py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>
      {c.hero.ctaLabel}
    </a>
  )

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {isDraft && (
        <div className="bg-amber-400 text-amber-950 text-center text-sm font-semibold py-2">
          Draft preview — this page is not live yet
        </div>
      )}

      {/* Hero */}
      <section
        className="bg-slate-900 text-white bg-cover bg-center"
        style={c.hero.backgroundImage ? { backgroundImage: `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.85)), url(${c.hero.backgroundImage})` } : undefined}
      >
        <div className="max-w-3xl mx-auto px-5 py-16 sm:py-24 text-center">
          {c.hero.badge && (
            <p className="inline-block text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-full px-4 py-1.5 mb-6 bg-white/10 text-white/90">
              {c.hero.badge}
            </p>
          )}
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">{c.hero.headline}</h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">{c.hero.subheadline}</p>
          <div className="mt-8">{heroCta}</div>
          {isCallGoal && phone && <p className="mt-3 text-slate-400 text-sm">Tap to call {phone}</p>}
        </div>
      </section>

      {/* Benefits */}
      {c.benefits.items.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{c.benefits.title}</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {c.benefits.items.map((b, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: accent }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-slate-600 text-sm mt-1">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Offer */}
      {c.offer.enabled && c.offer.title && (
        <section className="px-5 pb-14 sm:pb-20">
          <div className="max-w-3xl mx-auto rounded-2xl p-8 sm:p-10 text-center text-white" style={{ backgroundColor: accent }}>
            <h2 className="text-2xl sm:text-3xl font-extrabold">{c.offer.title}</h2>
            <p className="mt-3 text-white/90 max-w-xl mx-auto">{c.offer.description}</p>
            {c.offer.urgency && <p className="mt-4 inline-block bg-white/15 rounded-full px-4 py-1.5 text-sm font-semibold">{c.offer.urgency}</p>}
          </div>
        </section>
      )}

      {/* Reviews */}
      {c.reviews.enabled && c.reviews.items.length > 0 && (
        <section className="bg-slate-50 px-5 py-14 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{c.reviews.title}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.reviews.items.slice(0, 6).map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-5">
                  <Stars rating={r.rating} />
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">&ldquo;{r.text}&rdquo;</p>
                  <p className="text-sm font-semibold text-slate-900 mt-3">{r.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.faq.enabled && c.faq.items.length > 0 && (
        <section className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{c.faq.title}</h2>
          <div className="space-y-4">
            {c.faq.items.map((f, i) => (
              <details key={i} className="group rounded-xl border border-slate-200 p-5">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  {f.question}
                  <span className="text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="text-slate-600 mt-3">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA + form */}
      <section
        id="enquire"
        className="bg-slate-900 text-white px-5 py-14 sm:py-20 bg-cover bg-center"
        style={c.finalCta.backgroundImage ? { backgroundImage: `linear-gradient(rgba(2,6,23,0.88), rgba(2,6,23,0.92)), url(${c.finalCta.backgroundImage})` } : undefined}
      >
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold">{c.finalCta.headline}</h2>
          {isCallGoal && (
            <div className="mt-6">
              <a href={telHref} className="inline-block px-8 py-4 rounded-xl text-white font-bold text-lg" style={{ backgroundColor: accent }}>
                {c.finalCta.ctaLabel}
              </a>
              <p className="mt-6 mb-2 text-slate-400 text-sm">Prefer we call you back?</p>
            </div>
          )}
          <div className="bg-white rounded-2xl p-6 sm:p-8 mt-6 text-left">
            <LeadForm
              webhookToken={page.account.webhookToken}
              title={c.form.title}
              buttonLabel={c.form.buttonLabel}
              fields={c.form.fields}
              thankYouHeadline={c.thankYou.headline}
              thankYouMessage={c.thankYou.message}
              primaryColor={accent}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 text-center text-sm px-5 py-8">
        <p className="font-semibold text-slate-300">{page.account.name}</p>
        <p className="mt-1">
          {phone && <span>{phone}</span>}
          {phone && page.account.abn && <span> · </span>}
          {page.account.abn && <span>ABN {page.account.abn}</span>}
        </p>
      </footer>

      {/* Sticky mobile call bar */}
      {isCallGoal && (
        <div className="fixed bottom-0 inset-x-0 sm:hidden p-3 bg-white/95 backdrop-blur border-t border-slate-200">
          <a href={telHref} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-bold" style={{ backgroundColor: accent }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            Call Now — {phone}
          </a>
        </div>
      )}
    </div>
  )
}
