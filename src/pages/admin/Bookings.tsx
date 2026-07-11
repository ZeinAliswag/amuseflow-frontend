import { useEffect, useState } from 'react'
import {
  CheckCircle2, XCircle, Ticket, Waves,
  Calendar, Clock, ChevronLeft, ChevronRight,
  Search, Loader2, X, ChevronDown, CalendarDays, Phone,
  FerrisWheel, AlarmClock
} from 'lucide-react'
import type { Booking, PaginationRequest } from '../../types'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (n: any) => Number(n ?? 0).toFixed(2)

const STATUS_OPTS = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed', 'Missed']
const PAY_OPTS   = ['Paid', 'Unpaid']

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

// Formats a TimeOnly string ("10:20:00") into "10:20 AM"
const fmtTime = (t?: string) => {
  if (!t) return '—'
  return new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

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

// Pulls the friendliest error message out of an axios error — handles both
// { message } responses and ASP.NET Core ModelState validation payloads
// ({ errors: { CallTime: ["..."] } }), which is how the [TimeBefore] data
// annotation on the schedule DTOs surfaces its message.
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

// Mask everything after the date segment, e.g. AF-20260707-EF56D1 → AF-20260707-••••••
function maskCode(code?: string) {
  if (!code) return ''
  const parts = code.split('-')
  if (parts.length < 3) return code.replace(/./g, '•')
  const visible = parts.slice(0, 2).join('-')
  const hiddenLen = parts.slice(2).join('-').length
  return `${visible}-${'•'.repeat(hiddenLen)}`
}

function Badge({ label }: { label: string }) {
  const map: Record<string,string> = {
    Paid:'bg-green-100 text-green-700', Unpaid:'bg-amber-100 text-amber-700',
    Pending:'bg-amber-100 text-amber-700', Approved:'bg-green-100 text-green-700',
    Rejected:'bg-red-100 text-red-700', Completed:'bg-blue-100 text-blue-700',
    // ✅ Missed now gets its own color (orange) — it used to share the exact
    // same red as Rejected, making the two impossible to tell apart at a glance.
    Cancelled:'bg-gray-100 text-gray-600', Missed:'bg-orange-100 text-orange-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

const STATUS_DOT: Record<string,string> = {
  Pending:'bg-amber-500', Approved:'bg-green-500', Rejected:'bg-red-500',
  Completed:'bg-blue-500', Cancelled:'bg-gray-400', Missed:'bg-orange-500',
}
const PAY_DOT: Record<string,string> = {
  Paid:'bg-green-500', Unpaid:'bg-amber-500',
}

// ── Generic Filter Dropdown (status / payment) ──────────────────
function FilterDropdown({ label, allLabel, options, dots, value, onChange, accent = 'emerald' }: {
  label: string; allLabel: string; options: string[]; dots: Record<string,string>
  value: string; onChange: (v: string) => void
  accent?: 'emerald' | 'blue'
}) {
  const [open, setOpen] = useState(false)
  const activeBg = accent === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'

  const current = value || allLabel

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          value ? `${activeBg} text-white border-transparent shadow-sm` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}>
        {value && <span className={`w-2 h-2 rounded-full ${dots[value] ?? 'bg-white'} ring-2 ring-white/40`} />}
        {label}: {current}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                !value ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              {allLabel}
            </button>
            {options.map(o => (
              <button key={o} type="button"
                onClick={() => { onChange(o); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === o ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`w-2 h-2 rounded-full ${dots[o] ?? 'bg-gray-300'}`} />
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Mini Calendar — real month grid, restyled to match the app's other
// calendar pickers: fully-rounded (pill) day cells and a single full-width
// "Jump to today" pill button, all in a neutral gray palette. Click once to
// set the range start, click again to set the end (earlier date auto-
// becomes "from"). ──
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Month/Year dropdown — jump straight to any month or year (past or
// future) instead of clicking prev/next one month at a time. ──
function MonthYearDropdown({ year, month, onChange, onClose }: {
  year: number; month: number
  onChange: (year: number, month: number) => void
  onClose: () => void
}) {
  const [viewYear, setViewYear] = useState(year)
  const today = new Date()

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute z-40 mt-2 left-1/2 -translate-x-1/2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
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
        <div className="grid grid-cols-3 gap-2 p-4">
          {MONTHS.map((m, i) => {
            const isSelected = viewYear === year && i === month
            const isCurrent = viewYear === today.getFullYear() && i === today.getMonth()
            return (
              <button key={m} type="button"
                onClick={() => { onChange(viewYear, i); onClose() }}
                className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-gray-800 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
        <div className="px-4 pb-4">
          <button type="button"
            onClick={() => { onChange(today.getFullYear(), today.getMonth()); onClose() }}
            className="w-full py-2 rounded-xl text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
            Jump to today
          </button>
        </div>
      </div>
    </>
  )
}

function MiniCalendar({ from, to, onChange }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
}) {
  const base = from ? new Date(from + 'T00:00:00') : new Date()
  const [viewMonth, setViewMonth] = useState(base.getMonth())
  const [viewYear, setViewYear]   = useState(base.getFullYear())
  const [pickerOpen, setPickerOpen] = useState(false)
  const todayISO = toISO(new Date())

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const dateISO = (d: number) => toISO(new Date(viewYear, viewMonth, d))

  const gotoPrev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const gotoNext = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const handlePick = (d: number) => {
    const iso = dateISO(d)
    if (!from || (from && to)) {
      onChange(iso, '')
    } else {
      onChange(iso < from ? iso : from, iso < from ? from : iso)
    }
  }

  const gotoToday = () => {
    const t = new Date()
    setViewMonth(t.getMonth()); setViewYear(t.getFullYear())
    onChange(todayISO, todayISO)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={gotoPrev}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="relative">
          <button type="button" onClick={() => setPickerOpen(p => !p)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-bold text-gray-900">{monthLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <MonthYearDropdown
              year={viewYear} month={viewMonth}
              onChange={(y, m) => { setViewYear(y); setViewMonth(m) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <button type="button" onClick={gotoNext}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-[10px] font-semibold text-gray-400 text-center py-1">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />
          const iso = dateISO(d)
          const isStart = iso === from
          const isEnd = iso === to
          const inRange = !!from && !!to && iso > from && iso < to
          const isToday = iso === todayISO
          return (
            <div key={iso} className="flex items-center justify-center">
              <button type="button" onClick={() => handlePick(d)}
                className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${
                  isStart || isEnd
                    ? 'bg-gray-800 text-white font-bold shadow-sm'
                    : inRange
                    ? 'bg-gray-100 text-gray-700 font-medium'
                    : isToday
                    ? 'border border-gray-400 text-gray-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {d}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer — single full-width pill, matching the app's other pickers */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={gotoToday}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Jump to today
        </button>
      </div>
    </div>
  )
}

// ── Date Range Modal (centered dialog, real calendar grid instead of
// raw text date inputs) ──────────────────────────────────────────
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
            <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-gray-600" />
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
                      active ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Pick a date {tempFrom && tempTo ? (tempFrom === tempTo ? `— ${fmtShort(tempFrom)}` : `— ${fmtShort(tempFrom)} to ${fmtShort(tempTo)}`) : ''}
            </div>
            <MiniCalendar from={tempFrom} to={tempTo} onChange={(f, t) => { setTempFrom(f); setTempTo(t) }} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button type="button" onClick={() => { setTempFrom(''); setTempTo('') }}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Clear
          </button>
          <button type="button" onClick={() => { onApply(tempFrom, tempTo); onClose() }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 transition-colors">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Date Range Trigger Button — plain icon + bold label + chevron, matching
// the calendar trigger style used on the Schedules page (no filled pill). ──
function DateRangeButton({ from, to, onClick }: { from: string; to: string; onClick: () => void }) {
  const label = !from && !to
    ? 'All dates'
    : from && to
      ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`)
      : from ? `From ${fmtShort(from)}` : `Until ${fmtShort(to)}`

  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
      <Calendar className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────
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
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminBookingsPage() {
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [pagination, setPagination] = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:15 })
  const [params, setParams]         = useState<PaginationRequest>({ page:1, pageSize:15, search:'' })
  const [statusFilter, setStatusFilter] = useState('')
  const [payFilter, setPayFilter]       = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')

  // confirm modals
  const [approveTarget, setApproveTarget] = useState<Booking | null>(null)
  const [rejectTarget, setRejectTarget]   = useState<Booking | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { fetchBookings() }, [params, statusFilter, payFilter, dateFrom, dateTo])

  // Runs automatically in the background, no button needed. Marks expired
  // schedules Completed and unpaid Approved bookings Missed, then silently
  // refreshes the list. Repeats every minute so statuses stay current even
  // if the admin leaves this page open.
  useEffect(() => {
    let cancelled = false
    const runAutomation = async () => {
      try {
        await api.put('/api/schedule/auto-complete')
        await api.put('/api/booking/auto-flag-missed')
      } catch {
        // silent — background sync shouldn't interrupt the admin with errors
      }
      if (!cancelled) fetchBookings()
    }
    runAutomation()
    const interval = setInterval(runAutomation, 60000)
    return () => { cancelled = true; clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const q = [params.search, statusFilter, payFilter].filter(Boolean).join(' ')
      const res = await api.get('/api/booking', {
        params: {
          ...params,
          search: q || undefined,
          fromDate: dateFrom || undefined,
          toDate: dateTo || undefined,
        }
      })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      let list: Booking[] = Array.isArray(d) ? d : []
      // client-side fallback filter in case the API doesn't support fromDate/toDate yet
      if (dateFrom) list = list.filter(b => (b.scheduleDate ?? '') >= dateFrom)
      if (dateTo)   list = list.filter(b => (b.scheduleDate ?? '') <= dateTo)
      setBookings(list)
      const pg = res.data?.data?.pagination ?? res.data?.pagination
      if (pg) setPagination(pg)
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load bookings.')) }
    finally { setLoading(false) }
  }

  const doApprove = async () => {
    if (!approveTarget) return
    setActionLoading(true)
    try {
      await api.put(`/api/booking/${approveTarget.id}/status`, { status: 'Approved' })
      toast.success('Booking approved.')
      setApproveTarget(null); fetchBookings()
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to approve.')) }
    finally { setActionLoading(false) }
  }

  const doReject = async () => {
    if (!rejectTarget) return
    setActionLoading(true)
    try {
      await api.put(`/api/booking/${rejectTarget.id}/status`, { status: 'Rejected' })
      toast.success('Booking rejected.')
      setRejectTarget(null); fetchBookings()
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to reject.')) }
    finally { setActionLoading(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage bookings</h1>
          <p className="text-sm text-gray-500 mt-1">Approve, reject and view all ride reservations.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        {/* Filters */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap rounded-t-2xl">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input value={search}
              onChange={e => { setSearch(e.target.value); setParams(p => ({ ...p, search: e.target.value, page: 1 })) }}
              placeholder="Search by code, visitor, ride..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-56 bg-gray-50" />
          </div>

          {/* Status filter */}
          <FilterDropdown
            label="Status" allLabel="All statuses"
            options={STATUS_OPTS} dots={STATUS_DOT}
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setParams(p => ({ ...p, page: 1 })) }}
            accent="emerald"
          />

          {/* Payment filter */}
          <FilterDropdown
            label="Payment" allLabel="All payment"
            options={PAY_OPTS} dots={PAY_DOT}
            value={payFilter}
            onChange={v => { setPayFilter(v); setParams(p => ({ ...p, page: 1 })) }}
            accent="emerald"
          />

          {/* Date range — opens a centered modal, no dropdown */}
          <DateRangeButton
            from={dateFrom} to={dateTo}
            onClick={() => setDateModalOpen(true)}
          />
        </div>

        <div className="overflow-hidden rounded-b-2xl">
        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Ticket className="w-14 h-14 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">No bookings found</div>
            <div className="text-xs mt-1">Try adjusting your filters.</div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-300">
              {bookings.map(b => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                  <div className="flex items-center gap-3 sm:contents">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {b.visitorName?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>

                    {/* Visitor + booking code */}
                    <div className="flex-1 sm:w-40 sm:flex-shrink-0 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{b.visitorName}</div>
                      <div className="text-[10px] text-gray-400">@{b.visitorUsername}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="font-mono text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded font-semibold">{maskCode(b.bookingCode)}</span>
                        {b.visitorContactNumber ? (
                        <span className="flex items-center gap-1 text-xs text-cyan-700 bg-cyan-100 px-2 py-1 rounded font-semibold">
                          <Phone className="w-3 h-3" />{b.visitorContactNumber}
                        </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded font-medium italic">
                            <Phone className="w-3 h-3" />No number
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ride info */}
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <FerrisWheel className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 text-sm truncate">{b.rideName}</span>
                  </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.scheduleDate}</span>
                      <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {b.startTime ? `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}` : '—'}
                      </span>
                      <CallTimeBadge time={b.callTime} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                    {/* Price */}
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="font-bold text-gray-900 text-sm">₱{fmt(b.ridePrice)}</div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge label={b.status} />
                    <Badge label={b.paymentStatus} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 sm:min-w-[140px] justify-end">
                      {b.status === 'Pending' ? (
                        <>
                          <button onClick={() => setApproveTarget(b)} title="Approve"
                            className="flex items-center justify-center w-8 h-8 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-xl transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRejectTarget(b)} title="Reject"
                            className="flex items-center justify-center w-8 h-8 bg-white text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No action</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Showing <strong>{bookings.length}</strong> of <strong>{pagination.totalCount}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(params.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const cur = params.page ?? 1
                  return Math.max(1, cur - 2) + i
                }).filter(p => p <= pagination.totalPages).map(p => (
                  <button key={p} onClick={() => setParams(prev => ({ ...prev, page: p }))}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                      p === (params.page ?? 1) ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                    }`}>{p}</button>
                ))}
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(params.page ?? 1) >= pagination.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <select value={params.pageSize ?? 15}
                onChange={e => setParams(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none">
                {[10,15,25,50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Confirm Approve */}
      {approveTarget && (
        <ConfirmModal
          title="Approve booking?"
          message={`Approve ${approveTarget.visitorName}'s booking for "${approveTarget.rideName}"?`}
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
          message={`Reject ${rejectTarget.visitorName}'s booking for "${rejectTarget.rideName}"?`}
          confirmLabel="Yes, reject"
          danger
          onConfirm={doReject}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading}
        />
      )}

      {dateModalOpen && (
        <DateRangeModal
          from={dateFrom} to={dateTo}
          onApply={(f, t) => { setDateFrom(f); setDateTo(t); setParams(p => ({ ...p, page: 1 })) }}
          onClose={() => setDateModalOpen(false)}
        />
      )}
    </div>
  )
}
