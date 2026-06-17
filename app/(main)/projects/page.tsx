'use client'
import { useState, useEffect } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }
        const data = await res.json()
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format')
        }
        setProjects(data)
      } catch (err) {
        console.error('Fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage all your projects</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600 mb-2">Error: {error}</p>
            <p className="text-slate-500 text-sm">Check browser console for more details</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
            <p>No projects yet</p>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-slate-600 mb-4">Total: {projects.length} project(s)</p>
            <ul className="space-y-2">
              {projects.map((p: any) => (
                <li key={p.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  {p.description && <p className="text-xs text-slate-600 mt-1">{p.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
