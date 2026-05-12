// Escapes a single cell value for CSV output
function escapeCell(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',')
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','))
  return [header, ...body].join('\r\n')
}

// Parses a CSV string into an array of objects keyed by header row values.
// Handles quoted fields, embedded commas, and escaped double-quotes.
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = splitCsvRows(lines)
  if (rows.length < 2) return []

  const headers = parseRow(rows[0]).map((h) => h.trim().toLowerCase())
  const result: Record<string, string>[] = []

  for (let i = 1; i < rows.length; i++) {
    const cells = parseRow(rows[i])
    if (cells.every((c) => !c.trim())) continue // skip blank rows
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? '').trim() })
    result.push(obj)
  }
  return result
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === '\n' && !inQuote) {
      rows.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) rows.push(current)
  return rows
}

function parseRow(row: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}
