import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Ticket, Users, ClipboardList,
  Calendar, LogOut, ChevronDown, Menu, X,
  FerrisWheel, Loader2, BadgePercent
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface NavItem {
  to: string
  icon: ReactNode
  label: string
}

const navItems: NavItem[] = [
  { to: '/admin',           icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/admin/rides',     icon: <FerrisWheel className="w-5 h-5" />,           label: 'Rides' },
  { to: '/admin/promos',    icon: <BadgePercent className="w-5 h-5" />,    label: 'Ride Promos' },
  { to: '/admin/schedules', icon: <Calendar className="w-5 h-5" />,        label: 'Schedules' },
  { to: '/admin/bookings',  icon: <Ticket className="w-5 h-5" />,          label: 'Bookings' },
  { to: '/admin/users',     icon: <Users className="w-5 h-5" />,           label: 'Users' },
  { to: '/admin/logs',      icon: <ClipboardList className="w-5 h-5" />,   label: 'Activity Logs' },
]

// How often to re-check the pending bookings count, in milliseconds.
const PENDING_POLL_INTERVAL = 30_000

// ── Logout Confirm Modal — same "are you sure" pattern used on the
// Visitor/Attendant portals (PortalHeader.tsx), now on the Admin side too. ──
function LogoutConfirmModal({ loading, onConfirm, onCancel }: {
  loading: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <LogOut className="w-6 h-6" />
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">Sign out?</div>
        <div className="text-[12px] text-gray-500 mb-6">Are you sure you want to log out of your account?</div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors bg-red-600 hover:bg-red-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><LogOut className="w-4 h-4" /> Yes, sign out</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // ✅ NEW — logout now goes through a confirm modal instead of firing
  // immediately on click, so a stray/mis-click doesn't sign the admin out.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, PENDING_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/api/booking', { params: { page: 1, pageSize: 1, search: 'Pending' } })
      const pg = res.data?.data?.pagination ?? res.data?.pagination
      setPendingCount(pg?.totalCount ?? 0)
    } catch {}
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    // ✅ NEW — consume the actual POST /api/auth/logout response instead of
    // always showing a hardcoded string. Still logs the admin out locally
    // and redirects even if the request itself fails.
    try {
      const res = await api.post('/api/auth/logout')
      logout()
      navigate('/login')
      toast.success(res.data?.message ?? 'Logged out successfully.')
    } catch (e: any) {
      logout()
      navigate('/login')
      toast.success(e.response?.data?.message ?? 'Logged out successfully.')
    } finally {
      setLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
            <img src="/images__6_-removebg-preview.png" alt="Glorious Fantasyland" className="w-14 h-14 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Glorious Fantasyland</p>
            <p className="text-xs text-gray-500">Admin Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.to === '/admin/bookings' && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full
                  bg-red-500 text-white text-[11px] font-bold leading-none flex-shrink-0">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User card */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 transition-all">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                {user?.initials ?? 'A'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-500">{user?.username}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.fullName}</p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    {user?.role}
                  </span>
                </div>
                {/* Sign out — ✅ NEW: opens the confirm modal instead of logging out immediately */}
                <button onClick={() => { setShowLogoutConfirm(true); setProfileOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
              {user?.initials ?? 'A'}
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.username}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Admin</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {showLogoutConfirm && (
        <LogoutConfirmModal
          loading={loggingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  )
}
