import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Trophy, Landmark, Coins, School, LineChart,
  Bell, CheckSquare, Scale, FileText, ScrollText, Moon, Sun, LogOut, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { notificationsService } from '../services/notifications.service'
import { verificationService } from '../services/verification.service'
import { appealsService } from '../services/appeals.service'
import { resourceRequestService } from '../services/resourceRequest.service'

const NAV_ITEMS = [
  { to: '/admin/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/rankings',          icon: Trophy,          label: 'Rankings' },
  { to: '/admin/annual-budget',     icon: Landmark,        label: 'Annual Budget' },
  { to: '/admin/allocation',        icon: Coins,           label: 'Allocation' },
  { to: '/admin/schools',           icon: School,          label: 'Schools' },
  { to: '/admin/comparison',        icon: LineChart,       label: 'Comparison' },
  { to: '/admin/notifications',     icon: Bell,            label: 'Notifications',    badge: 'notifications' },
  { to: '/admin/verifications',     icon: CheckSquare,     label: 'Verifications',    badge: 'verifications' },
  { to: '/admin/appeals',           icon: Scale,           label: 'Appeals',          badge: 'appeals' },
  { to: '/admin/resource-requests', icon: FileText,        label: 'Resource Requests', badge: 'resourceRequests' },
  { to: '/admin/audit',             icon: ScrollText,      label: 'Audit Log' },
]

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('darkMode', dark)
  }, [dark])
  return [dark, setDark]
}

export default function AdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // Which nav item matches the current URL — drives the sticky page header
  const currentPage =
    NAV_ITEMS.find(i => location.pathname.startsWith(i.to)) ||
    { icon: LayoutDashboard, label: 'Admin' }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useDarkMode()

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsService.getAll().then(r => r.data),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const unreadCount = notifData?.unread_count ?? 0

  const { data: verifData } = useQuery({
    queryKey: ['admin-verifications-count'],
    queryFn: () => verificationService.getAll().then(r => r.data),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const pendingVerifications = (verifData?.results || []).filter(r => r.status === 'pending').length

  const { data: appealsData } = useQuery({
    queryKey: ['admin-appeals-count'],
    queryFn: () => appealsService.getAll().then(r => r.data),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const pendingAppeals = (appealsData?.results || []).filter(r => r.status === 'pending').length

  // Pending resource requests — polls so a new school request shows up
  // in the sidebar without the admin refreshing the page.
  const { data: resourceReqData } = useQuery({
    queryKey: ['admin-resource-requests-count'],
    queryFn: () => resourceRequestService.getAll().then(r => r.data),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const pendingResourceRequests = (resourceReqData?.results || [])
    .filter(r => r.status === 'pending' || r.status === 'under_review').length

  const badgeCounts = {
    notifications: unreadCount,
    verifications: pendingVerifications,
    appeals: pendingAppeals,
    resourceRequests: pendingResourceRequests,
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 h-screen flex flex-col flex-shrink-0
        bg-[#0f2157] text-white
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Nepal stripe at top of sidebar */}
        <div className="nepal-stripe w-full" />

        {/* Brand */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><Landmark size={20} /></div>
            <div>
              <div className="font-bold text-sm leading-tight">RRAMS</div>
              <div className="text-white/40 text-[10px] mt-0.5">Rural Government Schools</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => {
                const count = badge ? (badgeCounts[badge] ?? 0) : 0
                return (
                  <>
                    <Icon size={18} strokeWidth={2} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge && count > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )
              }}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3 flex-shrink-0">
          <button
            onClick={() => setDark(d => !d)}
            className="flex items-center gap-2.5 text-xs text-white/50 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 w-full transition-all"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>

          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-sm flex-shrink-0">👤</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{user?.username}</div>
              <div className="text-[10px] text-white/40 mt-0.5">Administrator</div>
            </div>
          </div>

          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white px-2 py-1.5 rounded-lg hover:bg-red-600/30 transition-all"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0f2157] text-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
                <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white rounded-full px-1 min-w-[14px] text-center">{unreadCount}</span>
              </div>
            )}
            <button onClick={() => setDark(d => !d)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Page header — a fixed flex row ABOVE the scroll area.
            (Previously this was `sticky` inside <main>, but pages like Schools
            and Rankings create their OWN scroll container, so <main> never
            scrolled and the header appeared to not stick. Making it a sibling
            of the scrollable region fixes it for every page.) */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center gap-2.5 shadow-sm z-10">
          {(() => { const PageIcon = currentPage.icon; return <PageIcon size={20} className="text-slate-500 dark:text-slate-400" /> })()}
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {currentPage.label}
          </h1>
        </div>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 min-h-0">          <Outlet />
        </main>
      </div>
    </div>
  )
}
