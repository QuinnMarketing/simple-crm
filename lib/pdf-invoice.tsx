import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

type LineItem = { description: string; quantity: number; unitPrice: number }

function fmtAUD(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null | string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const s = StyleSheet.create({
  page:          { padding: 48, fontSize: 10, color: '#1e293b', fontFamily: 'Helvetica' },
  bizName:       { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  bizMeta:       { fontSize: 9, color: '#64748b', marginBottom: 2 },
  bizMetaRow:    { fontSize: 9, color: '#64748b', flexDirection: 'row', gap: 12 },
  divider:       { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginTop: 20, marginBottom: 20 },
  docType:       { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
  docNumber:     { fontSize: 11, color: '#64748b', marginBottom: 20 },
  infoRow:       { flexDirection: 'row', marginBottom: 24 },
  infoBlock:     { flex: 1 },
  infoLabel:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 5 },
  infoValue:     { fontSize: 10, color: '#0f172a', marginBottom: 2 },
  infoMuted:     { fontSize: 9, color: '#64748b', marginBottom: 2 },
  tableHeader:   { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 2 },
  tableHeaderTxt:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowAlt:   { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  tableTxt:      { fontSize: 10, color: '#1e293b' },
  col1:          { flex: 6 },
  col2:          { flex: 1, textAlign: 'center' },
  col3:          { flex: 2, textAlign: 'right' },
  col4:          { flex: 2, textAlign: 'right' },
  totalsWrap:    { marginTop: 12, alignItems: 'flex-end' },
  totalRow:      { flexDirection: 'row', width: 220, justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel:    { fontSize: 10, color: '#64748b' },
  totalValue:    { fontSize: 10, color: '#1e293b' },
  totalFinalRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 8, marginTop: 4, backgroundColor: '#f1f5f9', borderRadius: 2 },
  totalFinalLbl: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  totalFinalVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  notesLabel:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 5, marginTop: 24 },
  notesTxt:      { fontSize: 9, color: '#64748b', lineHeight: 1.5 },
})

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

function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const { quote, lead, business } = data
  const docType = quote.type === 'invoice' ? 'Invoice' : 'Quote'
  const dueDateLabel = quote.type === 'invoice' ? 'Due Date' : 'Valid Until'
  const items: LineItem[] = JSON.parse(quote.lineItems)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Business header */}
        <Text style={s.bizName}>{business.accountName}</Text>
        {business.abn && <Text style={s.bizMeta}>ABN: {business.abn}</Text>}
        {business.businessAddress && <Text style={s.bizMeta}>{business.businessAddress}</Text>}
        <View style={s.bizMetaRow}>
          {business.businessPhone && <Text>{business.businessPhone}</Text>}
          {business.businessEmail && <Text>{business.businessEmail}</Text>}
          {business.businessWebsite && <Text>{business.businessWebsite}</Text>}
        </View>

        <View style={s.divider} />

        {/* Doc type + number */}
        <Text style={s.docType}>{docType}</Text>
        <Text style={s.docNumber}>{quote.number}</Text>

        {/* Dates + client */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Issue Date</Text>
            <Text style={s.infoValue}>{fmtDate(quote.issuedAt)}</Text>
            <Text style={{ ...s.infoLabel, marginTop: 12 }}>{dueDateLabel}</Text>
            <Text style={s.infoValue}>{fmtDate(quote.dueAt)}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Bill To</Text>
            <Text style={{ ...s.infoValue, fontFamily: 'Helvetica-Bold' }}>{lead.name}</Text>
            {lead.email    && <Text style={s.infoMuted}>{lead.email}</Text>}
            {lead.phone    && <Text style={s.infoMuted}>{lead.phone}</Text>}
            {lead.address  && <Text style={s.infoMuted}>{lead.address}</Text>}
          </View>
        </View>

        {/* Line items */}
        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderTxt, ...s.col1 }}>Description</Text>
          <Text style={{ ...s.tableHeaderTxt, ...s.col2 }}>Qty</Text>
          <Text style={{ ...s.tableHeaderTxt, ...s.col3 }}>Unit Price</Text>
          <Text style={{ ...s.tableHeaderTxt, ...s.col4 }}>Total</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
            <Text style={{ ...s.tableTxt, ...s.col1 }}>{item.description}</Text>
            <Text style={{ ...s.tableTxt, ...s.col2 }}>{item.quantity}</Text>
            <Text style={{ ...s.tableTxt, ...s.col3 }}>{fmtAUD(item.unitPrice)}</Text>
            <Text style={{ ...s.tableTxt, ...s.col4 }}>{fmtAUD(item.quantity * item.unitPrice)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{fmtAUD(quote.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>GST ({quote.taxRate}%)</Text>
            <Text style={s.totalValue}>{fmtAUD(quote.taxAmount)}</Text>
          </View>
          <View style={s.totalFinalRow}>
            <Text style={s.totalFinalLbl}>Total</Text>
            <Text style={s.totalFinalVal}>{fmtAUD(quote.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesTxt}>{quote.notes}</Text>
          </>
        )}

      </Page>
    </Document>
  )
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const instance = pdf(<InvoicePdf data={data} />)
  return instance.toBuffer() as unknown as Promise<Buffer>
}
