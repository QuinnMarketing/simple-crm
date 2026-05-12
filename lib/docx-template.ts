import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

type LineItem = { description: string; quantity: number; unitPrice: number }

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export type TemplateData = {
  quote: {
    type: string
    number: string
    status: string
    lineItems: string
    subtotal: number
    taxRate: number
    taxAmount: number
    total: number
    notes: string | null
    issuedAt: Date | null
    dueAt: Date | null
  }
  lead: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    service: string | null
  }
  accountName: string
}

export function fillTemplate(templateBuffer: Buffer, data: TemplateData): Buffer {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  const items: LineItem[] = JSON.parse(data.quote.lineItems)

  doc.render({
    type: data.quote.type === 'invoice' ? 'Invoice' : 'Quote',
    number: data.quote.number,
    status: data.quote.status,
    issued_date: fmtDate(data.quote.issuedAt),
    due_date: fmtDate(data.quote.dueAt),
    client_name: data.lead.name,
    client_email: data.lead.email ?? '',
    client_phone: data.lead.phone ?? '',
    client_address: data.lead.address ?? '',
    service: data.lead.service ?? '',
    notes: data.quote.notes ?? '',
    subtotal: fmtAUD(data.quote.subtotal),
    tax_rate: `${data.quote.taxRate}%`,
    tax_amount: fmtAUD(data.quote.taxAmount),
    total: fmtAUD(data.quote.total),
    account_name: data.accountName,
    items: items.map((li) => ({
      description: li.description,
      qty: String(li.quantity),
      unit_price: fmtAUD(li.unitPrice),
      line_total: fmtAUD(li.quantity * li.unitPrice),
    })),
  })

  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
}
