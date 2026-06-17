'use client'
import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Loader2, Edit2, Trash2, Eye } from 'lucide-react'
import ProjectModal from './ProjectModal'

type Project = {
  id: string
  name: string
  description: string | null
  color: string
  createdAt: string
  updatedAt: string
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU')
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/gantt/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This action cannot be undone.')) return
    try {
      const res = await fetch(`/api/gantt/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const handleSave = async () => {
    const res = await fetch('/api/gantt/projects')
    if (res.ok) {
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    }
    setShowModal(false)
    setEditingProject(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage all your projects</p>
        </div>
        <button
          onClick={() => {
            setEditingProject(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Projects</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{projects.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
            <p>{projects.length === 0 ? 'No projects yet' : 'No projects match your search'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Created</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-medium text-slate-900">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">
                      {project.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {fmtDate(project.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/gantt?project=${project.id}`}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="View in Gantt"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => {
                            setEditingProject(project)
                            setShowModal(true)
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => {
            setShowModal(false)
            setEditingProject(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
