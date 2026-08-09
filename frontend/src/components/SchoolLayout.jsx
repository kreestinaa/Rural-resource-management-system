import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  School, Trophy, Coins, PencilLine, Bell, Target,
  ClipboardList, Scale, FileText, Moon, Sun, LogOut, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { notificationsService } from '../services/notifications.service'

const NAV_ITEMS = [
  { to: '/school/dashboard',        icon: School,        label: 'My School' },
  { to: '/school/ranking',          icon: Trophy,        label: 'My Ranking' },
  { to: '/school/allocation',       icon: Coins,         label: 'My Allocation' },
  { to: '/school/profile',          icon: PencilLine,    label: 'School Profile' },
  { to: '/school/notifications',    icon: Bell,          label: 'Notifications', badge: true },
  { to: '/school/simulator',        icon: Target,        label: 'Rank Simulator' },
  { to: '/school/verification',     icon: ClipboardList, label: 'Submit Data Update' },
  { to: '/school/appeals',          icon: Scale,         label: 'Submit Appeal' },
  { to: '/school/resource-request', icon: FileText,      label: 'Request Resources' },
]

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('darkMode', dark)
  }, [dark])
  return [dark, setDark]
}

export default function SchoolLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // Which nav item matches the current URL — drives the sticky page header
  const currentPage =
    NAV_ITEMS.find(i => location.pathname.startsWith(i.to)) ||
    { icon: School, label: 'My School' }
  const school = user?.school
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useDarkMode()

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsService.getAll().then(r => r.data),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const unreadCount = notifData?.unread_count ?? 0

  // Rank color for sidebar header badge
  const rank = school?.priority_rank
  const rankColor = !rank ? '#94a3b8' : rank <= 10 ? '#dc2626' : rank <= 50 ? '#f97316' : rank <= 100 ? '#f59e0b' : '#22c55e'

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 h-screen flex flex-col flex-shrink-0
        bg-[#052e16] text-white
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Nepal stripe */}
        <div className="nepal-stripe w-full" />

        {/* Brand — school name */}
        <div className="px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5"><School size={20} /></div>
              <div className="min-w-0">
                <div className="font-bold text-xs leading-tight line-clamp-2 text-white">
                  {school?.name || 'School Portal'}
                </div>
                <div className="text-white/40 text-[10px] mt-1">
                  {school?.emis ? `EMIS: ${school.emis}` : 'Rural Government Schools'}
                </div>
                {rank && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${rankColor}25`, color: rankColor }}>
                    Rank #{rank}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white flex-shrink-0"><X size={18} /></button>
          </div>
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
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={2} className="flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </>
              )}
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
              <div className="text-[10px] text-white/40 mt-0.5 capitalize">{user?.school_role || 'School User'}</div>
            </div>
          </div>

          {school?.district && (
            <div className="text-[9px] text-white/25 px-1 truncate">{school.district}, {school.province}</div>
          )}

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
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#052e16] text-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-xs truncate">{school?.name || 'School Portal'}</span>
            {rank && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${rankColor}30`, color: rankColor }}>
                #{rank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <span className="text-[9px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold animate-pulse-dot">{unreadCount}</span>
            )}
            <button onClick={() => setDark(d => !d)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Page header — fixed flex row ABOVE the scroll area (works even when
            a page creates its own internal scroll container) */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center gap-2.5 shadow-sm z-10">
          {(() => { const PageIcon = currentPage.icon; return <PageIcon size={20} className="text-slate-500 dark:text-slate-400" /> })()}
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {currentPage.label}
          </h1>
        </div>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
