import { useEffect, useState, useRef } from 'react'
import {
  Ticket, CheckCircle2, Clock, XCircle,
  Users, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Search, MapPin, ZoomIn, X, Loader2, ArrowLeft,
  UserCog, CalendarDays, Bell, AlarmClock,
  FerrisWheel, Tag, PackageCheck
} from 'lucide-react'
import type { Booking, Ride, RidePromo, PaginationRequest } from '../../types'
import api, { promoApi, bookingApi } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const BASE_URL = 'https://localhost:7263'
const fmt = (n: any) => Number(n ?? 0).toFixed(2)

function getImageUrl(path?: string) {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${BASE_URL}${path}`
  return `${BASE_URL}/images/${path}`
}

// Formats a TimeOnly string ("10:20:00") into "10:20 AM"
function fmtTime(t?: string) {
  if (!t) return '—'
  return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Formats a full ISO datetime ("2026-07-11T00:23:58.0933333") into
// "Jul 11, 12:23 AM" — date + 12-hour time together, instead of the raw
// ISO string dumped straight into the DOM.
function fmtDateTime(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

// Pulls the friendliest error message out of an axios error — handles both
// { message } responses and ASP.NET Core ModelState validation payloads.
function getErrorMessage(e: any, fallback = 'Something went wrong.') {
  const data = e?.response?.data
  if (!data) return fallback
  if (data.message) return data.message
  if (data.errors) {
    const firstKey = Object.keys(data.errors)[0]
    const firstVal = firstKey ? data.errors[firstKey] : null
    if (Array.isArray(firstVal) && firstVal.length) return firstVal[0]
  }
  return fallback
}

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

// ── Schedule type ─────────────────────────────────────────────
interface Schedule {
  id: number; rideId: number; rideName: string
  scheduleDate: string; callTime?: string; startTime: string; endTime: string
  availableSlots: number; maxSlots: number; status: string
  attendantName?: string
}

// ── Confirm Modal ──────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Call time badge — styled like a notification chip (pill background +
// border) instead of plain colored text, so it actually draws the eye. ──
function CallTimeBadge({ time, className = '' }: { time?: string; className?: string }) {
  if (!time) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold shadow-sm ${className}`}>
      <AlarmClock className="w-3.5 h-3.5" />
      Call time: {fmtTime(time)}
    </span>
  )
}


// ── Rides / Promos toggle — segmented control, same visual language as
// the StatusCombobox-style filters used elsewhere (Rides.tsx, AttendantDashboard) ──
function ViewToggle({ value, onChange }: { value: 'rides' | 'promos'; onChange: (v: 'rides' | 'promos') => void }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-1">
      <button type="button" onClick={() => onChange('rides')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          value === 'rides' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}>
        <FerrisWheel className="w-3.5 h-3.5" /> Rides
      </button>
      <button type="button" onClick={() => onChange('promos')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          value === 'promos' ? 'bg-white text-pink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}>
        <Tag className="w-3.5 h-3.5" /> Promos
      </button>
    </div>
  )
}

// ── Month/Year Picker — click-to-open, jump to any month/year ──────
function MonthYearPicker({ month, year, onChange, accent = 'emerald' }: {
  month: number; year: number
  onChange: (month: number, year: number) => void
  accent?: 'indigo' | 'emerald'
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const today = new Date()

  const label = new Date(year, month).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const selectedBg = accent === 'emerald' ? 'bg-emerald-600' : 'bg-indigo-600'
  const todayText = accent === 'emerald' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-indigo-700 hover:bg-indigo-50'
  const todayBg = accent === 'emerald' ? 'bg-emerald-50' : 'bg-indigo-50'

  return (
    <div className="relative">
      <button onClick={() => { setViewYear(year); setOpen(p => !p) }}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-gray-50 transition-colors">
        <Calendar className={`w-4 h-4 ${accent === 'emerald' ? 'text-emerald-600' : 'text-indigo-600'}`} />
        <span className="text-sm font-bold text-gray-900">{label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-2 right-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
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
                        ? `${selectedBg} text-white shadow-sm`
                        : isCurrent
                        ? `${todayBg} ${todayText} border border-current/20`
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
                className={`w-full py-2 rounded-xl text-xs font-medium transition-colors ${todayBg} ${todayText}`}>
                Jump to today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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

function ImageZoom({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-2xl max-h-[80vh]">
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img src={src} alt="Ride" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  const map: Record<string,string> = {
    Paid:'bg-green-100 text-green-700', Unpaid:'bg-amber-100 text-amber-700',
    Pending:'bg-amber-100 text-amber-700', Approved:'bg-green-100 text-green-700',
    Rejected:'bg-red-100 text-red-700', Completed:'bg-blue-100 text-blue-700',
    Cancelled:'bg-gray-100 text-gray-600', Open:'bg-green-100 text-green-700',
    // ✅ Missed now gets its own color (orange) — it used to share the exact
    // same red as Rejected/Full, making them impossible to tell apart at a glance.
    Full:'bg-red-100 text-red-700', Missed:'bg-orange-100 text-orange-700',
    // ✅ NEW — a promo's included ride can have slots left even after its
    // own schedule auto-flips to "Completed" later the same day, so this
    // reads as "Available" rather than reusing the literal "Open" label.
    Available:'bg-green-100 text-green-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

// ── Date Range Modal (centered dialog) ─────────────────────────
function DateRangeModal({ from, to, onApply, onClose }: {
  from: string; to: string
  onApply: (from: string, to: string) => void
  onClose: () => void
}) {
  const [tempFrom, setTempFrom] = useState(from)
  const [tempTo, setTempTo] = useState(to)
  const today = new Date()

  const presets = [
    { label: 'Today', get: () => { const d = toISO(today); return [d, d] as [string,string] } },
    { label: 'Yesterday', get: () => { const d = new Date(today); d.setDate(d.getDate()-1); const s = toISO(d); return [s, s] as [string,string] } },
    { label: 'Last 7 days', get: () => { const s = new Date(today); s.setDate(s.getDate()-6); return [toISO(s), toISO(today)] as [string,string] } },
    { label: 'Last 30 days', get: () => { const s = new Date(today); s.setDate(s.getDate()-29); return [toISO(s), toISO(today)] as [string,string] } },
    { label: 'This month', get: () => { const s = new Date(today.getFullYear(), today.getMonth(), 1); return [toISO(s), toISO(today)] as [string,string] } },
  ]

  const isActivePreset = (f: string, t: string) => tempFrom === f && tempTo === t

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-slate-600" />
            </div>
            <div className="font-semibold text-gray-900 text-[14px]">Filter by date</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick select</div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(p => {
                const [f, t] = p.get()
                const active = isActivePreset(f, t)
                return (
                  <button key={p.label} type="button"
                    onClick={() => { setTempFrom(f); setTempTo(t) }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                      active ? 'bg-slate-600 text-white border-slate-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Custom range</div>
            <div className="flex items-center gap-2">
              <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" />
              <span className="text-[10px] text-gray-400">to</span>
              <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button type="button" onClick={() => { setTempFrom(''); setTempTo('') }}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Clear
          </button>
          <button type="button" onClick={() => { onApply(tempFrom, tempTo); onClose() }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 transition-colors">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Date Range Trigger Button ──────────────────────────────────
function DateRangeButton({ from, to, onClick }: { from: string; to: string; onClick: () => void }) {
  const label = !from && !to
    ? 'All dates'
    : from && to
      ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`)
      : from ? `From ${fmtShort(from)}` : `Until ${fmtShort(to)}`

  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
        (from || to) ? 'bg-slate-600 text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}>
      <Calendar className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

export function VisitorDashboard() {
  const { user } = useAuth()

  // rides list
  const [rides, setRides]         = useState<Ride[]>([])
  const [ridePag, setRidePag]     = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:6 })
  const [rideParams, setRideParams] = useState<PaginationRequest>({ page:1, pageSize:6, search:'' })
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  // ── Rides vs Promos toggle ──────────────────────────────────
  const [viewMode, setViewMode] = useState<'rides' | 'promos'>('rides')
  const [promos, setPromos]       = useState<RidePromo[]>([])
  const [promoLoading, setPromoLoading] = useState(true)

  // selected promo — schedules are LOCKED IN per ride by the admin already,
  // so there's no schedule-picking step here, just a direct book button.
  const [selectedPromo, setSelectedPromo]       = useState<RidePromo | null>(null)
  const [promoBookTarget, setPromoBookTarget]   = useState<RidePromo | null>(null)
  const [promoBookingLoading, setPromoBookingLoading] = useState(false)

  // selected ride + its schedules
  const [selectedRide, setSelectedRide]   = useState<Ride | null>(null)
  const [schedules, setSchedules]         = useState<Schedule[]>([])
  const [schedLoading, setSchedLoading]   = useState(false)

  // bookings
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [bookPag, setBookPag]     = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:5 })
  const [bookParams, setBookParams] = useState<PaginationRequest>({ page:1, pageSize:5 })
  const [bookLoading, setBookLoading] = useState(true)
  const [bookStats, setBookStats] = useState({ total:0, upcoming:0, completed:0, cancelled:0 })
  const [allBookingsRaw, setAllBookingsRaw] = useState<any[]>([])

  // ── Unseen status-change tracking (bell icon) — Pending, Approved, Cancelled ──
  const SEEN_STATUS_KEY = 'visitor_seen_status_booking_ids'
  const [unseenApprovedCount, setUnseenApprovedCount] = useState(0)
  const [unseenPendingCount, setUnseenPendingCount] = useState(0)
  const [unseenCancelledCount, setUnseenCancelledCount] = useState(0)
  const bookingsSectionRef = useRef<HTMLDivElement>(null)
  const scrollToBookings = () => {
    bookingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getSeenStatusIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem(SEEN_STATUS_KEY)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  }

  // Clicking the bell marks everything as seen right away (badges vanish immediately)
  const markBellSeen = () => {
    scrollToBookings()
    const allIds = allBookingsRaw
      .filter((b: any) => b.status === 'Pending' || b.status === 'Approved' || b.status === 'Cancelled')
      .map((b: any) => `${b.status}:${b.id}`)
    try { localStorage.setItem(SEEN_STATUS_KEY, JSON.stringify(allIds)) } catch {}
    setUnseenApprovedCount(0)
    setUnseenPendingCount(0)
    setUnseenCancelledCount(0)
  }

  // booking filters
  const [bookSearch, setBookSearch]   = useState('')
  const [bookDateFrom, setBookDateFrom] = useState('')
  const [bookDateTo, setBookDateTo]     = useState('')
  const [bookDateModalOpen, setBookDateModalOpen] = useState(false)

  // modals
  const [zoomSrc, setZoomSrc]           = useState<string|null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking|null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [bookTarget, setBookTarget]     = useState<{ scheduleId:number; rideName:string; date:string; time:string; price:number }|null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => { fetchRides() }, [rideParams])
  useEffect(() => { fetchBookings() }, [bookParams, bookSearch, bookDateFrom, bookDateTo])
  useEffect(() => { fetchPromos() }, [])

  const fetchPromos = async () => {
    setPromoLoading(true)
    try {
      const res = await promoApi.getAll({ page: 1, pageSize: 50 })
      const d = (res.data as any)?.data?.data ?? (res.data as any)?.data ?? res.data ?? []
      const list: RidePromo[] = Array.isArray(d) ? d : []
      setPromos(list.filter(p => !p.isDeleted))
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load promos.')) }
    finally { setPromoLoading(false) }
  }

  // ✅ CHANGED — a promo can be reserved any time up to and including its
  // date, not only on the exact day. It's just a reservation — payment
  // isn't collected until the attendant does so in person, so there's no
  // reason to block booking ahead of time. Only an already-past promo date
  // is unavailable (expired).
  const promoIsAvailable = (promo: RidePromo) => {
    const today = toISO(new Date())
    return today <= promo.promoDate.slice(0, 10)
  }

  // Schedules are already LOCKED IN per ride by the admin (see promo.rides),
  // so opening a promo's detail view is just a state change — no fetch needed.
  const openPromo = (promo: RidePromo) => setSelectedPromo(promo)

  // ✅ CHANGED — no longer requires scheduleStatus === 'Open'. The
  // background worker auto-flips a schedule to "Completed" the moment its
  // end time passes, even earlier the SAME day as the promo. That's correct
  // for regular single-ride booking, but a promo is reservable any time up
  // to and including its whole date (see promoIsAvailable below) — so an
  // included ride whose window already elapsed today shouldn't block the
  // promo booking. Only an explicitly Cancelled schedule still blocks it.
  const promoHasSlots = (promo: RidePromo) =>
    promo.rides.every(r => r.availableSlots > 0 && r.scheduleStatus !== 'Cancelled')

  const doBookPromo = async () => {
    if (!promoBookTarget) return
    setPromoBookingLoading(true)
    try {
      await bookingApi.bookPromo({ promoId: promoBookTarget.id })
      toast.success(`Booked promo "${promoBookTarget.name}"!`)
      setPromoBookTarget(null)
      setSelectedPromo(null)
      fetchBookings()
      fetchPromos()
    } catch (e: any) {
      setPromoBookTarget(null)
      toast.error(getErrorMessage(e, 'Promo booking failed.'))
    } finally { setPromoBookingLoading(false) }
  }

  const fetchRides = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/ride', { params: { ...rideParams } })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      setRides(Array.isArray(d) ? d.filter((r: any) => !r.isDeleted) : [])
      const pg = res.data?.data?.pagination ?? res.data?.pagination
      if (pg) setRidePag(pg)
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load rides.')) }
    finally { setLoading(false) }
  }

  const fetchSchedules = async (ride: Ride) => {
    setSelectedRide(ride)
    setSchedLoading(true)
    setSchedules([])
    try {
      const res = await api.get('/api/schedule', { params: { pageSize: 50, page: 1 } })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      const all: Schedule[] = Array.isArray(d) ? d : []
      // filter by this ride and only Open/upcoming
      const today = new Date().toISOString().split('T')[0]
      // ✅ NEW — Regular and Promo schedules are fully separate pools. A
      // Promo-type schedule is reserved for a Ride Promo bundle and must
      // never show up here for direct visitor booking.
      const filtered = all.filter(s =>
        s.rideId === ride.id &&
        (s.scheduleType ?? 'Regular') === 'Regular' &&
        s.status === 'Open' &&
        s.availableSlots > 0 &&
        s.scheduleDate >= today
      )
      setSchedules(filtered)
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load schedules.')) }
    finally { setSchedLoading(false) }
  }

  const fetchBookings = async () => {
    setBookLoading(true)
    try {
      const [pageRes, allRes] = await Promise.all([
        api.get('/api/booking/my-bookings', {
          params: {
            ...bookParams,
            search: bookSearch || undefined,
            fromDate: bookDateFrom || undefined,
            toDate: bookDateTo || undefined,
          }
        }),
        api.get('/api/booking/my-bookings', { params: { page: 1, pageSize: 500 } }),
      ])
      const d = pageRes.data?.data?.data ?? pageRes.data?.data ?? pageRes.data ?? []
      let list: Booking[] = Array.isArray(d) ? d : []
      // client-side fallback filter in case the API doesn't support search/fromDate/toDate yet
      if (bookSearch) {
        const q = bookSearch.toLowerCase()
        list = list.filter(b =>
          b.rideName?.toLowerCase().includes(q) ||
          b.bookingCode?.toLowerCase().includes(q)
        )
      }
      if (bookDateFrom) list = list.filter(b => (b.scheduleDate ?? '') >= bookDateFrom)
      if (bookDateTo)   list = list.filter(b => (b.scheduleDate ?? '') <= bookDateTo)
      setBookings(list)
      const pg = pageRes.data?.data?.pagination ?? pageRes.data?.pagination
      if (pg) setBookPag(pg)
      // store raw list; monthly stats are recomputed reactively below
      const all: any[] = allRes.data?.data?.data ?? allRes.data?.data ?? allRes.data ?? []
      setAllBookingsRaw(all)

      // Track unseen Pending/Approved/Cancelled bookings since the visitor's
      // last bell-click. Badge stays until they click the bell (see markBellSeen).
      const seen = getSeenStatusIds()
      const countUnseen = (status: string) =>
        all.filter((b: any) => b.status === status && !seen.has(`${status}:${b.id}`)).length

      setUnseenPendingCount(countUnseen('Pending'))
      setUnseenApprovedCount(countUnseen('Approved'))
      setUnseenCancelledCount(countUnseen('Cancelled'))
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load bookings.')) }
    finally { setBookLoading(false) }
  }

  const doBook = async () => {
    if (!bookTarget) return
    setBookingLoading(true)
    try {
      await api.post('/api/booking', { scheduleId: bookTarget.scheduleId })
      toast.success(`Booked "${bookTarget.rideName}" on ${bookTarget.date}!`)
      setBookTarget(null)
      setSelectedRide(null)
      fetchBookings()
      fetchRides()
    } catch (e: any) {
      setBookTarget(null)
      toast.error(getErrorMessage(e, 'Booking failed.'))
    } finally { setBookingLoading(false) }
  }

  const doCancel = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      await api.put(`/api/booking/${cancelTarget.id}/cancel`)
      toast.success('Booking cancelled.')
      setCancelTarget(null); fetchBookings()
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to cancel.'))
    } finally { setCancelLoading(false) }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  // ── Month filter for booking stats ──────────────────────────────
  const [filterMonth, setFilterMonth] = useState(now.getMonth())
  const [filterYear, setFilterYear]   = useState(now.getFullYear())

  useEffect(() => {
    const monthly = allBookingsRaw.filter((b: any) => {
      const raw = b.scheduleDate ?? b.bookedAt
      if (!raw) return false
      const d = new Date(raw)
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear
    })
    setBookStats({
      total:     monthly.length,
      upcoming:  monthly.filter((b: any) => b.status === 'Approved').length,
      completed: monthly.filter((b: any) => b.status === 'Completed').length,
      cancelled: monthly.filter((b: any) => b.status === 'Cancelled').length,
    })
  }, [allBookingsRaw, filterMonth, filterYear])

  const monthLabel = new Date(filterYear, filterMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 rounded-2xl p-6 text-white shadow-sm">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs px-3 py-1 rounded-full mb-3 border border-white/30">
              <MapPin className="w-3 h-3" /> Gloria's Fantasyland
            </div>
            <h1 className="text-2xl font-bold mb-1">{greeting}, {user?.firstName}! 🎢</h1>
            <p className="text-white/80 text-sm">Ready for an adventure? Browse rides and pick a schedule.</p>
          </div>

          <button onClick={markBellSeen}
            title={[
              unseenPendingCount > 0 ? `${unseenPendingCount} pending` : null,
              unseenCancelledCount > 0 ? `${unseenCancelledCount} cancelled` : null,
              unseenApprovedCount > 0 ? `${unseenApprovedCount} approved` : null,
            ].filter(Boolean).join(' · ') || 'Go to my bookings'}
            className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 transition-colors flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
            {/* Amber badge — pending bookings not yet reviewed */}
            {unseenPendingCount > 0 && (
              <span className="absolute -top-1 -left-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full
                bg-amber-500 text-white text-[10px] font-bold leading-none border-2 border-emerald-600">
                {unseenPendingCount > 9 ? '9+' : unseenPendingCount}
              </span>
            )}
            {/* Red badge — cancelled bookings not yet seen (takes priority over approved) */}
            {(unseenCancelledCount > 0 || unseenApprovedCount > 0) && (
              <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full
                text-white text-[10px] font-bold leading-none border-2 border-emerald-600 ${
                  unseenCancelledCount > 0 ? 'bg-red-500' : 'bg-green-500'
                }`}>
                {unseenCancelledCount > 0
                  ? (unseenCancelledCount > 9 ? '9+' : unseenCancelledCount)
                  : (unseenApprovedCount > 9 ? '9+' : unseenApprovedCount)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats — filtered by month, same card proportions as the attendant dashboard */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">Your activity in {monthLabel}</h3>
        <MonthYearPicker
          month={filterMonth} year={filterYear}
          onChange={(m, y) => { setFilterMonth(m); setFilterYear(y) }}
          accent="emerald"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total bookings', value:bookStats.total,     icon:<Ticket className="w-5 h-5 text-white" />, g:'from-emerald-500 to-emerald-600' },
          { label:'Upcoming',       value:bookStats.upcoming,  icon:<Clock className="w-5 h-5 text-white" />,  g:'from-amber-400 to-amber-500' },
          { label:'Completed',      value:bookStats.completed, icon:<CheckCircle2 className="w-5 h-5 text-white" />, g:'from-blue-500 to-blue-600' },
          { label:'Cancelled',      value:bookStats.cancelled, icon:<XCircle className="w-5 h-5 text-white" />, g:'from-red-500 to-red-600' },
        ].map(s => (
          <div key={s.label} className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${s.g} shadow-sm`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-white/80 text-xs">{s.label}</div>
            <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-full bg-white/10" />
          </div>
        ))}
      </div>

      {/* Rides or Schedules */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {viewMode === 'rides' ? ( !selectedRide ? (
          // ── Rides list ──────────────────────────────────────
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FerrisWheel className="w-5 h-5 text-emerald-500" /> Available rides
                </h3>
              <p className="text-xs text-gray-500">Click a ride to see available schedules and book.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ViewToggle value={viewMode} onChange={setViewMode} />
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input value={search}
                    onChange={e => { setSearch(e.target.value); setRideParams(p => ({ ...p, search: e.target.value, page: 1 })) }}
                    placeholder="Search rides..."
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-48 bg-gray-50" />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : rides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FerrisWheel className="w-14 h-14 mb-3 text-gray-200" />
                <div className="font-semibold text-gray-500">No rides available</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {rides.map(ride => (
                    <div key={ride.id}
                      className="border border-gray-200 rounded-2xl overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => fetchSchedules(ride)}>
                      {/* Image */}
                      <div className="relative h-48 bg-white overflow-hidden"
                        onClick={e => { e.stopPropagation(); const u = getImageUrl(ride.imagePath); if (u) setZoomSrc(u) }}>
                        {ride.imagePath ? (
                          <>
                            <img src={getImageUrl(ride.imagePath)!} alt={ride.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-gray-700" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <img src="/images__6_-removebg-preview.png" alt="AmuseFlow" className="w-20 h-20 object-contain" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
                          ₱{fmt(ride.price)}
                        </div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-gray-900 text-base mb-1 truncate">{ride.name}</h4>
                        <p className="text-xs text-gray-400 line-clamp-2 mb-3 min-h-[2rem]">{ride.description ?? 'No description'}</p>
                        <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ride.maxCapacity}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ride.durationMinutes}m</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); fetchSchedules(ride) }}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm">
                          <Calendar className="w-3.5 h-3.5" /> View schedules
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-5 pt-4 pb-3 mt-1 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Showing <strong>{rides.length}</strong> of <strong>{ridePag.totalCount}</strong> rides</span>
                  {ridePag.totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        Page <strong>{rideParams.page ?? 1}</strong> of <strong>{ridePag.totalPages}</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setRideParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                          disabled={(rideParams.page ?? 1) <= 1}
                          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRideParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                          disabled={(rideParams.page ?? 1) >= ridePag.totalPages}
                          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          // ── Schedules for selected ride ──────────────────────
          <>
            <div className="px-5 py-4 border-b border-gray-100">
              <button onClick={() => setSelectedRide(null)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to rides
              </button>
              <div className="flex items-start gap-4">
                {selectedRide.imagePath && (
                  <img src={getImageUrl(selectedRide.imagePath)!} alt={selectedRide.name}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                )}
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedRide.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{selectedRide.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedRide.durationMinutes}m</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedRide.maxCapacity} capacity</span>
                    <span className="font-bold text-emerald-600">₱{fmt(selectedRide.price)}</span>
                  </div>
                </div>
              </div>
            </div>

            {schedLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <Calendar className="w-14 h-14 mb-3 text-gray-200" />
                <div className="font-semibold text-gray-500">No available schedules</div>
                <div className="text-xs mt-1">Check back later for upcoming slots.</div>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {schedules.map(s => (
                  <div key={s.id}
                    className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-gray-900 text-sm">
                            {new Date(s.scheduleDate).toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                        </div>
                        <CallTimeBadge time={s.callTime} className="text-[11px] mt-1" />
                      </div>
                      <Badge label={s.status} />
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      <span className="font-medium text-gray-900">{s.availableSlots}</span>/{s.maxSlots} slots left
                      </span>
                        {s.attendantName && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                          <UserCog className="w-3 h-3" /> {s.attendantName}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-emerald-600 text-sm">₱{fmt(selectedRide.price)}</span>
                    </div>

                    {/* Slot bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.max(5, (s.availableSlots / s.maxSlots) * 100)}%` }} />
                    </div>

                    <button
                      onClick={() => setBookTarget({
                        scheduleId: s.id,
                        rideName: selectedRide.name,
                        date: s.scheduleDate,
                        time: s.startTime?.slice(0,5) ?? '',
                        price: selectedRide.price
                      })}
                      disabled={s.availableSlots <= 0 || s.status !== 'Open'}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      <Ticket className="w-3.5 h-3.5" />
                      {s.availableSlots <= 0 ? 'Fully booked' : 'Book this slot'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )
        ) : (
          // ── Promos ──────────────────────────────────────────
          !selectedPromo ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-pink-500" /> Ride promos
                  </h3>
                  <p className="text-xs text-gray-500">Bundle deals — click a promo to pick schedules and book.</p>
                </div>
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>

              {promoLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
                </div>
              ) : promos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                  <Tag className="w-14 h-14 mb-3 text-gray-200" />
                  <div className="font-semibold text-gray-500">No promos available</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {promos.map(promo => {
                    const available = promoIsAvailable(promo)
                    return (
                      <div key={promo.id}
                        className={`border border-gray-200 rounded-2xl overflow-hidden hover:border-pink-300 hover:shadow-md transition-all group cursor-pointer ${!available ? 'opacity-60' : ''}`}
                        onClick={() => available && openPromo(promo)}>
                        <div className="relative h-40 bg-white overflow-hidden"
                          onClick={e => { e.stopPropagation(); const u = getImageUrl(promo.imagePath); if (u) setZoomSrc(u) }}>
                          {promo.imagePath ? (
                            <img src={getImageUrl(promo.imagePath)!} alt={promo.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-pink-50">
                              <Tag className="w-10 h-10 text-pink-200" />
                            </div>
                          )}
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-pink-700 font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
                            ₱{fmt(promo.price)}
                          </div>
                          {!available && (
                            <div className="absolute top-3 left-3 bg-gray-900/80 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                              Expired
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 text-base mb-1 truncate">{promo.name}</h4>
                          <p className="text-xs text-gray-400 line-clamp-2 mb-2 min-h-[2rem]">{promo.description ?? 'No description'}</p>
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-pink-700 bg-pink-50 border border-pink-100 rounded-lg px-2 py-1 mb-2">
                            <Calendar className="w-3.5 h-3.5" />
                            {promo.promoDate.slice(0, 10)}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {promo.rides.map(r => (
                              <span key={r.rideId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-medium border border-pink-100">
                                <FerrisWheel className="w-3 h-3" /> {r.rideName}
                              </span>
                            ))}
                          </div>
                          <button disabled={!available}
                            onClick={e => { e.stopPropagation(); if (available) openPromo(promo) }}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <PackageCheck className="w-3.5 h-3.5" /> {available ? 'View details' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-gray-100">
                <button onClick={() => setSelectedPromo(null)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to promos
                </button>
                <div className="flex items-start gap-4">
                  {selectedPromo.imagePath && (
                    <img src={getImageUrl(selectedPromo.imagePath)!} alt={selectedPromo.name}
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedPromo.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{selectedPromo.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-semibold text-pink-600"><Calendar className="w-3 h-3" />{selectedPromo.promoDate.slice(0, 10)}</span>
                      <span className="font-bold text-pink-600">₱{fmt(selectedPromo.price)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Each ride's schedule is already LOCKED IN by the admin —
                  nothing to pick here, just review and book. */}
              <div className="p-5 space-y-3">
                {selectedPromo.rides.map(ride => {
                  // ✅ CHANGED — matches promoHasSlots: a ride whose window
                  // already elapsed today (auto-flipped to "Completed") no
                  // longer counts as "Full" for promo purposes — only no
                  // slots left or an explicit Cancelled does.
                  const full = ride.availableSlots <= 0 || ride.scheduleStatus === 'Cancelled'
                  return (
                    <div key={ride.rideId} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FerrisWheel className="w-4 h-4 text-pink-500 flex-shrink-0" />
                            <span className="font-semibold text-gray-900 text-sm truncate">{ride.rideName}</span>
                          </div>
                          {ride.rideDescription && (
                            <p className="text-xs text-gray-400 line-clamp-2 mb-1.5">{ride.rideDescription}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ride.scheduleDate.slice(0, 10)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmtTime(ride.startTime)} – {fmtTime(ride.endTime)}
                            </span>
                            <CallTimeBadge time={ride.callTime} className="text-[11px]" />
                          </div>
                        </div>
                        <Badge label={full ? 'Full' : 'Available'} />
                      </div>
                      <div className="text-[11px] text-gray-400 mt-2">
                        {ride.availableSlots}/{ride.maxSlots} slots left
                      </div>
                    </div>
                  )
                })}

                <button
                  onClick={() => setPromoBookTarget(selectedPromo)}
                  disabled={!promoHasSlots(selectedPromo)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <PackageCheck className="w-4 h-4" />
                  {promoHasSlots(selectedPromo) ? `Book this promo — ₱${fmt(selectedPromo.price)}` : 'No slots left for this promo'}
                </button>
              </div>
            </>
          )
        )}
      </div>

      {/* My Bookings */}
      <div ref={bookingsSectionRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm scroll-mt-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-500" /> My bookings
            </h3>
            <p className="text-xs text-gray-500">Your ride reservation history.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input value={bookSearch}
                onChange={e => { setBookSearch(e.target.value); setBookParams(p => ({ ...p, page: 1 })) }}
                placeholder="Search code or ride..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-48 bg-gray-50" />
            </div>
            <DateRangeButton
              from={bookDateFrom} to={bookDateTo}
              onClick={() => setBookDateModalOpen(true)}
            />
            <span className="text-xs text-gray-400 font-medium">{bookPag.totalCount} total</span>
          </div>
        </div>
        {bookLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Ticket className="w-14 h-14 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">No bookings found</div>
            <div className="text-xs mt-1">
              {bookSearch || bookDateFrom || bookDateTo ? 'Try adjusting your filters.' : 'Pick a ride above to get started.'}
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {bookings.map(b => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                  {b.promoId ? (
                    // ── Promo booking — ONE booking row covering 2+ rides ──
                    <div className="flex items-start gap-3 sm:contents">
                      <div
                        className="relative w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => { const u = getImageUrl(b.promoImagePath); if (u) setZoomSrc(u) }}>
                        {b.promoImagePath ? (
                          <img src={getImageUrl(b.promoImagePath)!} alt={b.promoName}
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <Tag className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 sm:flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">{b.promoName}</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-semibold border border-pink-100">
                            <PackageCheck className="w-3 h-3" /> Promo
                          </span>
                        </div>
                        <div className="font-mono text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded font-semibold inline-block mb-1">
                          {b.bookingCode}
                        </div>
                        <div className="space-y-1 mt-1">
                          {(b.includedRides ?? []).map(r => (
                            <div key={r.rideId} className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                              <FerrisWheel className="w-3 h-3 text-pink-400" />
                              <span className="font-medium text-gray-700">{r.rideName}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.scheduleDate.slice(0, 10)}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(r.startTime)} – {fmtTime(r.endTime)}</span>
                              <CallTimeBadge time={r.callTime} className="text-[11px]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 sm:contents">
                      <div
                        className="group/thumb relative w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => { const u = getImageUrl(b.rideImagePath); if (u) setZoomSrc(u) }}>
                        {b.rideImagePath ? (
                          <>
                            <img src={getImageUrl(b.rideImagePath)!} alt={b.rideName}
                              className="w-full h-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </>
                        ) : (
                          <FerrisWheel className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 sm:flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm mb-0.5">{b.rideName}</div>
                        {b.rideDescription && (
                          <div className="text-xs text-gray-400 line-clamp-1 mb-1">{b.rideDescription}</div>
                        )}
                        <div className="font-mono text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded font-semibold inline-block mb-1">
                          {b.bookingCode}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {b.scheduleDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.startTime ? `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}` : '—'}
                          </span>
                          <CallTimeBadge time={b.callTime} className="text-[11px]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge label={b.status} />
                      <Badge label={b.paymentStatus} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900 text-sm">₱{fmt(b.ridePrice)}</div>
                      {/* ✅ FIXED — was dumping the raw ISO string (e.g.
                          "2026-07-11T00:23:58.0933333") straight into the DOM.
                          Now shows date + 12-hour time together via fmtDateTime. */}
                      {b.paidAt && (
                        <div className="text-[10px] text-gray-400 mt-0.5">Paid {fmtDateTime(b.paidAt)}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {b.status !== 'Completed' && b.status !== 'Cancelled' && b.status !== 'Rejected' && b.status !== 'Missed' && (
                        <button onClick={() => setCancelTarget(b)} title="Cancel booking"
                          className="flex items-center justify-center w-8 h-8 bg-white text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Page <strong>{bookPag.currentPage}</strong> of <strong>{bookPag.totalPages}</strong></span>
              <div className="flex items-center gap-1">
                <button onClick={() => setBookParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(bookParams.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setBookParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(bookParams.page ?? 1) >= bookPag.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm Book */}
      {bookTarget && (
        <ConfirmModal
          title="Book this slot?"
          message={`Book "${bookTarget.rideName}" on ${bookTarget.date} at ${bookTarget.time}? Price: ₱${fmt(bookTarget.price)}`}
          confirmLabel="Yes, book now"
          onConfirm={doBook}
          onCancel={() => setBookTarget(null)}
          loading={bookingLoading}
        />
      )}

      {/* Confirm Book Promo */}
      {promoBookTarget && (
        <ConfirmModal
          title="Book this promo?"
          message={`Book "${promoBookTarget.name}" covering ${promoBookTarget.rides.length} rides as one booking? Price: ₱${fmt(promoBookTarget.price)}`}
          confirmLabel="Yes, book now"
          onConfirm={doBookPromo}
          onCancel={() => setPromoBookTarget(null)}
          loading={promoBookingLoading}
        />
      )}

      {/* Confirm Cancel */}
      {cancelTarget && (
        <ConfirmModal
          title="Cancel booking?"
          message={`Cancel your booking for "${cancelTarget.rideName}"? This cannot be undone.`}
          confirmLabel="Yes, cancel"
          danger
          onConfirm={doCancel}
          onCancel={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}

      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}

      {bookDateModalOpen && (
        <DateRangeModal
          from={bookDateFrom} to={bookDateTo}
          onApply={(f, t) => { setBookDateFrom(f); setBookDateTo(t); setBookParams(p => ({ ...p, page: 1 })) }}
          onClose={() => setBookDateModalOpen(false)}
        />
      )}
    </div>
  )
}
