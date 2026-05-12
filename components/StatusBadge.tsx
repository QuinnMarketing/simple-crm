const STATUS_MAP: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-800' },
  contacted: { label: 'Contacted', className: 'bg-yellow-100 text-yellow-800' },
  qualified: { label: 'Qualified', className: 'bg-purple-100 text-purple-800' },
  won: { label: 'Won', className: 'bg-green-100 text-green-800' },
  lost: { label: 'Lost', className: 'bg-red-100 text-red-800' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
