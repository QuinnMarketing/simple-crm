export interface ParsedLead {
  name: string
  email?: string
  phone?: string
  service?: string
  notes?: string
  source?: string
  gclid?: string
  fbclid?: string
  fbp?: string
  fbc?: string
  pageUrl?: string
  formData: string
}

const NAME_KEYS = ['name', 'full_name', 'fullname', 'full name', 'your_name', 'contact_name', 'firstname', 'first_name', 'customer_name']
const EMAIL_KEYS = ['email', 'email_address', 'your_email', 'contact_email', 'emailaddress']
const PHONE_KEYS = ['phone', 'phone_number', 'mobile', 'mobile_number', 'contact_phone', 'tel', 'telephone', 'phonenumber']
const SERVICE_KEYS = ['service', 'service_type', 'services', 'what_service', 'interested_in', 'job_type', 'project_type']
const MESSAGE_KEYS = ['message', 'notes', 'comment', 'comments', 'description', 'enquiry', 'inquiry', 'details', 'how_can_we_help']

function findField(flat: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const variants = [key, key.replace(/_/g, ' '), key.replace(/_/g, '-'), key.replace(/_/g, '')]
    for (const v of variants) {
      const found = flat[v] ?? flat[v.toLowerCase()] ?? flat[v.toUpperCase()]
      if (found && typeof found === 'string' && found.trim()) return found.trim()
    }
  }
  return undefined
}

function parseElementor(body: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  const raw = body.fields

  // fields can be an array or a keyed object depending on Elementor version
  const fieldList: Array<Record<string, unknown>> = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
    ? Object.values(raw as Record<string, unknown>)
    : []

  for (const field of fieldList) {
    const value = field.value != null ? String(field.value).trim() : ''
    if (!value) continue
    if (field.id) result[String(field.id).toLowerCase()] = value
    if (field.title) {
      const slug = String(field.title).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      result[slug] = value
    }
  }

  return result
}

function parseTypeform(body: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  const response = body.form_response as Record<string, unknown>
  if (!response) return result

  const answers = (response.answers as Array<Record<string, unknown>>) ?? []
  const fields = ((response.definition as Record<string, unknown>)?.fields as Array<Record<string, unknown>>) ?? []

  answers.forEach((answer, i) => {
    const field = fields[i]
    const label = ((field?.title as string) ?? `field_${i}`).toLowerCase().replace(/\s+/g, '_')
    let value: string | undefined

    if (answer.type === 'email') value = answer.email as string
    else if (answer.type === 'phone_number') value = answer.phone_number as string
    else if (answer.type === 'short_text' || answer.type === 'long_text') value = answer.text as string
    else if (answer.type === 'choice') value = (answer.choice as Record<string, unknown>)?.label as string
    else if (answer.type === 'number') value = String(answer.number)

    if (value) result[label] = value
  })

  const hidden = (response.hidden as Record<string, string>) ?? {}
  Object.assign(result, hidden)

  return result
}

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}_${key}` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flatten(val as Record<string, unknown>, k))
    } else if (val !== null && val !== undefined && val !== '') {
      result[k] = String(val)
      result[k.toLowerCase()] = String(val)
    }
  }
  return result
}

function extractAttribution(url: string): Record<string, string> {
  try {
    const params = new URL(url).searchParams
    const result: Record<string, string> = {}
    const pick = (keys: string[]) => {
      for (const k of keys) {
        const v = params.get(k)
        if (v) return v
      }
    }
    const gclid = pick(['gclid'])
    const fbclid = pick(['fbclid'])
    const fbp = pick(['_fbp', 'fbp'])
    const fbc = pick(['_fbc', 'fbc'])
    if (gclid) result.gclid = gclid
    if (fbclid) result.fbclid = fbclid
    if (fbp) result.fbp = fbp
    if (fbc) result.fbc = fbc
    return result
  } catch {
    return {}
  }
}

export function parseWebhookPayload(body: Record<string, unknown>): ParsedLead {
  const raw = JSON.stringify(body)

  let flat: Record<string, string>
  if (body.form_response) {
    flat = parseTypeform(body)
  } else if (body.fields && (body.form_name !== undefined || body.form_id !== undefined)) {
    flat = parseElementor(body)
  } else {
    flat = flatten(body)
  }

  const name = findField(flat, NAME_KEYS) ?? 'Unknown'
  const email = findField(flat, EMAIL_KEYS)
  const phone = findField(flat, PHONE_KEYS)
  const service = findField(flat, SERVICE_KEYS)
  const notes = findField(flat, MESSAGE_KEYS)
  const pageUrl = flat.page_url ?? flat.pageUrl ?? flat.url ?? flat.source_url ?? flat.referrer
    ?? flat.embed_url ?? flat.current_url ?? flat.entry_url ?? flat.form_url

  // Attribution: prefer explicit flat fields, fall back to parsing the page URL query string
  const urlAttrib = pageUrl ? extractAttribution(pageUrl) : {}
  const gclid = flat.gclid ?? urlAttrib.gclid
  const fbclid = flat.fbclid ?? urlAttrib.fbclid
  const fbp = flat['_fbp'] ?? flat.fbp ?? urlAttrib.fbp
  const fbc = flat['_fbc'] ?? flat.fbc ?? urlAttrib.fbc

  return { name, email, phone, service, notes, gclid, fbclid, fbp, fbc, pageUrl, formData: raw }
}
