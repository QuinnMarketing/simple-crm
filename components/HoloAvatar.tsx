'use client'
import SvgHolo, { type HoloFact } from './HoloFigure'
import HoloAvatar3D from './HoloAvatar3D'

export type { HoloFact }

// Compact (thumbnails) uses the lightweight SVG; the full hero uses the real
// WebGL 3D scan, which itself falls back to the SVG if WebGL is unavailable.
export default function HoloAvatar({
  name,
  facts = [],
  compact = false,
}: {
  name: string
  facts?: HoloFact[]
  compact?: boolean
}) {
  if (compact) return <SvgHolo name={name} facts={facts} compact />
  return <HoloAvatar3D name={name} facts={facts} />
}
