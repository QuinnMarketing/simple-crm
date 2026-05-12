import PDFDocument from 'pdfkit'

type LineItem = { description: string; quantity: number; unitPrice: number }

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null | string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export type InvoicePdfData = {
  quote: {
    type: string; number: string; status: string
    lineItems: string; subtotal: number; taxRate: number; taxAmount: number; total: number
    notes: string | null; issuedAt: Date | null; dueAt: Date | null
  }
  lead: { name: string; email: string | null; phone: string | null; address: string | null; service: string | null }
  business: {
    accountName: string; abn?: string | null; businessAddress?: string | null
    businessPhone?: string | null; businessEmail?: string | null; businessWebsite?: string | null
  }
}

const MARGIN = 48
const PAGE_WIDTH = 595.28  // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const SLATE_900 = '#0f172a'
const SLATE_700 = '#334155'
const SLATE_500 = '#64748b'
const SLATE_300 = '#cbd5e1'
const SLATE_100 = '#f1f5f9'
const INDIGO   = '#4f46e5'

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { quote, lead, business } = data
    const docType = quote.type === 'invoice' ? 'Invoice' : 'Quote'
    const dueDateLabel = quote.type === 'invoice' ? 'Due Date' : 'Valid Until'
    const items: LineItem[] = JSON.parse(quote.lineItems)

    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    let y = MARGIN

    // ── Business name ──────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(20).fillColor(SLATE_900)
       .text(business.accountName || 'Your Business', MARGIN, y)
    y = doc.y + 4

    doc.font('Helvetica').fontSize(9).fillColor(SLATE_500)
    if (business.abn) {
      doc.text(`ABN: ${business.abn}`, MARGIN, y)
      y = doc.y + 2
    }
    if (business.businessAddress) {
      doc.text(business.businessAddress, MARGIN, y)
      y = doc.y + 2
    }
    const contactParts = [business.businessPhone, business.businessEmail, business.businessWebsite].filter(Boolean)
    if (contactParts.length) {
      doc.text(contactParts.join('   ·   '), MARGIN, y)
      y = doc.y
    }

    // ── Divider ────────────────────────────────────────────────────────
    y += 16
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.5).strokeColor(SLATE_300).stroke()
    y += 16

    // ── Doc type + number ───────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(26).fillColor(SLATE_900).text(docType, MARGIN, y)
    y = doc.y + 4
    doc.font('Helvetica').fontSize(11).fillColor(SLATE_500).text(quote.number, MARGIN, y)
    y = doc.y + 20

    // ── Dates + client ──────────────────────────────────────────────────
    const colL = MARGIN
    const colR = MARGIN + CONTENT_WIDTH / 2

    doc.font('Helvetica-Bold').fontSize(8).fillColor(SLATE_500)
       .text('ISSUE DATE', colL, y).text('BILL TO', colR, y)
    y += 14

    doc.font('Helvetica').fontSize(10).fillColor(SLATE_900)
       .text(fmtDate(quote.issuedAt), colL, y)

    doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE_900)
       .text(lead.name, colR, y)
    y = doc.y + 4

    doc.font('Helvetica-Bold').fontSize(8).fillColor(SLATE_500)
       .text(dueDateLabel, colL, y)
    doc.font('Helvetica').fontSize(9).fillColor(SLATE_500)
    const clientLines = [lead.email, lead.phone, lead.address].filter(Boolean)
    clientLines.forEach((line) => { doc.text(line!, colR, y); y = doc.y + 2 })

    y = Math.max(y, doc.y) + 8

    doc.font('Helvetica').fontSize(10).fillColor(SLATE_900)
       .text(fmtDate(quote.dueAt), colL, y)
    y = doc.y + 24

    // ── Line items table ────────────────────────────────────────────────
    const col = {
      desc:  { x: MARGIN,                     w: CONTENT_WIDTH * 0.52 },
      qty:   { x: MARGIN + CONTENT_WIDTH * 0.52, w: CONTENT_WIDTH * 0.10 },
      price: { x: MARGIN + CONTENT_WIDTH * 0.62, w: CONTENT_WIDTH * 0.19 },
      total: { x: MARGIN + CONTENT_WIDTH * 0.81, w: CONTENT_WIDTH * 0.19 },
    }
    const ROW_H = 26

    // Header row background
    doc.rect(MARGIN, y, CONTENT_WIDTH, ROW_H).fill(SLATE_100)

    doc.font('Helvetica-Bold').fontSize(8).fillColor(SLATE_700)
    const hY = y + 9
    doc.text('DESCRIPTION', col.desc.x + 6, hY, { width: col.desc.w })
    doc.text('QTY',   col.qty.x,   hY, { width: col.qty.w,   align: 'center' })
    doc.text('PRICE', col.price.x, hY, { width: col.price.w, align: 'right' })
    doc.text('TOTAL', col.total.x, hY, { width: col.total.w, align: 'right' })
    y += ROW_H

    items.forEach((item, i) => {
      const rowH = 28
      if (i % 2 === 1) doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill('#f8fafc')
      const tY = y + 9
      doc.font('Helvetica').fontSize(10).fillColor(SLATE_900)
         .text(item.description, col.desc.x + 6, tY, { width: col.desc.w - 6 })
      doc.text(String(item.quantity), col.qty.x, tY, { width: col.qty.w, align: 'center' })
         .text(fmtAUD(item.unitPrice), col.price.x, tY, { width: col.price.w, align: 'right' })
         .text(fmtAUD(item.quantity * item.unitPrice), col.total.x, tY, { width: col.total.w, align: 'right' })

      // bottom border
      doc.moveTo(MARGIN, y + rowH).lineTo(PAGE_WIDTH - MARGIN, y + rowH)
         .lineWidth(0.5).strokeColor('#e2e8f0').stroke()
      y += rowH
    })

    y += 16

    // ── Totals ──────────────────────────────────────────────────────────
    const totX = PAGE_WIDTH - MARGIN - 200
    const totW = 200

    function totalRow(label: string, value: string, bold = false) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10)
         .fillColor(bold ? SLATE_900 : SLATE_500)
         .text(label, totX, y, { width: 110 })
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10)
         .fillColor(SLATE_900)
         .text(value, totX + 110, y, { width: 90, align: 'right' })
      y = doc.y + (bold ? 0 : 4)
    }

    totalRow('Subtotal', fmtAUD(quote.subtotal))
    totalRow(`GST (${quote.taxRate}%)`, fmtAUD(quote.taxAmount))

    y += 6
    doc.rect(totX - 8, y, totW + 8, 30).fill(SLATE_100)
    y += 6
    totalRow('Total', fmtAUD(quote.total), true)
    y += 16

    // ── Notes ────────────────────────────────────────────────────────────
    if (quote.notes) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(SLATE_500).text('NOTES', MARGIN, y)
      y = doc.y + 6
      doc.font('Helvetica').fontSize(9).fillColor(SLATE_500)
         .text(quote.notes, MARGIN, y, { width: CONTENT_WIDTH })
    }

    doc.end()
  })
}
