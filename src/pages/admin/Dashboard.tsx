import { useEffect, useState } from 'react'
import type { SVGProps as ReactSVGProps } from 'react'
import { Link } from 'react-router-dom'
import type { AdminDashboard, Booking, RatingTrend } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import api, { reportApi } from '../../services/api'
import toast from 'react-hot-toast'

// ✅ FIXED — was `JSX.IntrinsicElements['svg']`, relying on the bare
// global `JSX` namespace. React 19's own type definitions moved that
// namespace under `React.JSX`, so the bare global lookup no longer
// resolves and fails with "Cannot find namespace 'JSX'". React's types
// package already exports an `SVGProps` generic that covers the same
// shape, so this uses that directly instead.
type SVGProps = ReactSVGProps<SVGSVGElement>

const fmt = (n: any) => Number(n ?? 0).toFixed(2)

function Ticket(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7h18M3 17h18" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
      <path d="M3 10.5c1 0 1-1 1-1s-1-1-1-1" />
      <path d="M21 10.5c-1 0-1-1-1-1s1-1 1-1" />
    </svg>
  )
}

function Users(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="7" r="2" />
      <path d="M3 21c0-3 3-5 5-5h2c2 0 5 2 5 5" />
      <path d="M14 18c1.5-1.5 4-1.5 5 0" />
    </svg>
  )
}

function Calendar(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  )
}

function CheckCircle2(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function XCircle(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

function BarChart3(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="8" width="4" height="12" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

function Clock(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function TrendingUp(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 9v6h-6" />
    </svg>
  )
}

function AlertCircle(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function ChevronLeft(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRight(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function Loader2(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" {...props}>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  )
}

function FerrisWheel(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 6v-4M12 18v4M6 12h-4M18 12h4M16.5 7.5l2.5-2.5M5.5 18.5l-2.5 2.5M7.5 16.5l-2.5 2.5M18.5 5.5l2.5-2.5" />
    </svg>
  )
}

function BadgePercent(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="7.5" cy="7.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
      <path d="M7.5 16.5l9-9" />
    </svg>
  )
}

function Star(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7z" />
    </svg>
  )
}

function ChevronRightSmall(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// ── Mini sparkline — a compact, dashboard-card-sized version of the same
// monthly rating trend the full Reports page charts, just without axes/
// labels/gridlines. Kept local to this file rather than importing from
// Reports.tsx, matching this codebase's existing pattern of small
// presentational helpers living alongside the page that uses them. ──
function RatingSparkline({ points }: { points: { averageRating: number; reviewCount: number }[] }) {
  const W = 240, H = 56, pad = 4
  const n = points.length
  if (n === 0) return <div className="text-xs text-gray-300">No rating data yet</div>

  const xFor = (i: number) => pad + (n <= 1 ? (W - pad * 2) / 2 : ((W - pad * 2) * i) / (n - 1))
  const yFor = (v: number) => pad + (H - pad * 2) - (Math.max(0, Math.min(5, v)) / 5) * (H - pad * 2)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.averageRating).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" role="img" aria-label="Average rating trend, last 6 months">
      <path d={d} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(p.averageRating)} r={p.reviewCount > 0 ? 2.5 : 1.5}
          fill={p.reviewCount > 0 ? '#f59e0b' : '#e5e7eb'} />
      ))}
    </svg>
  )
}

// ── Enhanced StatCard ────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Month/Year Picker — compact trigger for use inside colored cards ──
function MonthYearPicker({ month, year, onChange }: {
  month: number; year: number
  onChange: (month: number, year: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const today = new Date()

  return (
    <div className="relative">
      <button onClick={() => { setViewYear(year); setOpen(p => !p) }}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
        <Calendar className="w-4 h-4 text-white" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-2 right-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden text-left">
            {/* Year navigator */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button type="button" onClick={() => setViewYear(y => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-gray-900 text-sm">{viewYear}</span>
              <button type="button" onClick={() => setViewYear(y => y + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-2 p-4">
              {MONTHS.map((m, i) => {
                const isSelected = viewYear === year && i === month
                const isCurrent = viewYear === today.getFullYear() && i === today.getMonth()
                return (
                  <button key={m} type="button"
                    onClick={() => { onChange(i, viewYear); setOpen(false) }}
                    className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    {m}
                  </button>
                )
              })}
            </div>

            {/* Quick jump to today */}
            <div className="px-4 pb-4">
              <button type="button"
                onClick={() => { onChange(today.getMonth(), today.getFullYear()); setOpen(false) }}
                className="w-full py-2 rounded-xl text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                Jump to today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Confirm Modal — same pattern used in Bookings.tsx ────────────
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {danger ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">{title}</div>
        <div className="text-[12px] text-gray-500 mb-6">{message}</div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: React.ReactNode
  color: 'green'|'blue'|'purple'|'amber'|'red'
}) {
  const styles: Record<string,string> = {
    green:  'bg-gradient-to-br from-emerald-500 to-green-600',
    blue:   'bg-gradient-to-br from-blue-500 to-blue-600',
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
    amber:  'bg-gradient-to-br from-amber-400 to-amber-500',
    red:    'bg-gradient-to-br from-red-500 to-red-600',
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-sm ${styles[color]}`}>
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-3xl font-bold mb-0.5">{value}</div>
      <div className="text-white/80 text-xs font-medium">{label}</div>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
    </div>
  )
}

// ── Mini StatCard ─────────────────────────────────────────────
function MiniCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode
  color: 'green'|'blue'|'purple'|'amber'|'red'
}) {
  const cls: Record<string,string> = {
    green:  'bg-green-50  text-green-600  border-green-100',
    blue:   'bg-blue-50   text-blue-600   border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    amber:  'bg-amber-50  text-amber-600  border-amber-100',
    red:    'bg-red-50    text-red-600    border-red-100',
  }
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${cls[color]}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  )
}

// ✅ NEW — skeleton placeholders for the dashboard's loading state, matching
// the gray `animate-pulse` block pattern already used on the other admin
// pages, shaped after StatCard / MiniCard / the pending-approval row above.
function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 shadow-sm bg-gray-100 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 mb-3" />
      <div className="h-7 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-24" />
    </div>
  )
}

function MiniCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
      <div className="space-y-1.5">
        <div className="h-5 bg-gray-200 rounded w-8" />
        <div className="h-2.5 bg-gray-200 rounded w-14" />
      </div>
    </div>
  )
}

function PendingRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 animate-pulse">
      <div className="flex items-center gap-3 sm:contents">
        <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
        <div className="flex-1 sm:w-40 sm:flex-shrink-0 space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-24" />
          <div className="h-2.5 bg-gray-100 rounded w-16" />
          <div className="h-4 bg-gray-100 rounded w-28" />
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-40" />
        <div className="h-2.5 bg-gray-100 rounded w-32" />
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
        <div className="h-4 bg-gray-200 rounded w-14" />
        <div className="flex gap-2">
          <div className="w-9 h-9 rounded-full bg-gray-100" />
          <div className="w-9 h-9 rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  const map: Record<string,string> = {
    Paid:'bg-green-100 text-green-700', Unpaid:'bg-amber-100 text-amber-700',
    Pending:'bg-amber-100 text-amber-700', Approved:'bg-green-100 text-green-700',
    Rejected:'bg-red-100 text-red-700', Completed:'bg-blue-100 text-blue-700',
    Cancelled:'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

function maskCode(code?: string) {
  if (!code) return ''
  const parts = code.split('-')
  if (parts.length < 3) return code.replace(/./g, '•')
  const visible = parts.slice(0, 2).join('-')
  const hiddenLen = parts.slice(2).join('-').length
  return `${visible}-${'•'.repeat(hiddenLen)}`
}

export default function AdminDashboardPage() {
  const { user }              = useAuth()
  const [stats, setStats]     = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [allBookings, setAllBookings] = useState<any[]>([])
  // ✅ NEW — average rating trend (all Attractions & Bundles combined, last
  // 6 months), backing the "Attraction & bundle ratings" widget below.
  // Loaded separately from `loading` so a slow ratings query never blocks
  // the rest of the dashboard from rendering.
  const [ratingTrend, setRatingTrend] = useState<RatingTrend | null>(null)
  const [ratingLoading, setRatingLoading] = useState(true)

  const now0 = new Date()
  const [filterMonth, setFilterMonth] = useState(now0.getMonth())
  const [filterYear, setFilterYear]   = useState(now0.getFullYear())

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        api.get('/api/dashboard/admin'),
        api.get('/api/booking', { params: { page: 1, pageSize: 9999 } }),
      ])
      const statsData = statsRes.data?.data ?? statsRes.data
      setStats(statsData)
      const bookingsData = bookingsRes.data?.data?.data ?? bookingsRes.data?.data ?? bookingsRes.data ?? []
      setAllBookings(Array.isArray(bookingsData) ? bookingsData : [])
    } catch { toast.error('Failed to load dashboard.') }
    finally { setLoading(false) }
  }

  const fetchRatingTrend = async () => {
    setRatingLoading(true)
    try {
      // ✅ CHANGED — reportApi now takes an explicit fromDate/toDate range
      // instead of a trailing-months count. Widget still shows the last 6
      // months: 1st of the month 5 months ago, through today.
      const today = new Date()
      const from = new Date(today.getFullYear(), today.getMonth() - 5, 1)
      const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const res = await reportApi.getRatingTrend({ scope: 'All', fromDate: toISO(from), toDate: toISO(today) })
      setRatingTrend(res.data?.data ?? null)
    } catch { /* non-critical widget — fail quietly, rest of dashboard still works */ }
    finally { setRatingLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { fetchRatingTrend() }, [])

  const pending = stats?.recentPendingBookings ?? []

  const monthlyBookings = allBookings.filter(b => {
    const raw = b.scheduleDate ?? b.bookedAt
    if (!raw) return false
    const d = new Date(raw)
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear
  })

  const monthlyBookingsCount = monthlyBookings.length
  const monthlyPending   = monthlyBookings.filter(b => b.status === 'Pending').length
  const monthlyApproved  = monthlyBookings.filter(b => b.status === 'Approved').length
  const monthlyRejected  = monthlyBookings.filter(b => b.status === 'Rejected').length
  const monthlyCompleted = monthlyBookings.filter(b => b.status === 'Completed').length
  const monthlyCancelled = monthlyBookings.filter(b => b.status === 'Cancelled').length

  const monthLabel = new Date(filterYear, filterMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  // ── Confirm modals for approve/reject, same pattern as Bookings.tsx ──
  const [approveTarget, setApproveTarget] = useState<Booking | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const doApprove = async () => {
    if (!approveTarget) return
    setActionLoading(true)
    try {
      await api.put(`/api/booking/${approveTarget.id}/status`, { status: 'Approved' })
      toast.success('Booking approved.')
      setApproveTarget(null)
      fetchAll()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to approve.')
    } finally { setActionLoading(false) }
  }

  const doReject = async () => {
    if (!rejectTarget) return
    setActionLoading(true)
    try {
      await api.put(`/api/booking/${rejectTarget.id}/status`, { status: 'Rejected' })
      toast.success('Booking rejected.')
      setRejectTarget(null)
      fetchAll()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to reject.')
    } finally { setActionLoading(false) }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.firstName ?? 'Admin'}! 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of all park operations.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniCardSkeleton /><MiniCardSkeleton /><MiniCardSkeleton /><MiniCardSkeleton /><MiniCardSkeleton />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4">
          <div className="h-14 w-full bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 5 }).map((_, i) => <PendingRowSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.firstName ?? 'Admin'}! 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of all park operations.</p>
      </div>

      {/* Row 1 — Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total attractions"     value={stats?.totalRides ?? 0}     icon={<FerrisWheel className="w-5 h-5 text-white" />}    color="green"  />
        <StatCard label="Total visitors"  value={stats?.totalVisitors ?? 0}  icon={<Users className="w-5 h-5 text-white" />}    color="blue"   />
        <StatCard label="Today schedules" value={stats?.todaySchedules ?? 0} icon={<Calendar className="w-5 h-5 text-white" />} color="purple" />
        <div className="relative rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br from-amber-400 to-amber-500 overflow-visible">
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <MonthYearPicker
              month={filterMonth} year={filterYear}
              onChange={(m, y) => { setFilterMonth(m); setFilterYear(y) }}
            />
          </div>
          <div className="text-3xl font-bold mb-0.5">{monthlyBookingsCount}</div>
          <div className="text-white/80 text-xs font-medium">Bookings in {monthLabel}</div>
        </div>
      </div>

      {/* Row 2 — Mini stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniCard label="Pending"   value={monthlyPending}   icon={<Clock className="w-4 h-4" />}        color="amber"  />
        <MiniCard label="Approved"  value={monthlyApproved}  icon={<CheckCircle2 className="w-4 h-4" />} color="green"  />
        <MiniCard label="Rejected"  value={monthlyRejected}  icon={<XCircle className="w-4 h-4" />}      color="red"    />
        <MiniCard label="Completed" value={monthlyCompleted} icon={<TrendingUp className="w-4 h-4" />}   color="blue"   />
        <MiniCard label="Cancelled" value={monthlyCancelled} icon={<BarChart3 className="w-4 h-4" />}    color="purple" />
      </div>

      {/* Attraction & bundle ratings — quick summary, full breakdown lives on the Reports page */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Attraction &amp; bundle ratings</div>
              <div className="text-xs text-gray-400">Average visitor rating, last 6 months</div>
            </div>
          </div>
          <Link to="/admin/reports"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            View full report <ChevronRightSmall className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="px-5 py-4 flex items-center gap-6 flex-wrap">
          {ratingLoading ? (
            <div className="h-14 w-full bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <>
              <div className="flex-shrink-0">
                <div className="text-3xl font-bold text-gray-900">{(ratingTrend?.overallAverage ?? 0).toFixed(2)}</div>
                <div className="text-xs text-gray-400">{ratingTrend?.overallReviewCount ?? 0} review{(ratingTrend?.overallReviewCount ?? 0) === 1 ? '' : 's'}</div>
              </div>
              <div className="flex-1 min-w-[160px]">
                <RatingSparkline points={ratingTrend?.points ?? []} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pending approvals */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Recent pending approvals</div>
              <div className="text-xs text-gray-400">Latest bookings waiting for your action</div>
            </div>
          </div>
          {stats && stats.pendingBookings > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {stats.pendingBookings} pending total
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div className="font-semibold text-gray-600">All caught up!</div>
            <div className="text-xs text-gray-400 mt-1">No pending bookings right now.</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pending.map(b => (
              <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                <div className="flex items-center gap-3 sm:contents">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {b.visitorName?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 sm:w-40 sm:flex-shrink-0 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{b.visitorName}</div>
                    <div className="text-[10px] text-gray-400">@{b.visitorUsername}</div>
                    <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{maskCode(b.bookingCode)}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {b.promoId ? (
                    <>
                      <div className="flex items-center gap-1 text-sm font-medium text-gray-900 mb-1">
                        <BadgePercent className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
                        <span className="truncate">{b.promoName}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-semibold border border-pink-100 flex-shrink-0">
                          Bundle
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.includedRides?.[0]?.scheduleDate ?? '—'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-sm font-medium text-gray-900 mb-1">
                        <FerrisWheel className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="truncate">{b.rideName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.scheduleDate}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.startTime?.slice(0,5)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                  {/* Price + payment */}
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="font-bold text-gray-900 text-sm">₱{fmt(b.promoId ? b.paymentAmount : b.ridePrice)}</div>
                    <Badge label={b.paymentStatus} />
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setApproveTarget(b)} title="Approve"
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={() => setRejectTarget(b)} title="Reject"
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
                      <XCircle className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Approve */}
      {approveTarget && (
        <ConfirmModal
          title="Approve booking?"
          message={`Approve ${approveTarget.visitorName}'s booking for "${approveTarget.promoId ? approveTarget.promoName : approveTarget.rideName}"?`}
          confirmLabel="Yes, approve"
          onConfirm={doApprove}
          onCancel={() => setApproveTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* Confirm Reject */}
      {rejectTarget && (
        <ConfirmModal
          title="Reject booking?"
          message={`Reject ${rejectTarget.visitorName}'s booking for "${rejectTarget.promoId ? rejectTarget.promoName : rejectTarget.rideName}"?`}
          confirmLabel="Yes, reject"
          danger
          onConfirm={doReject}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
