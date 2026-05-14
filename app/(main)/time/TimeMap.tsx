'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface MapEntry {
  id: string
  type: string
  typeLabel: string
  typeColor: string
  durationMin: number
  startedAt: string
  description: string | null
  assignedTo: string | null
  leadName: string | null
  latitude: number
  longitude: number
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const TYPE_COLORS: Record<string, string> = {
  call: '#3b82f6',
  meeting: '#a855f7',
  work: '#10b981',
  email: '#f59e0b',
  admin: '#64748b',
  other: '#f43f5e',
}

export default function TimeMap({ entries }: { entries: MapEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || entries.length === 0) return

    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return

      // Fix default marker icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const bounds: [number, number][] = []

      for (const entry of entries) {
        bounds.push([entry.latitude, entry.longitude])

        const color = TYPE_COLORS[entry.type] ?? '#6366f1'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:rotate(-45deg)"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -30],
        })

        const time = new Date(entry.startedAt).toLocaleTimeString('en-AU', {
          hour: 'numeric', minute: '2-digit', hour12: true,
        })
        const date = new Date(entry.startedAt).toLocaleDateString('en-AU', {
          day: 'numeric', month: 'short',
        })

        const popup = `
          <div style="font-family:system-ui,sans-serif;min-width:180px">
            <p style="font-weight:600;color:#0f172a;margin:0 0 4px">${entry.typeLabel}</p>
            ${entry.leadName ? `<p style="color:#6366f1;margin:0 0 2px;font-size:13px">${entry.leadName}</p>` : ''}
            ${entry.description ? `<p style="color:#334155;margin:0 0 4px;font-size:13px">${entry.description}</p>` : ''}
            <p style="color:#64748b;margin:0;font-size:12px">${date} · ${time} · ${fmtDuration(entry.durationMin)}</p>
            ${entry.assignedTo ? `<p style="color:#64748b;margin:2px 0 0;font-size:12px">${entry.assignedTo}</p>` : ''}
          </div>`

        L.marker([entry.latitude, entry.longitude], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 240 })
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 14)
      } else {
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [entries])

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900 text-sm">Location Map</p>
          <p className="text-xs text-slate-400 mt-0.5">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} with location</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            entries.some(e => e.type === type) && (
              <span key={type} className="flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                <span style={{ background: color }} className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" />
                {type}
              </span>
            )
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 340 }} />
    </div>
  )
}
