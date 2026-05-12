import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  TableLayoutType, HeadingLevel,
} from 'docx'

type LineItem = { description: string; quantity: number; unitPrice: number }

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null | string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

type BusinessInfo = {
  accountName: string
  abn?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  businessEmail?: string | null
  businessWebsite?: string | null
}

type QuoteData = {
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

type LeadData = {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  service: string | null
}

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const CELL_BORDERS = { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE }

function txt(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color, italics: opts.italics })
}

function spacer(lines = 1) {
  return new Paragraph({ children: [txt('')], spacing: { before: lines * 80, after: 0 } })
}

function cell(text: string, opts: {
  bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  shade?: boolean; width?: number
} = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [txt(text, { bold: opts.bold, size: opts.size ?? 22, color: opts.color })],
      alignment: opts.align ?? AlignmentType.LEFT,
    })],
    borders: CELL_BORDERS,
    shading: opts.shade ? { type: ShadingType.SOLID, color: 'F1F5F9' } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  })
}

export async function generateDefaultDocx(
  business: BusinessInfo,
  quote: QuoteData,
  lead: LeadData
): Promise<Buffer> {
  const docType = quote.type === 'invoice' ? 'Invoice' : 'Quote'
  const dueDateLabel = quote.type === 'invoice' ? 'Due Date' : 'Valid Until'
  const items: LineItem[] = JSON.parse(quote.lineItems)

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
        },
      },
      children: [
        // ── Business header ──
        new Paragraph({
          children: [txt(business.accountName, { bold: true, size: 36, color: '1E293B' })],
          spacing: { before: 0, after: 60 },
        }),
        ...(business.abn ? [new Paragraph({
          children: [txt(`ABN: ${business.abn}`, { size: 20, color: '64748B' })],
          spacing: { after: 40 },
        })] : []),
        ...(business.businessAddress ? [new Paragraph({
          children: [txt(business.businessAddress, { size: 20, color: '64748B' })],
          spacing: { after: 40 },
        })] : []),
        new Paragraph({
          children: [
            ...(business.businessPhone ? [txt(business.businessPhone, { size: 20, color: '64748B' })] : []),
            ...(business.businessPhone && business.businessEmail ? [txt('   |   ', { size: 20, color: 'CBD5E1' })] : []),
            ...(business.businessEmail ? [txt(business.businessEmail, { size: 20, color: '64748B' })] : []),
            ...(business.businessWebsite ? [txt('   |   ', { size: 20, color: 'CBD5E1' })] : []),
            ...(business.businessWebsite ? [txt(business.businessWebsite, { size: 20, color: '64748B' })] : []),
          ],
          spacing: { after: 0 },
        }),

        spacer(2),

        // ── Horizontal rule (thin table) ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [new TableRow({
            children: [new TableCell({
              children: [new Paragraph({ children: [] })],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE,
              },
              width: { size: 100, type: WidthType.PERCENTAGE },
            })],
          })],
          borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
        }),

        spacer(2),

        // ── Document type + number ──
        new Paragraph({
          children: [txt(`${docType}`, { bold: true, size: 52, color: '0F172A' })],
          spacing: { before: 0, after: 80 },
        }),
        new Paragraph({
          children: [txt(quote.number, { size: 24, color: '64748B' })],
          spacing: { after: 0 },
        }),

        spacer(2),

        // ── Dates + Client — side by side ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell('Issue Date', { bold: true, size: 18, color: '64748B', width: 25 }),
                cell('', { width: 5 }),
                cell('Bill To', { bold: true, size: 18, color: '64748B', width: 45 }),
                cell('', { width: 25 }),
              ],
            }),
            new TableRow({
              children: [
                cell(fmtDate(quote.issuedAt), { size: 20, width: 25 }),
                cell('', { width: 5 }),
                cell(lead.name, { bold: true, size: 22, width: 45 }),
                cell('', { width: 25 }),
              ],
            }),
            new TableRow({
              children: [
                cell('', { width: 25 }),
                cell('', { width: 5 }),
                ...(lead.email ? [cell(lead.email, { size: 20, color: '64748B', width: 45 })] : [cell('', { width: 45 })]),
                cell('', { width: 25 }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [txt(dueDateLabel, { bold: true, size: 18, color: '64748B' })], spacing: { before: 120 } }),
                    new Paragraph({ children: [txt(fmtDate(quote.dueAt), { size: 20 })], spacing: { after: 0 } }),
                  ],
                  borders: CELL_BORDERS,
                  width: { size: 25, type: WidthType.PERCENTAGE },
                }),
                cell('', { width: 5 }),
                ...(lead.phone ? [cell(lead.phone, { size: 20, color: '64748B', width: 45 })] : [cell('', { width: 45 })]),
                cell('', { width: 25 }),
              ],
            }),
            ...(lead.address ? [new TableRow({
              children: [
                cell('', { width: 25 }),
                cell('', { width: 5 }),
                cell(lead.address, { size: 20, color: '64748B', width: 45 }),
                cell('', { width: 25 }),
              ],
            })] : []),
          ],
          borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
        }),

        spacer(2),

        // ── Line items table ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            // Header row
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [txt('Description', { bold: true, size: 20, color: '475569' })], alignment: AlignmentType.LEFT })],
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: BORDER_NONE, right: BORDER_NONE },
                  width: { size: 55, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt('Qty', { bold: true, size: 20, color: '475569' })], alignment: AlignmentType.CENTER })],
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: BORDER_NONE, right: BORDER_NONE },
                  width: { size: 10, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt('Unit Price', { bold: true, size: 20, color: '475569' })], alignment: AlignmentType.RIGHT })],
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: BORDER_NONE, right: BORDER_NONE },
                  width: { size: 18, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt('Total', { bold: true, size: 20, color: '475569' })], alignment: AlignmentType.RIGHT })],
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, left: BORDER_NONE, right: BORDER_NONE },
                  width: { size: 17, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
              ],
            }),
            // Item rows
            ...items.map((item, i) => new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [txt(item.description, { size: 22 })] })],
                  shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: 'F8FAFC' } : undefined,
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'F1F5F9' }, left: BORDER_NONE, right: BORDER_NONE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(String(item.quantity), { size: 22 })], alignment: AlignmentType.CENTER })],
                  shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: 'F8FAFC' } : undefined,
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'F1F5F9' }, left: BORDER_NONE, right: BORDER_NONE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(fmtAUD(item.unitPrice), { size: 22 })], alignment: AlignmentType.RIGHT })],
                  shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: 'F8FAFC' } : undefined,
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'F1F5F9' }, left: BORDER_NONE, right: BORDER_NONE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(fmtAUD(item.quantity * item.unitPrice), { size: 22 })], alignment: AlignmentType.RIGHT })],
                  shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: 'F8FAFC' } : undefined,
                  borders: { top: BORDER_NONE, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'F1F5F9' }, left: BORDER_NONE, right: BORDER_NONE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
              ],
            })),
          ],
          borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
        }),

        spacer(1),

        // ── Totals ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell('', { width: 60 }),
                new TableCell({
                  children: [new Paragraph({ children: [txt('Subtotal', { size: 20, color: '64748B' })], alignment: AlignmentType.RIGHT })],
                  borders: CELL_BORDERS,
                  width: { size: 24, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(fmtAUD(quote.subtotal), { size: 20 })], alignment: AlignmentType.RIGHT })],
                  borders: CELL_BORDERS,
                  width: { size: 16, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                }),
              ],
            }),
            new TableRow({
              children: [
                cell('', { width: 60 }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(`GST (${quote.taxRate}%)`, { size: 20, color: '64748B' })], alignment: AlignmentType.RIGHT })],
                  borders: CELL_BORDERS,
                  width: { size: 24, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(fmtAUD(quote.taxAmount), { size: 20 })], alignment: AlignmentType.RIGHT })],
                  borders: CELL_BORDERS,
                  width: { size: 16, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                }),
              ],
            }),
            new TableRow({
              children: [
                cell('', { width: 60 }),
                new TableCell({
                  children: [new Paragraph({ children: [txt('Total', { bold: true, size: 26, color: '0F172A' })], alignment: AlignmentType.RIGHT })],
                  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  width: { size: 24, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [txt(fmtAUD(quote.total), { bold: true, size: 26, color: '0F172A' })], alignment: AlignmentType.RIGHT })],
                  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                  shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
                  width: { size: 16, type: WidthType.PERCENTAGE },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                }),
              ],
            }),
          ],
          borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
        }),

        // ── Notes ──
        ...(quote.notes ? [
          spacer(2),
          new Paragraph({ children: [txt('Notes', { bold: true, size: 20, color: '475569' })], spacing: { after: 60 } }),
          new Paragraph({ children: [txt(quote.notes, { size: 20, color: '64748B', italics: true })], spacing: { after: 0 } }),
        ] : []),
      ],
    }],
  })

  return Packer.toBuffer(doc) as Promise<Buffer>
}
