import { useState, useEffect, useRef } from 'react'
import {
  Scan, CheckCircle2, Calendar, Clock, Users, AlertCircle, XCircle,
  Wallet, Loader2, Ticket, ChevronRight, ChevronLeft, ChevronDown, Sparkles, ClipboardCheck,
TrendingUp, X, ZoomIn, AlarmClock,
  FerrisWheel, Tag, CalendarDays
} from 'lucide-react'
import type { Schedule, Booking, PagedResponse, PaginationRequest } from '../../types'
import api from '../../services/api'
import {Badge } from '../../components/shared'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// ── Date-range filter helpers — same pattern as Admin Bookings/Promos/Logs ──
const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
const fmtLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
function fmtRange(from: string, to: string, sep = ' – ') {
  if (from === to) return fmtLong(from)
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${fmtShort(from)}${sep}${fmtLong(to)}`
    : `${fmtLong(from)}${sep}${fmtLong(to)}`
}

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

// Pulls the friendliest error message out of an axios error — handles both
// { message } responses and ASP.NET Core ModelState validation payloads
// ({ errors: { CallTime: ["..."] } }), which is how the [TimeBefore] data
// annotation surfaces its message.
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

// ── Full-size image zoom overlay — same pattern used on the visitor dashboard ──
function ImageZoom({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-2xl max-h-[80vh]">
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img src={src} alt="Attraction" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    </div>
  )
}

// ── Ride thumbnail — shows the photo when available, falls back to the FerrisWheel icon ──
function RideThumb({ path, name, size = 'w-11 h-11', iconSize = 'w-5 h-5', bg = 'bg-amber-50 group-hover:bg-amber-100', onZoom }: {
  path?: string; name?: string; size?: string; iconSize?: string; bg?: string; onZoom: (src: string) => void
}) {
  const url = getImageUrl(path)
  return (
    <div
      className={`group/thumb relative ${size} rounded-xl ${bg} flex items-center justify-center flex-shrink-0 transition-colors overflow-hidden ${url ? 'cursor-pointer' : ''}`}
      onClick={e => { if (!url) return; e.stopPropagation(); onZoom(url) }}>
      {url ? (
        <>
          <img src={url} alt={name ?? 'Attraction'}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
            <ZoomIn className={`${iconSize} text-white`} />
          </div>
        </>
      ) : (
        <FerrisWheel className={`${iconSize} text-amber-600`} />
      )}
    </div>
  )
}

// ── Call time badge — styled like a notification chip (pill background +
// border) instead of plain colored text, so it actually draws the eye. ──
function CallTimeBadge({ time, className = '' }: { time?: string; className?: string }) {
  if (!time) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-semibold shadow-sm ${className}`}>
      <AlarmClock className="w-3.5 h-3.5" />
      Call time: {fmtTime(time)}
    </span>
  )
}

// ✅ NEW — Regular/Promo tag, pink to match the Ride Promo feature's
// established brand color elsewhere in the app.
function ScheduleTypeBadge({ type, className = '' }: { type?: string; className?: string }) {
  const isPromo = type === 'Promo'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
      isPromo ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-gray-100 text-gray-600 border-gray-200'
    } ${className}`}>
      {isPromo ? 'Attraction Bundle' : 'Regular'}
    </span>
  )
}

// ── Month/Year Picker — click-to-open, jump to any month/year ──────
function MonthYearPicker({ month, year, onChange, accent = 'indigo' }: {
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

// ── Month/Year dropdown for the mini calendar below — jump straight to any
// month or year, same pattern as Admin Bookings/Promos/Logs. ──
function MiniMonthYearDropdown({ year, month, onChange, onClose }: {
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
                {m}
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
            <MiniMonthYearDropdown
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

// ── Date Range Modal (centered dialog, real calendar grid) — same pattern
// as Admin Bookings/Promos/Logs' "Filter by date." ──
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
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
              Pick a date {tempFrom && tempTo ? `— ${fmtRange(tempFrom, tempTo, ' to ')}` : ''}
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

// ── Date Range Trigger Button — same look as Admin Bookings/Promos/Logs ──
function DateRangeButton({ from, to, onClick }: { from: string; to: string; onClick: () => void }) {
  const label = !from && !to
    ? 'All dates'
    : from && to
      ? fmtRange(from, to)
      : from ? `From ${fmtLong(from)}` : `Until ${fmtLong(to)}`

  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white">
      <CalendarDays className="w-4 h-4 text-gray-400" />
      <span className="text-xs font-bold text-gray-900">{label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  )
}

function rosterBadge(label: string) {
  const map: Record<string,string> = {
    Paid:'bg-green-100 text-green-700', Unpaid:'bg-amber-100 text-amber-700',
    Pending:'bg-amber-100 text-amber-700', Approved:'bg-green-100 text-green-700',
    Rejected:'bg-red-100 text-red-700', Completed:'bg-blue-100 text-blue-700',
    // ✅ Missed now gets its own color (orange) — it used to share the exact
    // same red as Rejected, making the two impossible to tell apart at a glance.
    Cancelled:'bg-gray-100 text-gray-600', Missed:'bg-orange-100 text-orange-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

// Mask everything after the date segment, e.g. AF-20260707-C413F9 → AF-20260707-••••••
function maskCode(code?: string) {
  if (!code) return ''
  const parts = code.split('-')
  if (parts.length < 3) return code.replace(/./g, '•')
  const visible = parts.slice(0, 2).join('-')
  const hiddenLen = parts.slice(2).join('-').length
  return `${visible}-${'•'.repeat(hiddenLen)}`
}

// ── Roster Modal — list of people who booked/were approved for a schedule ──
function RosterModal({ schedule, bookings, loading, onClose, onZoom }: {
  schedule: Schedule; bookings: Booking[]; loading: boolean; onClose: () => void; onZoom: (src: string) => void
}) {
  const approved = bookings.filter(b => b.status === 'Approved' || b.status === 'Completed')
  const others = bookings.filter(b => b.status !== 'Approved' && b.status !== 'Completed')
  const ridePhoto = schedule.rideImagePath ?? bookings.find(b => b.rideImagePath)?.rideImagePath

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <RideThumb path={ridePhoto} name={schedule.rideName} size="w-10 h-10" iconSize="w-4 h-4" bg="bg-amber-50" onZoom={onZoom} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-bold text-gray-900 text-sm truncate">{schedule.rideName}</div>
                <ScheduleTypeBadge type={schedule.scheduleType} />
              </div>
              <div className="text-xs text-gray-400">
                {schedule.scheduleDate} · {fmtTime(schedule.startTime)}–{fmtTime(schedule.endTime)}
              </div>
              <CallTimeBadge time={schedule.callTime} className="text-[11px] mt-0.5" />
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <Users className="w-10 h-10 mb-2 text-gray-200" />
              <div className="text-sm">No bookings for this schedule yet</div>
            </div>
          ) : (
            <>
              {approved.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Approved ({approved.length})
                  </div>
                  <div className="space-y-2">
                    {approved.map(b => (
                      <div key={b.id} className="flex items-center gap-3 p-2.5 bg-green-50 border border-green-100 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 font-bold text-xs flex-shrink-0">
                          {(b.visitorName ?? 'V').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{b.visitorName}</div>
                          <div className="text-[10px] text-gray-400 truncate">@{b.visitorUsername}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-gray-500">
                              {maskCode(b.bookingCode)}
                            </span>
                            {b.promoId && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[9px] font-semibold">
                                <Tag className="w-2.5 h-2.5" /> {b.promoName ?? 'Bundle'}
                              </span>
                            )}
                          </div>
                          {/* ✅ CHANGED — one ticket per booking (1:1): the
                              guest riding isn't always the visitor account
                              holder, so always show the guest's own name
                              (was gated behind "> 1 guest" from the old
                              group-booking feature, which made this never
                              show now that every booking has exactly one). */}
                          {(b.guests?.length ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {b.guests!.map(g => (
                                <span key={g.id} className="text-[10px] text-gray-600 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                                  {g.guestName}
                                  {(g.heightCm != null || g.ageYears != null || g.weightKg != null) && (
                                    <span className="text-gray-400">
                                      {' '}({[g.heightCm != null ? `${g.heightCm}cm` : null, g.weightKg != null ? `${g.weightKg}kg` : null, g.ageYears != null ? `${g.ageYears}y` : null].filter(Boolean).join(', ')})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {rosterBadge(b.status)}
                          {rosterBadge(b.paymentStatus)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {others.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Other bookings ({others.length})
                  </div>
                  <div className="space-y-2">
                    {others.map(b => (
                      <div key={b.id} className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 font-bold text-xs flex-shrink-0">
                          {(b.visitorName ?? 'V').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-700 text-sm truncate">{b.visitorName}</div>
                          <div className="text-[10px] text-gray-400 truncate">@{b.visitorUsername}</div>
                          <div className="mt-0.5">
                            <span className="font-mono text-[10px] text-gray-500">
                              {maskCode(b.bookingCode)}
                            </span>
                          </div>
                          {/* ✅ CHANGED — one ticket per booking (1:1): always
                              show the guest's own name (was gated behind
                              "> 1 guest" from the old group-booking feature). */}
                          {(b.guests?.length ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {b.guests!.map(g => (
                                <span key={g.id} className="text-[10px] text-gray-600 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                                  {g.guestName}
                                  {(g.heightCm != null || g.ageYears != null || g.weightKg != null) && (
                                    <span className="text-gray-400">
                                      {' '}({[g.heightCm != null ? `${g.heightCm}cm` : null, g.weightKg != null ? `${g.weightKg}kg` : null, g.ageYears != null ? `${g.ageYears}y` : null].filter(Boolean).join(', ')})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {rosterBadge(b.status)}
                          {rosterBadge(b.paymentStatus)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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

export function AttendantDashboard() {
  const { user } = useAuth()
  const [schedules, setSchedules]   = useState<Schedule[]>([])
  // ✅ FIXED — `pagination` (the read value) was never displayed anywhere on
  // this page (no pager UI), only `setPagination` is needed to store the
  // API response's paging info, so the unused half of the tuple is dropped
  // instead of destructured. Resolves TS6133 without changing any behavior.
  const [, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 10 })
  // ✅ FIXED — `params` never changes after the initial value (this page
  // always fetches all 200 assigned schedules in one shot, no pagination
  // controls), so `setParams` was dead. Dropped the unused setter instead of
  // destructuring it. Resolves TS6133 without changing any behavior.
  const [params] = useState<PaginationRequest>({ page: 1, pageSize: 200 })
  const [loading, setLoading]       = useState(true)
  const [code, setCode]             = useState('')
  const [verifiedBooking, setVerifiedBooking] = useState<Booking | null>(null)
  const [verifying, setVerifying]   = useState(false)
  const [collectingPayment, setCollectingPayment] = useState(false)

  // roster (attendee list) for a schedule
  const [rosterSchedule, setRosterSchedule] = useState<Schedule | null>(null)
  const [rosterBookings, setRosterBookings] = useState<Booking[]>([])
  const [rosterLoading, setRosterLoading]   = useState(false)

  // full-size ride photo zoom (shared across the verify panel, schedules list and roster modal)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)

  // ref used to scroll down to the assigned-schedules card
  const schedulesSectionRef = useRef<HTMLDivElement>(null)

  // ✅ FIXED — this only ran once on mount/filter-change, so the assigned-
  // schedules list went stale the moment the attendant landed on the
  // dashboard. Now re-polls every 5s so a newly-assigned schedule shows up
  // live, not just at login. (The old local "unseen" bell badge that lived
  // here was removed — real-time notifications now live in the header bell.)
  useEffect(() => {
    fetchSchedules()
    // ✅ FIXED — this background poll used to call fetchSchedules() the same
    // way the initial load does, which set loading(true) every 5s and
    // swapped the whole assigned-schedules list out for a full spinner —
    // visible as a random "it flickers back to loading" whenever the poll
    // happened to land while someone was looking (same bug fixed on the
    // Visitor Dashboard's My Bookings list). Silent polls now skip the
    // spinner and just swap in fresh data once it arrives.
    const interval = setInterval(() => fetchSchedules({ silent: true }), 5_000)
    return () => clearInterval(interval)
  }, [params])

  const fetchSchedules = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true)
    try {
      const res = await api.get<PagedResponse<Schedule>>('/api/schedule/my-assigned', { params })
      const data = res.data.data ?? []
      setSchedules(data)
      setPagination(res.data.pagination)
    } catch (e: any) {
      // Silent background polls stay quiet on a transient failure instead of
      // popping an error toast every 5s — the next poll just tries again.
      if (!opts.silent) toast.error(getErrorMessage(e, 'Failed to load schedules.'))
    }
    finally { if (!opts.silent) setLoading(false) }
  }

  // ── Verify booking code — correct endpoint is /api/booking/code/{code} ──
  const handleVerify = async () => {
    if (!code.trim()) { toast.error('Enter a booking code.'); return }
    setVerifying(true)
    setVerifiedBooking(null)
    try {
      const res = await api.get<{ data: Booking }>(`/api/booking/code/${code.trim()}`)
      setVerifiedBooking(res.data.data)
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Booking not found.'))
    } finally { setVerifying(false) }
  }

  // ── Collect on-site payment via /api/booking/{bookingCode}/pay ──────────
  const handleCollectPayment = async () => {
    if (!verifiedBooking) return
    setCollectingPayment(true)
    try {
      await api.put(`/api/booking/${verifiedBooking.bookingCode}/pay`)
      // Regular bookings: paymentAmount stays 0 until this PUT succeeds, so the
      // real amount due lives in ridePrice. Promo bookings have no ridePrice
      // (a promo bundles multiple rides), but paymentAmount is set at booking
      // time. Fall back accordingly, same as the rest of this screen.
      toast.success(`Payment of ₱${(verifiedBooking.ridePrice ?? verifiedBooking.paymentAmount)?.toFixed(2)} collected.`)
      const res = await api.get<{ data: Booking }>(`/api/booking/code/${verifiedBooking.bookingCode}`)
      setVerifiedBooking(res.data.data)
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to collect payment.'))
    } finally { setCollectingPayment(false) }
  }

  // ✅ CHANGED — completion is no longer a manual attendant action. The
  // background AutoBookingStatusWorker (runs every minute) already flips
  // Approved+Paid bookings to Completed on its own once the schedule/bundle
  // window closes — for both single-attraction and attraction-bundle
  // bookings. This silently re-checks the verified booking every few
  // seconds so the panel below updates itself to "already completed" once
  // that happens, instead of requiring the attendant to scan again.
  useEffect(() => {
    if (!verifiedBooking || verifiedBooking.status !== 'Approved' || verifiedBooking.paymentStatus !== 'Paid') return
    const bookingCode = verifiedBooking.bookingCode
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ data: Booking }>(`/api/booking/code/${bookingCode}`)
        setVerifiedBooking(res.data.data)
      } catch {
        // silent — next poll tries again
      }
    }, 5_000)
    return () => clearInterval(interval)
  }, [verifiedBooking?.bookingCode, verifiedBooking?.status, verifiedBooking?.paymentStatus])

  // ── Attendee roster via /api/booking/schedule/{scheduleId} ─────────────
  const fetchRoster = async (s: Schedule) => {
    setRosterSchedule(s)
    setRosterLoading(true)
    setRosterBookings([])
    try {
      const res = await api.get<{ data: Booking[] }>(`/api/booking/schedule/${s.id}`)
      setRosterBookings(res.data.data ?? [])
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to load attendee list.'))
    } finally { setRosterLoading(false) }
  }

  const isApprovedAndPaid = verifiedBooking?.status === 'Approved' && verifiedBooking?.paymentStatus === 'Paid'
  const isApprovedAndUnpaid = verifiedBooking?.status === 'Approved' && verifiedBooking?.paymentStatus === 'Unpaid'

  // ── Check-in window: payment can only be collected — and the ride only
  // completed — while "now" falls inside [checkInOpensAt, endTime] for the
  // schedule date. Mirrors the backend's ValidateScheduleWindow check.
  // ✅ SIMPLIFIED — CallTime is required on every schedule now, so
  // checkInOpensAt is always the schedule's CallTime; the old grace-period
  // fallback (for schedules with no call time) can no longer happen and has
  // been removed, matching BookingService.cs's ValidateScheduleWindow.
  // ✅ FIXED — promo bookings have no top-level scheduleDate/startTime/
  // endTime/callTime (a promo bundles several rides, each with its own
  // schedule under includedRides), so all four of these used to come back
  // null for every promo booking. That made isBeforeWindow/isAfterWindow
  // always false and isScheduleDue always true, so payment collection and
  // "mark completed" were available on any date, regardless of the promo's
  // actual schedule. Now, for promo bookings, the window opens at the
  // earliest call time across included rides and closes after the latest
  // ride's end time.
  const includedRides = verifiedBooking?.includedRides ?? []
  const scheduleStart = verifiedBooking?.promoId
    ? includedRides.reduce<Date | null>((min, r) => {
        const d = new Date(`${r.scheduleDate}T${r.startTime}`)
        return !min || d < min ? d : min
      }, null)
    : verifiedBooking?.scheduleDate && verifiedBooking?.startTime
    ? new Date(`${verifiedBooking.scheduleDate}T${verifiedBooking.startTime}`)
    : null
  const scheduleEnd = verifiedBooking?.promoId
    ? includedRides.reduce<Date | null>((max, r) => {
        const d = new Date(`${r.scheduleDate}T${r.endTime}`)
        return !max || d > max ? d : max
      }, null)
    : verifiedBooking?.scheduleDate && verifiedBooking?.endTime
    ? new Date(`${verifiedBooking.scheduleDate}T${verifiedBooking.endTime}`)
    : null
  const checkInOpensAt = verifiedBooking?.promoId
    ? includedRides.reduce<Date | null>((min, r) => {
        const d = new Date(`${r.scheduleDate}T${r.callTime ?? r.startTime}`)
        return !min || d < min ? d : min
      }, null) ?? scheduleStart
    : verifiedBooking?.scheduleDate && verifiedBooking?.callTime
    ? new Date(`${verifiedBooking.scheduleDate}T${verifiedBooking.callTime}`)
    : scheduleStart
  const nowTime = new Date()
  const isBeforeWindow = !!checkInOpensAt && nowTime < checkInOpensAt
  const isAfterWindow  = !!scheduleEnd && nowTime > scheduleEnd
  const isScheduleDue  = !isBeforeWindow && !isAfterWindow

  // ✅ CHANGED — "Complete" used to unlock the moment isScheduleDue was
  // true, i.e. any time from check-in (call time) through the schedule's
  // end. For a ride whose call time opens well ahead of its actual start
  // (e.g. call time 10:51 AM for a 1:50–2:00 PM ride), that let an attendant
  // mark it Completed — and unlock the visitor's review prompt — hours
  // before the ride had even run. Completion now always requires "now" to
  // have passed the ride's own end time, for BOTH single-ride and promo
  // bookings (a promo's scheduleEnd above is already the LATEST included
  // ride's end, so the same rule naturally covers "every included ride is
  // over" too). Mirrors the backend's ValidateRideHasEnded /
  // ValidatePromoAllRidesFinishedAsync. "Collect payment" is unaffected —
  // it still opens at check-in (isScheduleDue) since paying ahead of the
  // ride is normal.
  const canCompleteRide = !!scheduleEnd && nowTime >= scheduleEnd

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  // ── Month + status filters for assigned schedules ──────────────
  const [filterMonth, setFilterMonth] = useState(now.getMonth())
  const [filterYear, setFilterYear]   = useState(now.getFullYear())
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Full' | 'Completed' | 'Cancelled'>('All')

  // ── Date-range filter (independent of the month picker above) — narrows
  // the assigned-schedules list to an exact date range, same "Filter by
  // date" pattern used on Admin Bookings/Promos/Logs. Leave both empty to
  // fall back to whatever month is selected above.
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)

  const monthFilteredSchedules = schedules.filter(s => {
    if (!s.scheduleDate) return false
    const d = new Date(s.scheduleDate)
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear
  })

  const dateRangeFilteredSchedules = (dateFrom || dateTo) ? schedules.filter(s => {
    if (!s.scheduleDate) return false
    return (!dateFrom || s.scheduleDate >= dateFrom) && (!dateTo || s.scheduleDate <= dateTo)
  }) : monthFilteredSchedules

  const displaySchedules = statusFilter === 'All'
    ? dateRangeFilteredSchedules
    : dateRangeFilteredSchedules.filter(s => s.status === statusFilter)

  // ✅ NEW — assigned-schedules pagination. Previously the whole filtered
  // list rendered in one long scroll (could easily be 50+ rows for a busy
  // attendant). Paginated client-side since the full month/status/date-range
  // filtered set is already in memory from the one-shot fetch.
  const SCHED_PAGE_SIZE = 10
  const [schedPage, setSchedPage] = useState(1)
  const schedTotalPages = Math.max(1, Math.ceil(displaySchedules.length / SCHED_PAGE_SIZE))
  const pagedSchedules = displaySchedules.slice(
    (schedPage - 1) * SCHED_PAGE_SIZE,
    schedPage * SCHED_PAGE_SIZE
  )
  // Any filter change can shrink the list below the current page — snap
  // back to page 1 instead of showing an empty page.
  useEffect(() => { setSchedPage(1) }, [filterMonth, filterYear, statusFilter, dateFrom, dateTo])

  // Stat cards at the top always reflect the selected month, regardless of
  // the date-range filter below (which only narrows the schedules list).
  const openCount = monthFilteredSchedules.filter(s => s.status === 'Open').length
  const totalSlots = monthFilteredSchedules.reduce((sum, s) => sum + (s.maxSlots ?? 0), 0)
  const filledSlots = monthFilteredSchedules.reduce((sum, s) => sum + ((s.maxSlots ?? 0) - (s.availableSlots ?? 0)), 0)

  // Status-chip counts reflect whatever is currently in view (date range if
  // set, otherwise the selected month) so the numbers next to each chip
  // always match what filtering by that chip will actually show.
  const chipOpenCount = dateRangeFilteredSchedules.filter(s => s.status === 'Open').length
  const chipFullCount = dateRangeFilteredSchedules.filter(s => s.status === 'Full').length
  const chipCompletedCount = dateRangeFilteredSchedules.filter(s => s.status === 'Completed').length
  const chipCancelledCount = dateRangeFilteredSchedules.filter(s => s.status === 'Cancelled').length

  const monthLabel = new Date(filterYear, filterMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 sm:p-7 text-white shadow-sm">
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs px-3 py-1 rounded-full mb-3 border border-white/30">
              <Sparkles className="w-3 h-3" /> Ride Attendant Panel
            </div>
            <h1 className="text-2xl font-bold mb-1">{greeting}, {user?.firstName ?? 'there'}! 🎟️</h1>
            <p className="text-white/85 text-sm">Verify booking codes and keep the queue moving.</p>
          </div>
        </div>
      </div>

      {/* Month header — click-to-open month/year picker */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">Your activity in {monthLabel}</h3>
        <MonthYearPicker
          month={filterMonth} year={filterYear}
          onChange={(m, y) => { setFilterMonth(m); setFilterYear(y) }}
          accent="indigo"
        />
      </div>

      {/* Stats — reflect the selected month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label:`Assigned in ${monthLabel}`, value:monthFilteredSchedules.length, icon:<Calendar className="w-5 h-5 text-white" />, g:'from-indigo-500 to-indigo-600' },
          { label:'Open now',                  value:openCount,                     icon:<FerrisWheel className="w-5 h-5 text-white" />,    g:'from-emerald-500 to-emerald-600' },
          { label:'Slots filled',              value:`${filledSlots}/${totalSlots}`, icon:<TrendingUp className="w-5 h-5 text-white" />, g:'from-blue-500 to-blue-600' },
        ].map(s => (
          <div key={s.label} className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${s.g} shadow-sm`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-white/80 text-xs">{s.label}</div>
            <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-full bg-white/10" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verify panel */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Verify booking code</div>
              <div className="text-xs text-gray-400">Enter a visitor's booking code</div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="AF-20260615-XXXXXX"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono
                    focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                />
              </div>
              <button onClick={handleVerify} disabled={verifying}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700
                  text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow-sm">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                Verify
              </button>
            </div>

            {verifiedBooking ? (
              <div className={`border rounded-2xl p-4 transition-all ${
                isApprovedAndPaid
                  ? 'bg-green-50 border-green-200'
                  : isApprovedAndUnpaid
                  ? 'bg-amber-50 border-amber-200'
                  : verifiedBooking.status === 'Completed'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <RideThumb
                    path={verifiedBooking.promoId ? verifiedBooking.promoImagePath : verifiedBooking.rideImagePath}
                    name={verifiedBooking.promoId ? verifiedBooking.promoName : verifiedBooking.rideName}
                    size="w-11 h-11" iconSize="w-5 h-5" bg="bg-white shadow-sm" onZoom={setZoomSrc} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{verifiedBooking.visitorName}</p>
                    <p className="text-xs text-gray-500">@{verifiedBooking.visitorUsername}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge label={verifiedBooking.status} />
                    <Badge label={verifiedBooking.paymentStatus} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="font-mono text-xs text-gray-600 bg-white/70 px-2 py-1 rounded-lg inline-block font-semibold">
                    {verifiedBooking.bookingCode}
                  </div>
                  {verifiedBooking.promoId && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-100 text-pink-700 text-[11px] font-semibold">
                      <Tag className="w-3 h-3" /> Bundle: {verifiedBooking.promoName}
                    </span>
                  )}
                </div>

                {verifiedBooking.promoId ? (
                  // ── Promo booking — one entry per ride included, each with
                  // its own schedule and description (Ride Attendant view). ──
                  <div className="space-y-2 mb-3">
                    {(verifiedBooking.includedRides ?? []).map(r => (
                      <div key={r.rideId} className="bg-white/70 rounded-xl p-2.5 text-xs">
                        <p className="font-semibold text-gray-900">{r.rideName}</p>
                        {r.rideDescription && (
                          <p className="text-gray-500 mt-0.5 line-clamp-2">{r.rideDescription}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <p className="text-gray-600">
                            {r.scheduleDate} {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                          </p>
                          {r.callTime && (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              <AlarmClock className="w-3 h-3" /> Call {fmtTime(r.callTime)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="bg-white/70 rounded-xl p-2.5 text-xs flex items-center justify-between">
                      <span className="text-gray-500">Bundle price</span>
                      <span className="font-bold text-gray-900">₱{verifiedBooking.paymentAmount?.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-white/70 rounded-xl p-2.5">
                      <p className="text-gray-500 mb-0.5">Attraction</p>
                      <p className="font-medium text-gray-900">{verifiedBooking.rideName}</p>
                      {verifiedBooking.rideDescription && (
                        <p className="text-gray-500 mt-1 line-clamp-2">{verifiedBooking.rideDescription}</p>
                      )}
                    </div>
                    <div className="bg-white/70 rounded-xl p-2.5">
                      <p className="text-gray-500 mb-0.5">Schedule</p>
                      <p className="font-medium text-gray-900">
                        {verifiedBooking.scheduleDate} {fmtTime(verifiedBooking.startTime)} – {fmtTime(verifiedBooking.endTime)}
                      </p>
                      {verifiedBooking.callTime && (
                        <p className="flex items-center gap-1 text-amber-600 font-medium mt-1">
                          <AlarmClock className="w-3 h-3" /> Call {fmtTime(verifiedBooking.callTime)}
                        </p>
                      )}
                    </div>
                    <div className="bg-white/70 rounded-xl p-2.5">
                      <p className="text-gray-500 mb-0.5">Attraction price</p>
                      <p className="font-bold text-gray-900">₱{verifiedBooking.ridePrice?.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-2.5">
                      <p className="text-gray-500 mb-0.5">Payment</p>
                      <p className={`font-semibold ${verifiedBooking.paymentStatus === 'Paid' ? 'text-green-700' : 'text-amber-700'}`}>
                        {verifiedBooking.paymentStatus}
                      </p>
                    </div>
                  </div>
                )}

                {/* ✅ CHANGED — one ticket per booking (1:1): the guest riding
                    isn't always the visitor account holder (e.g. a parent
                    booking on behalf of their father/child), so always show
                    the guest's own name here (plus age/height/weight, when
                    the ride restricts any of those) — was gated behind
                    "> 1 guest" from the old group-booking feature, which
                    made it never show now that every booking has exactly
                    one guest. */}
                {(verifiedBooking.guests?.length ?? 0) > 0 && (
                  <div className="bg-white/70 rounded-xl p-2.5 text-xs mb-3">
                    <p className="text-gray-500 mb-1.5 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {verifiedBooking.guests!.length > 1 ? `Party (${verifiedBooking.guests!.length})` : 'Reservation details'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {verifiedBooking.guests!.map(g => (
                        <span key={g.id} className="text-[11px] text-gray-700 bg-white border border-gray-200 rounded-full px-2 py-1">
                          {g.guestName}
                          {(g.heightCm != null || g.ageYears != null || g.weightKg != null) && (
                            <span className="text-gray-400">
                              {' '}({[g.heightCm != null ? `${g.heightCm}cm` : null, g.weightKg != null ? `${g.weightKg}kg` : null, g.ageYears != null ? `${g.ageYears}y` : null].filter(Boolean).join(', ')})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* schedule-window warnings — mirrors backend's ValidateScheduleWindow.
                    Two distinct messages: too early (before checkInOpensAt, i.e.
                    the call time) vs too late (after endTime). */}
                {(isApprovedAndUnpaid || isApprovedAndPaid) && isBeforeWindow && checkInOpensAt && scheduleStart && (
                  <div className="flex items-center gap-2 bg-white/70 border border-red-200 rounded-xl p-2.5 text-xs text-red-800 mb-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {new Date().toDateString() === checkInOpensAt.toDateString()
                      ? `Check-in opens at ${checkInOpensAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} today (the call time).`
                      : `This attraction is scheduled for ${scheduleStart.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} — check-in isn't open yet.`}
                  </div>
                )}

                {(isApprovedAndUnpaid || isApprovedAndPaid) && isAfterWindow && scheduleEnd && (
                  <div className="flex items-center gap-2 bg-white/70 border border-red-200 rounded-xl p-2.5 text-xs text-red-800 mb-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {`Check-in closed at ${scheduleEnd.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} — this attraction's window has ended.`}
                  </div>
                )}

                {isApprovedAndUnpaid && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 bg-white/70 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Payment not yet collected. Collect ₱{(verifiedBooking.ridePrice ?? verifiedBooking.paymentAmount)?.toFixed(2)} before completing the attraction.
                    </div>
                    <button onClick={handleCollectPayment} disabled={collectingPayment || !isScheduleDue}
                      title={!isScheduleDue ? 'Outside the check-in window for this schedule.' : undefined}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600
                        hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 shadow-sm">
                      {collectingPayment
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Wallet className="w-4 h-4" />}
                      Collect payment (₱{(verifiedBooking.ridePrice ?? verifiedBooking.paymentAmount)?.toFixed(2)})
                    </button>
                  </div>
                )}

                {isApprovedAndPaid && (
                  <div className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium ${
                    canCompleteRide ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-green-100 text-green-700'
                  }`}>
                    {canCompleteRide
                      ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      : <Clock className="w-4 h-4 flex-shrink-0" />}
                    <span>
                      {canCompleteRide
                        ? 'Window closed — completing automatically, this updates within a minute.'
                        : (verifiedBooking?.promoId
                            ? `Checked in — completes automatically once every included attraction is over${scheduleEnd ? ` (last attraction ends ${scheduleEnd.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })})` : ''}.`
                            : `Checked in — completes automatically once the window closes${scheduleEnd ? ` at ${scheduleEnd.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}.`)}
                    </span>
                  </div>
                )}

                {verifiedBooking.status === 'Completed' && (
                  <div className="flex items-center justify-center gap-2 py-2.5 bg-blue-100 text-blue-700 rounded-xl text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Attraction already completed
                  </div>
                )}

                {verifiedBooking.status !== 'Approved' && verifiedBooking.status !== 'Completed' && (
                  <div className="flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold">
                    <XCircle className="w-4 h-4" /> Deny entry — booking not approved
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <Ticket className="w-7 h-7 text-amber-400" />
                </div>
                <div className="font-semibold text-gray-500 text-sm">No booking verified yet</div>
                <div className="text-xs text-gray-400 mt-1 max-w-[220px]">Scan or type a visitor's booking code above to check them in.</div>
              </div>
            )}

            {/* Status guide */}
            <div className="border border-gray-100 rounded-2xl p-4 space-y-2.5 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-500 mb-1">Status guide</p>
              {[
                { status: 'Approved + Paid',    desc: 'Ready to go — mark as completed', color: 'bg-green-100 text-green-700' },
                { status: 'Approved + Unpaid',  desc: 'Collect payment, then complete', color: 'bg-amber-100 text-amber-700' },
                { status: 'Pending',            desc: 'Not yet approved — contact admin', color: 'bg-amber-100 text-amber-700' },
                { status: 'Rejected/Cancelled', desc: 'Booking inactive — deny entry', color: 'bg-gray-100 text-gray-600' },
                // ✅ Missed now gets its own color (orange) — it used to share the exact
                // same red as Rejected, making the two impossible to tell apart at a glance.
                { status: 'Missed',             desc: 'Unpaid past start time — auto-flagged, deny entry', color: 'bg-orange-100 text-orange-700' },
              ].map(g => (
                <div key={g.status} className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${g.color}`}>{g.status}</span>
                  <span className="text-xs text-gray-500">{g.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assigned schedules */}
        <div ref={schedulesSectionRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm scroll-mt-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">My assigned schedules</div>
              <div className="text-xs text-gray-400">Click a row to view attendees</div>
            </div>
          </div>

          {/* Status filter chips + date range filter */}
          <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between gap-2 bg-gray-50/50 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {(['All', 'Open', 'Full', 'Completed', 'Cancelled'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === s
                      ? s === 'Open' ? 'bg-green-500 text-white'
                      : s === 'Full' ? 'bg-red-500 text-white'
                      : s === 'Completed' ? 'bg-blue-500 text-white'
                      : s === 'Cancelled' ? 'bg-slate-700 text-white'
                      : 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}>
                  {s}
                  {s !== 'All' && ` (${
                    s === 'Open' ? chipOpenCount
                    : s === 'Full' ? chipFullCount
                    : s === 'Completed' ? chipCompletedCount
                    : chipCancelledCount
                  })`}
                </button>
              ))}
            </div>

            {/* Date range — narrows the list independently of the month picker above */}
            <DateRangeButton
              from={dateFrom} to={dateTo}
              onClick={() => setDateModalOpen(true)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : displaySchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <Calendar className="w-14 h-14 mb-3 text-gray-200" />
              <div className="font-semibold text-gray-500">No schedules found</div>
              <div className="text-xs mt-1">Try a different month or status filter.</div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {pagedSchedules.map(s => (
                  <div key={s.id}
                    onClick={() => fetchRoster(s)}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/60 transition-colors group cursor-pointer">
                    <RideThumb path={s.rideImagePath} name={s.rideName} onZoom={setZoomSrc} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-900 text-sm truncate">{s.rideName}</p>
                        <ScheduleTypeBadge type={s.scheduleType} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{s.scheduleDate}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.availableSlots}/{s.maxSlots}</span>
                        <CallTimeBadge time={s.callTime} />
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0
                      ${s.status === 'Open' ? 'bg-green-100 text-green-700'
                        : s.status === 'Full' ? 'bg-red-100 text-red-700'
                        : s.status === 'Completed' ? 'bg-blue-100 text-blue-700'
                        // ✅ FIXED — was the same 'bg-gray-100 text-gray-600' as the
                        // "Regular" type badge right next to it, so a Cancelled
                        // Regular schedule showed two identical gray pills. Now a
                        // distinct slate/dark badge so it reads as its own status.
                        : s.status === 'Cancelled' ? 'bg-slate-700 text-white'
                        : 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                    <span className="text-[10px] text-amber-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex-shrink-0">
                      View list →
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
                <span className="text-xs text-gray-500">
                  Showing <strong>{pagedSchedules.length}</strong> of <strong>{displaySchedules.length}</strong> in {monthLabel}
                </span>
                {schedTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSchedPage(p => Math.max(1, p - 1))}
                      disabled={schedPage <= 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: schedTotalPages }, (_, i) => i + 1)
                      .filter(p => Math.abs(p - schedPage) <= 2)
                      .map(p => (
                        <button key={p} onClick={() => setSchedPage(p)}
                          className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                            p === schedPage ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                          }`}>{p}</button>
                      ))}
                    <button onClick={() => setSchedPage(p => Math.min(schedTotalPages, p + 1))}
                      disabled={schedPage >= schedTotalPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {rosterSchedule && (
        <RosterModal
          schedule={rosterSchedule}
          bookings={rosterBookings}
          loading={rosterLoading}
          onClose={() => setRosterSchedule(null)}
          onZoom={setZoomSrc}
        />
      )}

      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}

      {dateModalOpen && (
        <DateRangeModal
          from={dateFrom} to={dateTo}
          onApply={(f, t) => { setDateFrom(f); setDateTo(t) }}
          onClose={() => setDateModalOpen(false)}
        />
      )}
    </div>
  )
}
