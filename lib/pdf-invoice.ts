import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

type LineItem = { description: string; quantity: number; unitPrice: number }

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null | string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function hexRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const C = {
  black:  hexRgb('#0f172a'),
  dark:   hexRgb('#1e293b'),
  mid:    hexRgb('#475569'),
  muted:  hexRgb('#94a3b8'),
  light:  hexRgb('#cbd5e1'),
  bg:     hexRgb('#f1f5f9'),
  bgAlt:  hexRgb('#f8fafc'),
  white:  rgb(1, 1, 1),
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

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const { quote, lead, business } = data
  const docType = quote.type === 'invoice' ? 'Invoice' : 'Quote'
  const dueDateLabel = quote.type === 'invoice' ? 'Due Date' : 'Valid Until'
  const items: LineItem[] = JSON.parse(quote.lineItems)

  const pdfDoc = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const MARGIN = 48
  const W = width - MARGIN * 2

  // Y cursor — pdf-lib origin is bottom-left, so we track from the top
  let y = height - MARGIN

  function drawText(text: string, x: number, yPos: number, opts: {
    size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center'; maxWidth?: number
  } = {}) {
    const f = opts.bold ? fontBold : font
    const size = opts.size ?? 10
    const color = opts.color ?? C.dark
    let drawX = x
    if (opts.align === 'right' && opts.maxWidth) {
      drawX = x + opts.maxWidth - f.widthOfTextAtSize(text, size)
    } else if (opts.align === 'center' && opts.maxWidth) {
      drawX = x + (opts.maxWidth - f.widthOfTextAtSize(text, size)) / 2
    }
    page.drawText(text, { x: drawX, y: yPos, size, font: f, color })
  }

  function wrapLines(text: string, maxWidth: number, f: typeof font, size: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // ── Business header ─────────────────────────────────────────────────
  drawText(business.accountName || 'Your Business', MARGIN, y, { size: 20, bold: true, color: C.black })
  y -= 24

  const metaLines = [
    business.abn ? `ABN: ${business.abn}` : null,
    business.businessAddress ?? null,
    [business.businessPhone, business.businessEmail, business.businessWebsite].filter(Boolean).join('   ·   ') || null,
  ].filter(Boolean) as string[]

  for (const line of metaLines) {
    drawText(line, MARGIN, y, { size: 9, color: C.muted })
    y -= 13
  }

  // ── Divider ──────────────────────────────────────────────────────────
  y -= 8
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.5, color: C.light })
  y -= 18

  // ── Doc type + number ────────────────────────────────────────────────
  drawText(docType, MARGIN, y, { size: 26, bold: true, color: C.black })
  y -= 32
  drawText(quote.number, MARGIN, y, { size: 11, color: C.muted })
  y -= 24

  // ── Dates + client ────────────────────────────────────────────────────
  const colL = MARGIN
  const colR = MARGIN + W / 2
  const topY = y

  drawText('ISSUE DATE', colL, y, { size: 8, bold: true, color: C.muted })
  drawText('BILL TO',    colR, y, { size: 8, bold: true, color: C.muted })
  y -= 14

  drawText(fmtDate(quote.issuedAt), colL, y, { size: 10, color: C.dark })
  drawText(lead.name, colR, y, { size: 10, bold: true, color: C.black })
  y -= 14

  drawText(dueDateLabel, colL, y, { size: 8, bold: true, color: C.muted })
  const clientLines = [lead.email, lead.phone, lead.address].filter(Boolean) as string[]
  for (const cl of clientLines) {
    drawText(cl, colR, y, { size: 9, color: C.muted })
    y -= 12
  }
  y -= 2

  drawText(fmtDate(quote.dueAt), colL, y, { size: 10, color: C.dark })
  y = Math.min(y, topY - 60) - 20

  // ── Table header ──────────────────────────────────────────────────────
  const ROW_H = 26
  const cols = {
    desc:  { x: MARGIN,                  w: W * 0.52 },
    qty:   { x: MARGIN + W * 0.52,       w: W * 0.10 },
    price: { x: MARGIN + W * 0.62,       w: W * 0.19 },
    total: { x: MARGIN + W * 0.81,       w: W * 0.19 },
  }

  page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: W, height: ROW_H, color: C.bg })

  const hY = y - ROW_H + 9
  drawText('DESCRIPTION', cols.desc.x + 6,  hY, { size: 8, bold: true, color: C.mid })
  drawText('QTY',         cols.qty.x,  hY, { size: 8, bold: true, color: C.mid, align: 'center', maxWidth: cols.qty.w })
  drawText('UNIT PRICE',  cols.price.x, hY, { size: 8, bold: true, color: C.mid, align: 'right',  maxWidth: cols.price.w })
  drawText('TOTAL',       cols.total.x, hY, { size: 8, bold: true, color: C.mid, align: 'right',  maxWidth: cols.total.w })
  y -= ROW_H

  // ── Rows ──────────────────────────────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const descLines = wrapLines(item.description, cols.desc.w - 12, font, 10)
    const itemH = Math.max(ROW_H, descLines.length * 14 + 12)

    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - itemH, width: W, height: itemH, color: C.bgAlt })
    }

    const rY = y - itemH + (itemH - descLines.length * 14) / 2 + (descLines.length - 1) * 14
    descLines.forEach((line, li) => {
      drawText(line, cols.desc.x + 6, rY - li * 14, { size: 10 })
    })
    const midY = y - itemH / 2 - 5
    drawText(String(item.quantity), cols.qty.x,   midY, { size: 10, align: 'center', maxWidth: cols.qty.w })
    drawText(fmtAUD(item.unitPrice), cols.price.x, midY, { size: 10, align: 'right',  maxWidth: cols.price.w })
    drawText(fmtAUD(item.quantity * item.unitPrice), cols.total.x, midY, { size: 10, align: 'right', maxWidth: cols.total.w })

    page.drawLine({ start: { x: MARGIN, y: y - itemH }, end: { x: width - MARGIN, y: y - itemH }, thickness: 0.5, color: C.bgAlt })
    y -= itemH
  }

  y -= 16

  // ── Totals ────────────────────────────────────────────────────────────
  const totX  = width - MARGIN - 200
  const totW  = 200

  function totalLine(label: string, value: string, bold = false) {
    drawText(label, totX,        y, { size: bold ? 11 : 10, bold, color: bold ? C.black : C.muted })
    drawText(value, totX + 100,  y, { size: bold ? 11 : 10, bold, color: C.black, align: 'right', maxWidth: 100 })
    y -= bold ? 0 : 16
  }

  totalLine('Subtotal', fmtAUD(quote.subtotal))
  totalLine(`GST (${quote.taxRate}%)`, fmtAUD(quote.taxAmount))
  y -= 8
  page.drawRectangle({ x: totX - 8, y: y - 28, width: totW + 8, height: 28, color: C.bg })
  y -= 8
  totalLine('Total', fmtAUD(quote.total), true)
  y -= 28

  // ── Notes ─────────────────────────────────────────────────────────────
  if (quote.notes) {
    y -= 8
    drawText('NOTES', MARGIN, y, { size: 8, bold: true, color: C.muted })
    y -= 14
    const noteLines = wrapLines(quote.notes, W, font, 9)
    for (const line of noteLines) {
      drawText(line, MARGIN, y, { size: 9, color: C.muted })
      y -= 13
    }
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
