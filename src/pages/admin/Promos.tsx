import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, RotateCcw, Upload,
  CheckCircle2, Search,
  ChevronLeft, ChevronRight, ZoomIn, X, Loader2, ChevronDown,
  Tag, Calendar, FerrisWheel, Check, Clock, AlarmClock, CalendarCheck,
  Eye, CalendarDays, Layers, CheckCheck, Users
} from 'lucide-react'
import type { RidePromo, Ride, Schedule, PaginationRequest } from '../../types'
import api, { promoApi } from '../../services/api'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const fmt = (n: any) => Number(n ?? 0).toFixed(2)

// Formats a TimeOnly string ("10:20:00") into "10:20 AM"
function fmtTime(t?: string) {
  if (!t) return '—'
  return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ✅ CHANGED — numeric "2026-07-13" instead of "Jul 13, 2026", matching the
// date format already used in My Bookings.
function fmtDate(d?: string) {
  if (!d) return '—'
  return d.slice(0, 10)
}

const fmtShort = (iso: string) => iso.slice(0, 10)

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ✅ CHANGED — was locked purely on promo.promoDate (so a promo became
// uneditable the whole day it was scheduled, even hours before anything
// actually started). Now locks the moment the EARLIEST call time among its
// bundled rides has passed — falling back to each ride's start time if a
// ride has no call time set. "HH:mm:ss" strings sort correctly as plain
// strings, so picking the earliest is just a lexicographic min.
function earliestCallDateTime(promo: RidePromo): Date | null {
  const times = promo.rides
    .map(r => r.callTime || r.startTime)
    .filter((t): t is string => !!t)
  if (!times.length) return null
  const earliest = times.sort()[0]
  return new Date(`${promo.promoDate.slice(0, 10)}T${earliest}`)
}

function isPromoLocked(promo: RidePromo): boolean {
  if (promo.isDeleted) return false
  const lockAt = earliestCallDateTime(promo)
  // No call/start time on any ride (shouldn't normally happen) — fall back
  // to the old date-only behavior so nothing becomes silently uneditable.
  return lockAt ? new Date() >= lockAt : promo.promoDate.slice(0, 10) <= toISO(new Date())
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Purple, past-dates-disabled single date picker for the promo date field.
// Same card/grid/Clear+Today layout as the app's other calendar pickers,
// just single-select and emerald-themed to match the rest of this modal. ──
function PromoDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  // ✅ FIXED — this field lives inside the Create/Edit modal, which scrolls
  // (overflow-y-auto). An `absolute` dropdown gets clipped by that ancestor's
  // scroll box no matter its z-index, which is why the calendar was
  // rendering cut off / bleeding through other fields. Fixed positioning,
  // computed from the trigger button's own on-screen position, escapes that
  // clipping entirely.
  const btnRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const base = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewMonth, setViewMonth] = useState(base.getMonth())
  const [viewYear, setViewYear] = useState(base.getFullYear())
  const todayISO = toISO(new Date())

  // ✅ FIXED — previously clamped against the full viewport width, which on
  // a narrower window pulled the popup way off to the left of the button
  // itself (overlapping the field to its left / the modal's edge) even
  // though there was nothing wrong with the button's own position. Now the
  // popup stays anchored under the button and only shifts left the minimum
  // amount needed to stay on-screen.
  const POPUP_WIDTH = 288 // w-72
  const openPicker = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      let left = rect.left
      if (left + POPUP_WIDTH > window.innerWidth - 8) left = window.innerWidth - 8 - POPUP_WIDTH
      setCoords({ top: rect.bottom + 8, left: Math.max(8, left) })
    }
    setOpen(true)
  }

  // Close instead of drifting out of alignment if the modal scrolls or the
  // window resizes while the panel is open.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

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
    if (iso <= todayISO) return
    onChange(iso)
    setOpen(false)
  }

  // ✅ CHANGED — today itself is no longer a valid promo date, so this
  // button just jumps the calendar view to the current month instead of
  // selecting today's date.
  const gotoToday = () => {
    const t = new Date()
    setViewMonth(t.getMonth()); setViewYear(t.getFullYear())
  }

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => (open ? setOpen(false) : openPicker())}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white hover:bg-gray-50 transition-colors">
        <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value ? fmtDate(value) : 'Select a date'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed z-[70] w-72 bg-white rounded-2xl border border-emerald-100 shadow-xl p-4"
            style={{ top: coords.top, left: coords.left }}>
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={gotoPrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-gray-900">{monthLabel}</span>
              <button type="button" onClick={gotoNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(w => (
                <div key={w} className="text-[10px] font-semibold text-gray-400 text-center py-1">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={`empty-${i}`} />
                const iso = dateISO(d)
                // ✅ CHANGED — today is also disabled now, not just earlier
                // dates. Promos must be created for a future date only.
                const isPast = iso <= todayISO
                const isSelected = iso === value
                return (
                  <div key={iso} className="flex items-center justify-center">
                    <button type="button" disabled={isPast} onClick={() => handlePick(d)}
                      className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold shadow-sm'
                          : isPast
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-emerald-50'
                      }`}>
                      {d}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="flex-1 py-2 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Clear
              </button>
              <button type="button" onClick={gotoToday}
                className="flex-1 py-2 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Filter-by-date (range) — same quick-presets + calendar + Clear/Apply
// pattern as the Bookings page, gray-themed. Past dates are NOT disabled
// here (unlike PromoDatePicker above) since this filters over promos that
// may already be Completed. ──────────────────────────────────────────
function PromoRangeCalendar({ from, to, onChange }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
}) {
  const base = from ? new Date(from + 'T00:00:00') : new Date()
  const [viewMonth, setViewMonth] = useState(base.getMonth())
  const [viewYear, setViewYear] = useState(base.getFullYear())
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
    if (!from || (from && to)) onChange(iso, '')
    else onChange(iso < from ? iso : from, iso < from ? from : iso)
  }

  const gotoToday = () => {
    const t = new Date()
    setViewMonth(t.getMonth()); setViewYear(t.getFullYear())
    onChange(todayISO, todayISO)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={gotoPrev}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-gray-900">{monthLabel}</span>
        <button type="button" onClick={gotoNext}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-[10px] font-semibold text-gray-400 text-center py-1">{w}</div>
        ))}
      </div>

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

      <div className="mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={gotoToday}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Jump to today
        </button>
      </div>
    </div>
  )
}

function PromoDateRangeModal({ from, to, onApply, onClose }: {
  from: string; to: string
  onApply: (from: string, to: string) => void
  onClose: () => void
}) {
  const [tempFrom, setTempFrom] = useState(from)
  const [tempTo, setTempTo] = useState(to)
  const today = new Date()

  const presets = [
    { label: 'Today', get: () => { const d = toISO(today); return [d, d] as [string, string] } },
    { label: 'Yesterday', get: () => { const d = new Date(today); d.setDate(d.getDate() - 1); const s = toISO(d); return [s, s] as [string, string] } },
    { label: 'Last 7 days', get: () => { const s = new Date(today); s.setDate(s.getDate() - 6); return [toISO(s), toISO(today)] as [string, string] } },
    { label: 'Last 30 days', get: () => { const s = new Date(today); s.setDate(s.getDate() - 29); return [toISO(s), toISO(today)] as [string, string] } },
    { label: 'This month', get: () => { const s = new Date(today.getFullYear(), today.getMonth(), 1); return [toISO(s), toISO(today)] as [string, string] } },
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
            <PromoRangeCalendar from={tempFrom} to={tempTo} onChange={(f, t) => { setTempFrom(f); setTempTo(t) }} />
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

function DateRangeButton({ from, to, onClick }: { from: string; to: string; onClick: () => void }) {
  const label = !from && !to
    ? 'All dates'
    : from && to
      ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`)
      : from ? `From ${fmtShort(from)}` : `Until ${fmtShort(to)}`

  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-800 transition-colors">
      <CalendarDays className="w-4 h-4 text-gray-500" />
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  )
}

function Spinner() {
  return <div className="w-7 h-7 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
}

// ✅ CHANGED — swapped the small plain amber "Call {time}" text for the same
// red pill badge used everywhere else in the app (Bookings, My Bookings,
// Attendant check-in), instead of a bespoke small style just for this page.
function CallTimeBadge({ time, className = '' }: { time?: string; className?: string }) {
  if (!time) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold shadow-sm ${className}`}>
      <AlarmClock className="w-3 h-3" />
      Call time: {fmtTime(time)}
    </span>
  )
}

function Badge({ label }: { label: string }) {
  const map: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Completed: 'bg-blue-100 text-blue-700',
    Deleted: 'bg-red-100 text-red-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

// Ride SCHEDULE status (Open/Full/Cancelled/Completed) — distinct from the
// promo-level Active/Completed Badge above, matching the color scheme
// already used for schedule status everywhere else in the app.
function ScheduleStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Open: 'bg-green-100 text-green-700',
    Full: 'bg-red-100 text-red-700',
    Completed: 'bg-blue-100 text-blue-700',
    Cancelled: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

// ✅ NEW — full ride list for a promo, styled to match the schedule cards on
// the Schedules page (rounded card, name + status badge row, clock+time,
// slots, call time pill) instead of cramming every ride into the small
// promo card on the main grid.
function PromoRidesModal({ promo, onClose }: { promo: RidePromo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm truncate">{promo.name}</div>
            <div className="text-xs text-gray-400">{promo.rides.length} rides included · {fmtDate(promo.promoDate)}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {promo.rides.map(r => (
            <div key={r.rideId} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-gray-900 text-sm">{r.rideName}</div>
                <ScheduleStatusBadge status={r.scheduleStatus} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {r.availableSlots}/{r.maxSlots} slots
                </div>
              </div>
              <CallTimeBadge time={r.callTime} className="text-[11px]" />
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ✅ CHANGED — was labeled "Active", which collided with the Active/Completed
// lifecycle chips below (two different "Active"s on screen at once). This is
// really "not soft-deleted", so it's now labeled "Available" with its own icon.
const STATUS_OPTS = [
  { value: 'active', label: 'Available', icon: <Eye className="w-3.5 h-3.5 text-green-600" /> },
  { value: 'all', label: 'All', icon: <Tag className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'deleted', label: 'Deleted', icon: <Trash2 className="w-3.5 h-3.5 text-red-500" /> },
] as const

function StatusCombobox({ value, onChange }: {
  value: 'active' | 'all' | 'deleted'
  onChange: (v: 'active' | 'all' | 'deleted') => void
}) {
  const [open, setOpen] = useState(false)
  const current = STATUS_OPTS.find(o => o.value === value)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current?.icon}
        {current?.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {STATUS_OPTS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === o.value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ✅ CHANGED — was a row of chip/pill buttons; now a combobox matching the
// "Available" and "All dates" filters next to it, per request.
const LIFECYCLE_OPTS = [
  { value: 'Active', label: 'Active', icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> },
  { value: 'All', label: 'All', icon: <Layers className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Completed', label: 'Completed', icon: <CheckCheck className="w-3.5 h-3.5 text-blue-600" /> },
] as const

function LifecycleCombobox({ value, onChange }: {
  value: 'Active' | 'All' | 'Completed'
  onChange: (v: 'Active' | 'All' | 'Completed') => void
}) {
  const [open, setOpen] = useState(false)
  const current = LIFECYCLE_OPTS.find(o => o.value === value)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current?.icon}
        {current?.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {LIFECYCLE_OPTS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === o.value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {o.icon}
                {o.label}
              </button>
            ))}
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
          {danger ? <Trash2 className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">{title}</div>
        <div className="text-[12px] text-gray-500 mb-6">{message}</div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
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
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10">
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img src={src} alt="Promo" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    </div>
  )
}

const emptyForm = {
  name: '', description: '', price: '' as string | number,
  // ✅ CHANGED — single-day promos only. One date drives everything: the
  // promo's availability AND which schedules are selectable per ride below.
  promoDate: '', rideIds: [] as number[],
  // ✅ NEW — the admin locks in one schedule per selected ride right here,
  // at promo-creation time (rideId -> scheduleId).
  scheduleByRide: {} as Record<number, number>,
}

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<RidePromo[]>([])
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 8 })
  const [params, setParams] = useState<PaginationRequest>({ page: 1, pageSize: 8, search: '' })
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'deleted'>('active')
  // ✅ NEW — Active/Completed filter, same chip pattern as the Ride
  // Attendant's schedule status filter. Independent of the soft-delete
  // filter above (a deleted promo can still have been Active or Completed).
  const [activeStatus, setActiveStatus] = useState<'All' | 'Active' | 'Completed'>('Active')
  // ✅ NEW — filter promos by their promoDate falling within a range.
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [allRides, setAllRides] = useState<Ride[]>([])
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editPromo, setEditPromo] = useState<RidePromo | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<RidePromo | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<RidePromo | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  // ✅ NEW — full ride list modal, opened via "+N more" when a promo bundles
  // more rides than fit cleanly in the card.
  const [viewRidesPromo, setViewRidesPromo] = useState<RidePromo | null>(null)

  const getImageUrl = (path?: string) => {
    if (!path) return null
    if (path.startsWith('http')) return path
    if (path.startsWith('/')) return `${BASE_URL}${path}`
    return `${BASE_URL}/images/${path}`
  }

  const fetchRides = async () => {
    try {
      const res = await api.get('/api/ride', { params: { page: 1, pageSize: 200 } })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      const list: Ride[] = Array.isArray(d) ? d : []
      setAllRides(list.filter(r => !r.isDeleted))
    } catch { toast.error('Failed to load rides list.') }
  }

  const fetchSchedules = async () => {
    try {
      const res = await api.get('/api/schedule', { params: { page: 1, pageSize: 500 } })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      setAllSchedules(Array.isArray(d) ? d : [])
    } catch { toast.error('Failed to load schedules list.') }
  }

  // Schedules selectable for a given ride: open, with slots left, on the
  // exact same date as the promo (a promo is single-day, so every ride in it
  // must happen that day), AND tagged Type = Promo — Regular schedules are
  // reserved for direct visitor booking and can't be bundled into a promo
  // (fully separate pools, enforced server-side too). Plus whatever's
  // already locked in on the promo being edited (so it doesn't vanish from
  // its own dropdown if it since filled up or the date was changed after).
  const schedulesForRide = (rideId: number) =>
    allSchedules.filter(s =>
      s.rideId === rideId &&
      s.scheduleDate?.slice(0, 10) === form.promoDate &&
      (s.scheduleType ?? 'Regular') === 'Promo' &&
      (((s.status === 'Open') && s.availableSlots > 0) || form.scheduleByRide[rideId] === s.id)
    )

  // ✅ NEW — only pop up rides that actually have a schedule on the chosen
  // promo date. Previously every active ride was listed regardless of the
  // date, so checking one on a day with nothing scheduled was a dead end.
  const ridesForPromoDate = form.promoDate
    ? allRides.filter(r => schedulesForRide(r.id).length > 0)
    : []

  const fetchPromos = async () => {
    setLoading(true)
    try {
      const showDel = statusFilter !== 'active'
      const res = await promoApi.getAll({ ...params, includeDeleted: showDel })
      const d = (res.data as any)?.data?.data ?? (res.data as any)?.data ?? res.data
      let list: any[] = Array.isArray(d) ? d : []
      if (statusFilter === 'deleted') list = list.filter((p: any) => p.isDeleted)
      if (statusFilter === 'active') list = list.filter((p: any) => !p.isDeleted)
      if (activeStatus !== 'All') list = list.filter((p: any) => p.status === activeStatus)
      if (dateFrom) list = list.filter((p: any) => p.promoDate?.slice(0, 10) >= dateFrom)
      if (dateTo) list = list.filter((p: any) => p.promoDate?.slice(0, 10) <= dateTo)
      setPromos(list)
      const pg = (res.data as any)?.data?.pagination ?? (res.data as any)?.pagination
      if (pg) setPagination(pg)
    } catch { toast.error('Failed to load ride promos.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRides(); fetchSchedules() }, [])
  useEffect(() => { fetchPromos() }, [params, statusFilter, activeStatus, dateFrom, dateTo])

  const openCreate = () => {
    setEditPromo(null); setForm({ ...emptyForm })
    setImageFile(null); setImagePreview(''); setFormErr(''); setModalOpen(true)
  }

  const openEdit = (promo: RidePromo) => {
    setEditPromo(promo)
    setForm({
      name: promo.name,
      description: promo.description ?? '',
      price: Number(promo.price) || 0,
      promoDate: promo.promoDate?.slice(0, 10) ?? '',
      rideIds: promo.rides.map(r => r.rideId),
      scheduleByRide: Object.fromEntries(promo.rides.map(r => [r.rideId, r.scheduleId])),
    })
    setImageFile(null)
    setImagePreview(promo.imagePath ? getImageUrl(promo.imagePath)! : '')
    setFormErr(''); setModalOpen(true)
  }

  // Changing the promo date invalidates any already-picked rides/schedules
  // that no longer fall on that day — clear them so the form can't silently
  // submit a stale (ride, schedule) pair from a different date.
  const setPromoDate = (date: string) => {
    setForm(f => {
      const rideIds = f.rideIds.filter(rid =>
        allSchedules.some(s => s.rideId === rid && s.scheduleDate?.slice(0, 10) === date && s.id === f.scheduleByRide[rid])
      )
      const scheduleByRide = Object.fromEntries(rideIds.map(rid => [rid, f.scheduleByRide[rid]]))
      return { ...f, promoDate: date, rideIds, scheduleByRide }
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const toggleRide = (rideId: number) => {
    setForm(f => {
      const included = f.rideIds.includes(rideId)
      const rideIds = included ? f.rideIds.filter(id => id !== rideId) : [...f.rideIds, rideId]
      const scheduleByRide = { ...f.scheduleByRide }
      if (included) delete scheduleByRide[rideId]
      return { ...f, rideIds, scheduleByRide }
    })
  }

  // ✅ CHANGED — clicking the already-selected schedule again now toggles it
  // back off (radio-style select/deselect), instead of being stuck selected.
  const setRideSchedule = (rideId: number, scheduleId: number) => {
    setForm(f => {
      const scheduleByRide = { ...f.scheduleByRide }
      if (scheduleByRide[rideId] === scheduleId) delete scheduleByRide[rideId]
      else scheduleByRide[rideId] = scheduleId
      return { ...f, scheduleByRide }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr('')
    const priceNum = parseFloat(String(form.price))
    if (!form.name) { setFormErr('Promo name is required.'); return }
    if (isNaN(priceNum) || priceNum < 0) { setFormErr('Please enter a valid price.'); return }
    if (!form.promoDate) { setFormErr('Promo date is required.'); return }
    if (form.rideIds.length < 2) { setFormErr('Select at least two rides for this promo.'); return }
    if (form.rideIds.some(id => !form.scheduleByRide[id])) {
      setFormErr('Pick a schedule for every selected ride.'); return
    }
    if (!editPromo && !imageFile) { setFormErr('Image is required for new promos.'); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('description', form.description)
      fd.append('price', String(priceNum))
      fd.append('promoDate', form.promoDate)
      // rideIds[i] pairs with scheduleIds[i] — same order, sent as parallel
      // repeated form fields (matches CreateRidePromoRequest's List<int> binding).
      form.rideIds.forEach(id => fd.append('rideIds', String(id)))
      form.rideIds.forEach(id => fd.append('scheduleIds', String(form.scheduleByRide[id])))
      if (imageFile) fd.append('file', imageFile)

      if (editPromo) {
        await promoApi.update(editPromo.id, fd)
        toast.success('Promo updated successfully.')
      } else {
        await promoApi.create(fd)
        toast.success('Promo created successfully.')
      }
      setModalOpen(false); fetchPromos()
    } catch (e: any) {
      setFormErr(e.response?.data?.message ?? 'Failed to save promo.')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await promoApi.delete(deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted.`)
      setDeleteTarget(null); fetchPromos()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to delete.')
    } finally { setDeleteLoading(false) }
  }

  const doRestore = async () => {
    if (!restoreTarget) return
    setRestoreLoading(true)
    try {
      await promoApi.restore(restoreTarget.id)
      toast.success(`"${restoreTarget.name}" restored!`)
      setRestoreTarget(null); fetchPromos()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to restore.')
    } finally { setRestoreLoading(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage ride promos</h1>
          <p className="text-sm text-gray-500 mt-1">Bundle 2+ rides into a single-priced promo package.</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add promo
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input value={params.search ?? ''}
              onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
              placeholder="Search promos..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 w-full sm:w-52" />
          </div>
          <StatusCombobox
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setParams(p => ({ ...p, page: 1 })) }}
          />
          <LifecycleCombobox
            value={activeStatus}
            onChange={v => { setActiveStatus(v); setParams(p => ({ ...p, page: 1 })) }}
          />
          <DateRangeButton
            from={dateFrom} to={dateTo}
            onClick={() => setDateModalOpen(true)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner /></div>
        ) : promos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Tag className="w-16 h-16 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500 text-base">No ride promos found</div>
            <div className="text-sm mt-1 text-gray-400">Try adjusting your search or add a new promo.</div>
          </div>
        ) : (
          <>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {promos.map(promo => {
                // ✅ CHANGED — locked once the earliest call time among this
                // promo's bundled rides has started (not just once its date
                // arrives): visitors may already be checking in for that
                // ride, so editing or deleting the promo out from under them
                // is blocked from that moment on.
                const locked = isPromoLocked(promo)
                return (
                <div key={promo.id}
                  className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all group ${
                    promo.isDeleted ? 'opacity-60' : ''
                  }`}>
                  <div className="relative h-40 bg-white cursor-pointer overflow-hidden"
                    onClick={() => promo.imagePath && setZoomSrc(getImageUrl(promo.imagePath)!)}>
                    {promo.imagePath ? (
                      <>
                        <img src={getImageUrl(promo.imagePath)!} alt={promo.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-gray-700" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-pink-50">
                        <Tag className="w-10 h-10 text-pink-200" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge label={promo.isDeleted ? 'Deleted' : promo.status} />
                    </div>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-pink-700 font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
                      ₱{fmt(promo.price)}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-[14px] mb-1 truncate">{promo.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2 min-h-[2rem]">{promo.description ?? 'No description'}</p>

                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-700 bg-pink-50 border border-pink-100 rounded-lg px-2.5 py-1.5 mb-2.5">
                      <Calendar className="w-4 h-4" />
                      {fmtDate(promo.promoDate)}
                    </div>

                    {/* ✅ CHANGED — only the first ride shows inline now; with
                        2+ rides, cramming every one into this small card got
                        cluttered. The rest collapse behind "+N more", which
                        opens the full list in a modal (styled like the
                        Schedules page's day-detail cards). */}
                    <div className="flex flex-col gap-2 mb-3">
                      {promo.rides.slice(0, 1).map(r => (
                        <div key={r.rideId}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-gray-700 text-[11px] font-medium border border-gray-100 flex-wrap">
                          <FerrisWheel className="w-3.5 h-3.5 flex-shrink-0 text-pink-400" />
                          <span className="flex-1 min-w-[60px]">{r.rideName}</span>
                          <span className="flex items-center gap-2 flex-shrink-0 text-gray-500">
                            <CallTimeBadge time={r.callTime} className="text-[11px]" />
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {fmtTime(r.startTime)}–{fmtTime(r.endTime)}
                            </span>
                          </span>
                        </div>
                      ))}
                      {promo.rides.length > 1 && (
                        <button type="button" onClick={() => setViewRidesPromo(promo)}
                          className="self-start text-[11px] font-semibold text-pink-600 hover:text-pink-700 hover:underline transition-colors px-1">
                          +{promo.rides.length - 1} more
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {promo.isDeleted ? (
                        <button onClick={() => setRestoreTarget(promo)} title="Restore promo"
                          className="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : locked ? (
                        <>
                          <button disabled title="This promo's call time has started — it's locked and can no longer be edited."
                            className="flex items-center justify-center w-8 h-8 bg-gray-50 text-gray-300 border border-gray-200 rounded-xl cursor-not-allowed">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button disabled title="This promo's call time has started — it's locked and can no longer be deleted."
                            className="flex items-center justify-center w-8 h-8 bg-gray-50 text-gray-300 border border-gray-200 rounded-xl cursor-not-allowed">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(promo)} title="Edit promo"
                            className="flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(promo)} title="Delete promo"
                            className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Showing <strong>{promos.length}</strong> of <strong>{pagination.totalCount}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(params.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - (params.page ?? 1)) <= 2)
                  .map(p => (
                    <button key={p} onClick={() => setParams(prev => ({ ...prev, page: p }))}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                        p === (params.page ?? 1) ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                      }`}>{p}</button>
                  ))}
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(params.page ?? 1) >= pagination.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editPromo ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                  {editPromo ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-[15px]">{editPromo ? 'Edit promo' : 'Add new promo'}</div>
                  <div className="text-[11px] text-gray-400">{editPromo ? `Editing: ${editPromo.name}` : 'Bundle 2+ rides into one package'}</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Promo photo {!editPromo && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  {imagePreview ? (
                    <div className="relative group cursor-pointer flex-shrink-0"
                      onClick={() => setZoomSrc(imagePreview)}>
                      <img src={imagePreview} alt="preview"
                        className="w-20 h-20 rounded-xl object-cover border border-gray-200 group-hover:brightness-75 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                      <Tag className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium transition-colors">
                      <Upload className="w-4 h-4" />
                      {editPromo ? 'Change photo (optional)' : 'Upload photo'}
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    <p className="text-xs text-gray-400 mt-1.5">JPG, PNG, WEBP · Max 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Promo name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  required placeholder="Weekend Thrill Combo"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the promo..." rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (₱) *</label>
                  <input type="number" min="0" step="0.01" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    required placeholder="450.00"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" /> Promo date *
                  </label>
                  <PromoDatePicker value={form.promoDate} onChange={setPromoDate} />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 -mt-3">
                Promos run for a single day. Every ride bundled below must have a schedule locked on this exact date.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Rides included * <span className="text-gray-400 font-normal">(select at least two, and lock a schedule for each)</span>
                </label>
                {!form.promoDate ? (
                  <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" /> Pick a promo date first to see which rides have schedules that day.
                  </div>
                ) : (
                  <>
                    <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {ridesForPromoDate.length === 0 ? (
                        <div className="text-xs text-amber-600 bg-amber-50 p-3">
                          No rides have an open <strong>Promo-type</strong> schedule on {fmtDate(form.promoDate)} yet — create one in
                          Schedules first and set its Type to "Promo".
                        </div>
                      ) : ridesForPromoDate.map(ride => {
                        const checked = form.rideIds.includes(ride.id)
                        const options = schedulesForRide(ride.id)
                        return (
                          <div key={ride.id} className={checked ? 'bg-emerald-50' : ''}>
                            <button type="button"
                              onClick={() => toggleRide(ride.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${!checked ? 'hover:bg-gray-50' : ''}`}>
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                checked ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                              }`}>
                                {checked && <Check className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <FerrisWheel className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-800 flex-1 truncate">{ride.name}</span>
                              <span className="text-xs text-gray-400">₱{fmt(ride.price)}</span>
                            </button>

                            {checked && (
                              <div className="px-3 pb-3 pl-11">
                                {options.length === 0 ? (
                                  <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                    No open schedules with slots for this ride on {fmtDate(form.promoDate)} — create one in Schedules first.
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {options.map(s => {
                                      const selected = form.scheduleByRide[ride.id] === s.id
                                      const pct = s.maxSlots > 0 ? Math.round((s.availableSlots / s.maxSlots) * 100) : 0
                                      return (
                                        <button key={s.id} type="button" onClick={() => setRideSchedule(ride.id, s.id)}
                                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                                            selected
                                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300'
                                              : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                                          }`}>
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                            selected ? 'border-emerald-600' : 'border-gray-300'
                                          }`}>
                                            {selected && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                                          </div>

                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {s.callTime && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-semibold">
                                                  <AlarmClock className="w-3 h-3 flex-shrink-0" />
                                                  Call {fmtTime(s.callTime)}
                                                </span>
                                              )}
                                              <span className="flex items-center gap-1 text-[11px] text-gray-700 font-medium">
                                                <Clock className="w-3 h-3 flex-shrink-0" /> {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[110px]">
                                                <div className={`h-full rounded-full ${pct === 0 ? 'bg-red-400' : pct < 30 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                                  style={{ width: `${pct}%` }} />
                                              </div>
                                              <span className="text-[10px] text-gray-400">{s.availableSlots}/{s.maxSlots} slots</span>
                                            </div>
                                          </div>

                                          {selected && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {form.rideIds.length} of {ridesForPromoDate.length} available ride(s) selected for {fmtDate(form.promoDate)}.
                    </p>
                  </>
                )}
              </div>

              {formErr && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">⚠ {formErr}</div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editPromo ? 'Save changes' : 'Create promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete promo?"
          message={`Delete "${deleteTarget.name}"? It can be restored later.`}
          confirmLabel="Yes, delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {restoreTarget && (
        <ConfirmModal
          title="Restore promo?"
          message={`Restore "${restoreTarget.name}"? It will be visible to visitors again.`}
          confirmLabel="Yes, restore"
          onConfirm={doRestore}
          onCancel={() => setRestoreTarget(null)}
          loading={restoreLoading}
        />
      )}

      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}

      {viewRidesPromo && (
        <PromoRidesModal promo={viewRidesPromo} onClose={() => setViewRidesPromo(null)} />
      )}

      {dateModalOpen && (
        <PromoDateRangeModal
          from={dateFrom} to={dateTo}
          onApply={(f, t) => { setDateFrom(f); setDateTo(t) }}
          onClose={() => setDateModalOpen(false)}
        />
      )}
    </div>
  )
}
