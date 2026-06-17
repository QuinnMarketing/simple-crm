'use client'
import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Loader2, Edit2, Trash2, Eye } from 'lucide-react'
import ProjectModal from './ProjectModal'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Delete project?')) return
    await fetch(`/api/gantt/projects/${id}`, { method: 'DELETE' })
    setProjects(projects.filter(p => p.id !== id))
  }

  const handleSave = () => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
    setShowModal(false)
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-1">Manage all your projects</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Projects</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{projects.length}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase">Matching Search</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{filtered.length}</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
            <FolderOpen className="w-12 h-12 opacity-50" />
            <p>{projects.length === 0 ? 'No projects yet' : 'No matches'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color || '#6366f1' }} />
                      <span className="font-medium text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{p.description || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(p.createdAt).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={`/gantt?project=${p.id}`} className="p-1 hover:text-blue-600 text-slate-400">
                        <Eye className="w-4 h-4" />
                      </a>
                      <button onClick={() => { setEditing(p); setShowModal(true) }} className="p-1 hover:text-indigo-600 text-slate-400">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1 hover:text-red-600 text-slate-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <ProjectModal project={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}
