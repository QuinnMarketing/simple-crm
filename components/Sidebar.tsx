'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Users, Settings, LogOut, Zap, Building2, ChevronDown, Layers, CalendarDays, FileText, Bot, Clock, Mail, MailOpen, TrendingUp, BarChart2, Share2, GanttChartSquare, CheckSquare, Star, BookOpen, Receipt, FolderOpen, Ruler, Inbox, Target, Rocket, MessagesSquare, ClipboardList, Image as ImageIcon, ShoppingBag, Crosshair, UserSquare2, Newspaper } from 'lucide-react'
import { signOut } from 'next-auth/react'
import PushToggle from './PushToggle'
import { moduleForNavHref } from '@/lib/modules'

type SidebarUser = {
  name?: string | null
  email?: string | null
  role?: string
  accountId?: string | null
  accountIds?: string[] | null
}

type SidebarAccount = { id: string; name: string }

type NavItem = { href: string; icon: React.ElementType; label: string; match?: string }

const MASTER_NAV: NavItem[] = [
  { href: '/accounts', icon: Layers, label: 'Accounts' },
]

export default function Sidebar({
  user,
  accountName,
  accounts: accountsProp = [],
  enabledModules = [],
  onClose,
}: {
  user: SidebarUser
  accountName?: string | null
  accounts?: SidebarAccount[]
  enabledModules?: string[]
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const sp = useSearchParams()
  const activeAccountId = sp.get('account')

  const isMasterAdmin = user.role === 'master_admin'
  const isMultiAccount = !isMasterAdmin && (user.accountIds?.length ?? 0) > 1
  const accounts = accountsProp

  const [accountOpen, setAccountOpen] = useState(false)

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null

  function switchAccount(accountId: string | null) {
    const params = new URLSearchParams(sp.toString())
    if (accountId) params.set('account', accountId)
    else params.delete('account')
    setAccountOpen(false)
    const qs = params.toString()
    router.push(pathname + (qs ? `?${qs}` : ''))
  }

  function navHref(base: string) {
    const params = new URLSearchParams()
    if ((isMasterAdmin || isMultiAccount) && activeAccountId) params.set('account', activeAccountId)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  const fullNav: NavItem[] = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/target-customer', icon: Crosshair, label: 'Target Customer' },
    { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
    { href: '/leads', icon: Users, label: 'Leads', match: '/leads' },
    { href: '/quotes', icon: FileText, label: 'Quotes & Invoices' },
    { href: '/takeoffs', icon: Ruler, label: 'Takeoffs & Estimating' },
    { href: '/price-book', icon: BookOpen, label: 'Price Book' },
    { href: '/gallery', icon: ImageIcon, label: 'Website Gallery' },
    { href: '/products', icon: ShoppingBag, label: 'Featured Products' },
    { href: '/team', icon: UserSquare2, label: 'Team' },
    { href: '/blog', icon: Newspaper, label: 'Blog' },
    { href: '/gantt', icon: GanttChartSquare, label: 'Gantt Charts' },
    { href: '/companies', icon: Building2, label: 'Companies' },
    { href: '/projects', icon: FolderOpen, label: 'Projects' },
    { href: '/expenses', icon: Receipt, label: 'Expenses' },
    { href: '/receipts', icon: Inbox, label: 'Receipts' },
    { href: '/email-inbox', icon: MailOpen, label: 'Email Inbox' },
    { href: '/live-chat', icon: MessagesSquare, label: 'Live Chat' },
    { href: '/automations', icon: Bot, label: 'Automations' },
    { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { href: '/reports', icon: BarChart2, label: 'Reports' },
    { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
    { href: '/campaigns', icon: Mail, label: 'Campaigns' },
    { href: '/landing-pages', icon: Rocket, label: 'Landing Pages' },
    { href: '/social', icon: Share2, label: 'Social' },
    { href: '/ads', icon: Target, label: 'Ad Manager' },
    { href: '/reviews', icon: Star, label: 'Reviews' },
    { href: '/sops', icon: ClipboardList, label: 'SOPs' },
    { href: '/time', icon: Clock, label: 'Time Tracking' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  // Gate each nav item by its owning module — core items (no module) always show
  const moduleSet = new Set(enabledModules)
  const baseNav = fullNav.filter((item) => {
    const mod = moduleForNavHref(item.href)
    return mod === null || moduleSet.has(mod)
  })
  const allNav: NavItem[] = isMasterAdmin ? [...MASTER_NAV, ...baseNav] : baseNav

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-10">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Simple CRM</span>
        </div>
      </div>

      {/* Account section */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800 relative">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Account</p>
        {isMasterAdmin || isMultiAccount ? (
          <>
            <button
              onClick={() => setAccountOpen(!accountOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-white font-medium truncate">
                  {activeAccount
                    ? activeAccount.name
                    : isMasterAdmin
                      ? 'All Accounts'
                      : (accounts[0]?.name ?? 'Select account')}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>
            {accountOpen && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-slate-800 rounded-lg border border-slate-700 shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
                {isMasterAdmin && (
                  <>
                    <button
                      onClick={() => switchAccount(null)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${!activeAccountId ? 'text-white font-medium' : 'text-slate-300'}`}
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      All Accounts
                    </button>
                    {accounts.length > 0 && <div className="border-t border-slate-700" />}
                  </>
                )}
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => switchAccount(a.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${activeAccountId === a.id ? 'text-white font-medium' : 'text-slate-300'}`}
                  >
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="px-3 py-2 bg-slate-800 rounded-lg">
            <p className="text-sm text-white font-medium truncate">{accountName ?? 'No account'}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto" onClick={() => setAccountOpen(false)}>
        {allNav.map(({ href, icon: Icon, label, match }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(match ?? href)
          return (
            <Link
              key={href}
              href={navHref(href)}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        {pathname.startsWith('/settings') && (
          <div className="mb-3 px-1">
            <p className="text-white text-sm font-medium truncate">{user?.name || user?.email}</p>
            <p className="text-slate-500 text-xs truncate mt-0.5">{user?.email}</p>
            <p className="text-slate-600 text-xs mt-0.5 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors px-1 py-1"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <PushToggle />
        </div>
      </div>
    </div>
  )
}
