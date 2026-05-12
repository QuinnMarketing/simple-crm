'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Zap } from 'lucide-react'
import Sidebar from './Sidebar'

type SidebarUser = { name?: string | null; email?: string | null; role?: string; accountId?: string | null }
type SidebarAccount = { id: string; name: string }

export default function SidebarShell({
  user,
  accountName,
  accounts = [],
}: {
  user: SidebarUser
  accountName?: string | null
  accounts?: SidebarAccount[]
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar whenever route changes
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900 flex items-center px-4 gap-3 shadow-lg">
        <button
          onClick={() => setOpen(true)}
          className="text-slate-300 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold">Simple CRM</span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, slide-in on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          user={user}
          accountName={accountName}
          accounts={accounts}
          onClose={() => setOpen(false)}
        />
      </div>
    </>
  )
}
