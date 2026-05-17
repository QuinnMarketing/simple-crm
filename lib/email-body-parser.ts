// Parses plain-text email bodies from form notification emails into structured lead fields.
// Supports two common formats from WordPress, Elementor, WPForms, Gravity Forms, CF7:
//   Format 1 (same line): "Name: John Smith"
//   Format 2 (next line): "Name\nJohn Smith"

const NAME_LABELS    = ['name', 'full name', 'fullname', 'your name', 'contact name', 'first name', 'customer name', 'client name', 'your full name']
const EMAIL_LABELS   = ['email', 'email address', 'e-mail', 'your email', 'contact email', 'email address']
const PHONE_LABELS   = ['phone', 'phone number', 'mobile', 'mobile number', 'contact phone', 'telephone', 'cell', 'phone no', 'ph', 'mob']
const ADDRESS_LABELS = ['address', 'street address', 'home address', 'location', 'suburb', 'city', 'postcode', 'zip', 'state']
const SERVICE_LABELS = ['service', 'service type', 'services', 'interested in', 'job type', 'project type', 'what service', 'enquiry type', 'type of work', 'work type']
const MESSAGE_LABELS = ['message', 'notes', 'comment', 'comments', 'description', 'enquiry', 'inquiry', 'details', 'how can we help', 'your message', 'additional info', 'additional information', 'info', 'body']

export interface ParsedEmailLead {
  name: string
  email?: string
  phone?: string
  address?: string
  service?: string
  notes?: string
  rawText: string
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function matchLabel(label: string, candidates: string[]): boolean {
  const n = norm(label)
  return candidates.some(c => n === c || n.startsWith(c) || c.startsWith(n))
}

function findIn(extracted: Record<string, string>, candidates: string[]): string | undefined {
  for (const [key, val] of Object.entries(extracted)) {
    if (val && matchLabel(key, candidates)) return val.trim()
  }
  return undefined
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&\w+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseEmailBody(opts: {
  subject?: string
  text?: string
  html?: string
  fromEmail?: string
  fromName?: string
}): ParsedEmailLead {
  const rawText = opts.text ?? (opts.html ? stripHtml(opts.html) : '')
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  const extracted: Record<string, string> = {}

  // Format 1: "Label: Value" on the same line
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx < 60) {
      const label = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (label.length <= 40 && value && !value.startsWith('//')) {
        extracted[norm(label)] = value
      }
    }
  }

  // Format 2: Label on one line, value on the next (WPForms, some CF7 styles)
  for (let i = 0; i < lines.length - 1; i++) {
    const label = lines[i]
    const value = lines[i + 1]
    const n = norm(label)
    // Label: short, no colon, not a URL, not already extracted with a better value
    if (
      label.length < 50 &&
      !label.includes(':') &&
      !label.startsWith('http') &&
      value &&
      !extracted[n]
    ) {
      extracted[n] = value
    }
  }

  let name = findIn(extracted, NAME_LABELS)
  const email = findIn(extracted, EMAIL_LABELS) ?? opts.fromEmail
  const phone = findIn(extracted, PHONE_LABELS)
  const address = findIn(extracted, ADDRESS_LABELS)
  const service = findIn(extracted, SERVICE_LABELS)
  const notes = findIn(extracted, MESSAGE_LABELS)

  if (!name && opts.fromName && !opts.fromName.includes('@')) {
    name = opts.fromName
  }
  if (!name && email) {
    name = email.split('@')[0].replace(/[._+-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
  }

  return { name: name ?? 'Unknown', email, phone, address, service, notes, rawText }
}

// Parse "Display Name <addr@example.com>" or bare address
export function parseFromHeader(from: string): { name?: string; email?: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() }
  if (from.includes('@')) return { email: from.trim() }
  return {}
}
