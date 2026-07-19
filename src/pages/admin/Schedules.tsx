import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Calendar, Clock, Users, CheckCircle2, Trash2, Loader2, X, ChevronDown, Search, ChevronRight, ChevronLeft, UserCog, AlarmClock } from 'lucide-react'
import type { Schedule, Ride, User } from '../../types'
import api from '../../services/api'
import toast from 'react-hot-toast'

const emptyForm = {
  rideId: 0, attendantId: '', scheduleDate: '', callTime: '', startTime: '', endTime: '', maxSlots: 20, status: 'Open',
  scheduleType: 'Regular', // ✅ NEW — Regular | Promo, fully separate pools
  // ✅ NEW — bulk date-range creation. 'single' behaves exactly as before;
  // 'range' creates one schedule per day between rangeStart/rangeEnd
  // (inclusive), each using the same ride/type/times/slots, but the
  // attendant can either be the same for every day or picked per day.
  dateMode: 'single' as 'single' | 'range',
  rangeStart: '', rangeEnd: '',
  attendantMode: 'same' as 'same' | 'different',
  rangeAttendants: {} as Record<string, string>,
}

// ✅ NEW — every ISO date from start to end, inclusive. Used by date-range
// bulk schedule creation.
function datesInRange(startISO: string, endISO: string): string[] {
  const out: string[] = []
  if (!startISO || !endISO) return out
  const d = new Date(startISO + 'T00:00:00')
  const end = new Date(endISO + 'T00:00:00')
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ✅ NEW — small Regular/Promo tag, pink to match the Ride Promo feature's
// established brand color elsewhere in the app.
function ScheduleTypeBadge({ type, className = '' }: { type?: string; className?: string }) {
  const isPromo = type === 'Promo'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
      isPromo ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-gray-100 text-gray-600 border-gray-200'
    } ${className}`}>
      {isPromo ? 'Promo' : 'Regular'}
    </span>
  )
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Formats a TimeOnly string ("10:20:00" or "10:20") into "10:20 AM"
const fmtTime = (t?: string) => {
  if (!t) return '—'
  return new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ✅ NEW — adds `mins` minutes to an "HH:MM" string, used to auto-calculate
// End time from Start time + the selected ride's duration. Flags `wrapped`
// if the result would roll past midnight (into the next day), since a
// schedule's start/end must stay on the same ScheduleDate.
function addMinutes(hhmm: string, mins: number): { time: string; wrapped: boolean } {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  const wrapped = total >= 24 * 60 || total < 0
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = Math.floor(norm / 60)
  const mm = norm % 60
  return { time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, wrapped }
}

// ── "Now" helpers for the time-floor feature — local (not UTC) so they
// line up with form.scheduleDate (built from local Y/M/D in DatePicker's
// toISO) and with the "HH:mm" values TimePicker emits. Plain functions,
// not memoized, so every call reflects the live clock. ──
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ✅ UPDATED — now keyed off CALL TIME instead of start time, mirroring the
// backend's UpdateAsync/DeleteAsync checks in ScheduleService.cs. Once the
// attendant's call time has passed, the schedule is effectively locked —
// used to proactively gray out the Edit/Delete buttons and to give an
// immediate toast before even opening the modal or confirming a delete.
function isCallTimePassed(s: Schedule) {
  if (!s.scheduleDate || !s.callTime) return false
  return new Date(`${s.scheduleDate}T${s.callTime}`) <= new Date()
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

const statusColor = (s: string) => {
  if (s === 'Open')      return 'bg-green-100 text-green-700 border-green-300'
  if (s === 'Full')      return 'bg-red-100 text-red-700 border-red-300'
  if (s === 'Completed') return 'bg-blue-100 text-blue-700 border-blue-300'
  if (s === 'Cancelled') return 'bg-gray-100 text-gray-500 border-gray-300'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

const statusDot = (s: string) => {
  if (s === 'Open')      return 'bg-green-500'
  if (s === 'Full')      return 'bg-red-500'
  if (s === 'Completed') return 'bg-blue-500'
  if (s === 'Cancelled') return 'bg-gray-400'
  return 'bg-gray-400'
}

// ── Month/Year Picker — jump directly to any month or year ─────
function MonthYearPicker({ year, month, onChange, onClose }: {
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
                onClick={() => { onChange(viewYear, i); onClose() }}
                className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-violet-50 text-violet-700 border border-violet-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>

        {/* Quick jump to today */}
        <div className="px-4 pb-4">
          <button type="button"
            onClick={() => { onChange(today.getFullYear(), today.getMonth()); onClose() }}
            className="w-full py-2 rounded-xl text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors">
            Jump to today
          </button>
        </div>
      </div>
    </>
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

// ── Day Detail Modal ───────────────────────────────────────────
const DAY_MODAL_PAGE_SIZE = 3

function DayModal({ date, schedules, onClose, onEdit, onDelete}: {
  date: Date; schedules: Schedule[]
  onClose: () => void
  onEdit: (s: Schedule) => void
  onDelete: (s: Schedule) => void
}) {
  const label = date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // ✅ NEW — search bar to filter this day's schedules by ride name.
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = search.trim()
    ? schedules.filter(s => s.rideName?.toLowerCase().includes(search.trim().toLowerCase()))
    : schedules

  const totalPages = Math.max(1, Math.ceil(filtered.length / DAY_MODAL_PAGE_SIZE))
  const pageSchedules = filtered.slice((page - 1) * DAY_MODAL_PAGE_SIZE, page * DAY_MODAL_PAGE_SIZE)

  const handleSearchChange = (v: string) => {
    setSearch(v)
    setPage(1) // reset to page 1 whenever the filter changes
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">{label}</div>
            <div className="text-xs text-gray-400">{schedules.length} schedule{schedules.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="flex items-center gap-2">

            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ✅ NEW — ride search bar */}
        {schedules.length > 0 && (
          <div className="px-5 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search rides..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              {search && (
                <button type="button" onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-gray-400">
              <Calendar className="w-10 h-10 mb-2 text-gray-200" />
              <div className="text-sm">
                {schedules.length === 0 ? 'No schedules for this day' : `No rides matching "${search}"`}
              </div>
            </div>
          ) : pageSchedules.map(s => {
            // Locked once the ride is Completed OR the attendant's call
            // time has already passed — both Edit and Delete respect this.
            const completed = s.status === 'Completed'
            const callPassed = isCallTimePassed(s)
            const locked = completed || callPassed
            const lockReason = completed
              ? 'Completed schedules cannot be changed'
              : callPassed
              ? 'Call time already passed — cannot be changed'
              : undefined
            return (
            <div key={s.id} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-gray-900 text-sm">{s.rideName}</div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <ScheduleTypeBadge type={s.scheduleType} />
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor(s.status)}`}>
                    {s.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-1 flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {s.availableSlots}/{s.maxSlots} slots
                </div>
              </div>
              <CallTimeBadge time={s.callTime} className="text-[11px] mb-2" />
              {s.attendantName && (
                <div className="flex items-center gap-1 text-xs text-orange-700 font-medium mb-3">
                  <UserCog className="w-3.5 h-3.5 text-orange-600" />
                  {s.attendantName}
                </div>
              )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onEdit(s)}
                disabled={locked}
                title={lockReason ?? 'Edit'}
                className={`flex items-center justify-center w-7 h-7 border rounded-lg transition-colors ${
                  locked
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(s)}
                disabled={locked}
                title={lockReason ?? 'Delete'}
                className={`flex items-center justify-center w-7 h-7 border rounded-lg transition-colors ${
                  locked
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                }`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            </div>
            )
          })}
        </div>

        {filtered.length > DAY_MODAL_PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <span className="text-xs text-gray-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-medium transition-colors ${
                    p === page ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Searchable Dropdown ────────────────────────────────────────
// ── Time Picker — tactile stepper spinner ────────────────────────
// Big digits with up/down arrows (and mouse-wheel support) for hour
// and minute — no lists, no popups, just click/scroll to dial it in.
function SpinnerDigit({ value, onUp, onDown, label, disableUp, disableDown }: {
  value: string; onUp: () => void; onDown: () => void; label: string
  disableUp?: boolean; disableDown?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={onUp} disabled={disableUp} tabIndex={-1}
        className={`w-8 h-5 flex items-center justify-center rounded-t-md transition-colors ${
          disableUp ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
        }`}>
        <ChevronDown className="w-3.5 h-3.5 rotate-180" />
      </button>
      <div
        onWheel={e => { e.preventDefault(); e.deltaY < 0 ? onUp() : onDown() }}
        className="w-10 text-center text-lg font-bold text-gray-900 select-none py-0.5 cursor-ns-resize"
        title={`Scroll to change ${label}`}>
        {value}
      </div>
      <button type="button" onClick={onDown} disabled={disableDown} tabIndex={-1}
        className={`w-8 h-5 flex items-center justify-center rounded-b-md transition-colors ${
          disableDown ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
        }`}>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function TimePicker({ value, onChange, accent = 'emerald', minTime }: {
  value: string; onChange: (v: string) => void; accent?: 'emerald' | 'red'; minTime?: string
}) {
  const parse24 = (v: string) => {
    if (!v) return { hour12: 12, minute: 0, period: 'AM' as 'AM'|'PM' }
    const [hStr, mStr] = v.split(':')
    let h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const period: 'AM'|'PM' = h >= 12 ? 'PM' : 'AM'
    let hour12 = h % 12
    if (hour12 === 0) hour12 = 12
    return { hour12, minute: m, period }
  }

  const { hour12, minute, period } = parse24(value)

  const to24 = (h12: number, m: number, p: 'AM'|'PM') => {
    let h = h12 % 12
    if (p === 'PM') h += 12
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  // ── Floor enforcement — when scheduling for today, the caller passes
  // minTime = the current "HH:mm". Both strings are 24-hour zero-padded,
  // so plain string comparison tells us if a candidate time is too early. ──
  const clampToMin = (h12: number, m: number, p: 'AM'|'PM') => {
    const candidate = to24(h12, m, p)
    onChange(minTime && candidate < minTime ? minTime : candidate)
  }

  const atFloor = !!minTime && to24(hour12, minute, period) <= minTime

  const bumpHour = (delta: number) => {
    if (delta < 0 && atFloor) return
    let h = hour12 + delta
    if (h > 12) h = 1
    if (h < 1) h = 12
    clampToMin(h, minute, period)
  }
  const bumpMinute = (delta: number) => {
    if (delta < 0 && atFloor) return
    let m = minute + delta
    if (m > 59) m = 0
    if (m < 0) m = 59
    clampToMin(hour12, m, period)
  }

  // A whole AM/PM half can be entirely in the past today (e.g. it's
  // 4:32 PM, so AM is off the table) — disable the button instead of
  // letting it silently snap back to the floor.
  const periodDisabled = (p: 'AM'|'PM') => {
    if (!minTime) return false
    const latestInPeriod = p === 'AM' ? '11:59' : '23:59'
    return latestInPeriod < minTime
  }

  const selectPeriod = (p: 'AM'|'PM') => {
    if (periodDisabled(p)) return
    clampToMin(hour12, minute, p)
  }

  const ring = accent === 'red' ? 'focus-within:ring-red-300' : 'focus-within:ring-emerald-300'
  const iconColor = accent === 'red' ? 'text-red-400' : 'text-gray-400'
  const periodActive = accent === 'red' ? 'bg-red-600' : 'bg-emerald-600'

  return (
    <div className={`flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus-within:ring-2 ${ring} w-fit`}>
      <Clock className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />

      <SpinnerDigit value={String(hour12).padStart(2,'0')} label="hour"
        onUp={() => bumpHour(1)} onDown={() => bumpHour(-1)} disableDown={atFloor} />

      <span className="text-gray-300 font-bold">:</span>

      <SpinnerDigit value={String(minute).padStart(2,'0')} label="minute"
        onUp={() => bumpMinute(1)} onDown={() => bumpMinute(-1)} disableDown={atFloor} />

      <div className="flex flex-col gap-0.5 ml-1">
        {(['AM','PM'] as const).map(p => {
          const disabled = periodDisabled(p)
          return (
            <button key={p} type="button" onClick={() => selectPeriod(p)}
              disabled={disabled}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                disabled
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  : period === p ? `${periodActive} text-white` : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}>
              {p}
            </button>
          )
        })}
      </div>
    </div>
  )
}


// ── Searchable Dropdown ────────────────────────────────────────
// ── Date Picker — custom calendar, matches the app's design ──────
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function DatePicker({ value, onChange }: {
  value: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()

  const initial = value ? new Date(value + 'T00:00:00') : today
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [viewYear, setViewYear] = useState(initial.getFullYear())

  // ✅ FIXED — this field can sit inside the modal's two-column date-range
  // grid (Start date / End date). An `absolute` dropdown anchored to that
  // narrow column's left edge overflowed past the modal's own right edge
  // and rendered on top of whatever was behind the modal. Same fix as
  // PromoDatePicker in Promos.tsx: fixed positioning computed from the
  // trigger button's own on-screen position escapes the parent's bounds
  // (and its overflow-y-auto scroll box) entirely, and is clamped to stay
  // on-screen instead of bleeding off the right edge of the viewport.
  const btnRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const POPUP_WIDTH = 288 // w-72

  const openPicker = () => {
    const d = value ? new Date(value + 'T00:00:00') : today
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear())
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      let left = rect.left
      if (left + POPUP_WIDTH > window.innerWidth - 8) left = window.innerWidth - 8 - POPUP_WIDTH
      setCoords({ top: rect.bottom + 4, left: Math.max(8, left) })
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

  const toISO = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const displayLabel = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select a date'

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta, y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m); setViewYear(y)
  }

  const isSelected = (d: number) => value === toISO(viewYear, viewMonth, d)
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  const isPast = (d: number) => {
    const cellDate = new Date(viewYear, viewMonth, d)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return cellDate < todayStart
  }

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => (open ? setOpen(false) : openPicker())}
        className={`w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
          value ? 'text-gray-900' : 'text-gray-400'
        }`}>
        {displayLabel}
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed z-[70] w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
            style={{ top: coords.top, left: coords.left }}>
            {/* Month navigator */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button type="button" onClick={() => shiftMonth(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-gray-900 text-sm">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 px-3 pt-3">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1 p-3">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const disabled = isPast(d)
                return (
                  <button key={d} type="button" disabled={disabled}
                    onClick={() => { if (!disabled) { onChange(toISO(viewYear, viewMonth, d)); setOpen(false) } }}
                    className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                      disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected(d)
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isToday(d)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    {d}
                  </button>
                )
              })}
            </div>

            {/* Clear / Today shortcuts */}
            <div className="flex items-center gap-2 p-3 border-t border-gray-100">
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                Clear
              </button>
              <button type="button"
                onClick={() => { onChange(toISO(today.getFullYear(), today.getMonth(), today.getDate())); setOpen(false) }}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


// ── Searchable Dropdown ────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[]
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-left">
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No results</div>
              ) : filtered.map(o => (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${value === o.value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [rides, setRides]         = useState<Ride[]>([])
  const [attendants, setAttendants] = useState<User[]>([])

  // calendar state
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [dayModal, setDayModal] = useState<Date | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // form modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editSched, setEditSched] = useState<Schedule | null>(null)
  const [form, setForm]           = useState({ ...emptyForm })
  const [saving, setSaving]       = useState(false)

  // ── Time floor — when the picked schedule date is today, none of the
  // three time fields may be set earlier than right now. Recomputed every
  // render so it stays accurate while the modal sits open. ──
  const scheduleIsToday = form.scheduleDate === todayISO()
  const minTimeToday = scheduleIsToday ? nowHHMM() : undefined

  // ✅ NEW — End time is auto-calculated from Start time + the selected
  // ride's own duration (e.g. Fantasy Carousel runs 5 minutes), instead of
  // admins having to work it out and type it in by hand. Re-runs whenever
  // the ride or start time changes while the modal is open.
  const selectedRideDuration = rides.find(r => r.id === Number(form.rideId))
  const durationWraps = !!(selectedRideDuration && form.startTime &&
    addMinutes(form.startTime, selectedRideDuration.durationMinutes).wrapped)

  useEffect(() => {
    if (!modalOpen || !selectedRideDuration || !form.startTime || !selectedRideDuration.durationMinutes) return
    const { time, wrapped } = addMinutes(form.startTime, selectedRideDuration.durationMinutes)
    if (!wrapped && form.endTime !== time) {
      setForm(f => ({ ...f, endTime: time }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, form.rideId, form.startTime, selectedRideDuration?.durationMinutes])

  // confirm modals
  const [confirmSave, setConfirmSave]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => { fetchSchedules() }, [calYear, calMonth])
  useEffect(() => { fetchDropdowns() }, [])

  const autoComplete = async () => {
    try { await api.put('/api/schedule/auto-complete') } catch {}
  }

  const fetchSchedules = async () => {
    await autoComplete()
    setLoading(true)
    try {
      // fetch entire month
      const res = await api.get('/api/schedule', {
        params: { page: 1, pageSize: 200 }
      })
      const paged = res.data?.data ?? res.data
      setSchedules(paged?.data ?? (Array.isArray(paged) ? paged : []))
    } catch { toast.error('Failed to load schedules.') }
    finally { setLoading(false) }
  }

  const fetchDropdowns = async () => {
    try {
      const [ridesRes, usersRes] = await Promise.all([
        api.get('/api/ride', { params: { pageSize: 100 } }),
        api.get('/api/user', { params: { pageSize: 100, role: 'Ride Attendant' } }),
      ])
      const ridesData = ridesRes.data?.data?.data ?? ridesRes.data?.data ?? ridesRes.data ?? []
      const usersData = usersRes.data?.data?.data ?? usersRes.data?.data ?? usersRes.data ?? []
      setRides(Array.isArray(ridesData) ? ridesData.filter((r: any) => !r.isDeleted) : [])
      setAttendants(Array.isArray(usersData) ? usersData.filter((u: any) => u.role === 'Ride Attendant' && u.isActive) : [])
    } catch {}
  }

  // Calendar helpers
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const monthName = new Date(calYear, calMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  const getSchedulesForDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return schedules.filter(s => {
      const sd = s.scheduleDate?.slice(0,10)
      return sd === dateStr
    })
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const openCreate = (dateStr?: string) => {
    setEditSched(null)
    setForm({ ...emptyForm, scheduleDate: dateStr ?? '' })
    setModalOpen(true)
  }

  // ✅ NEW — every date the range currently spans, or [] if the range isn't
  // fully picked yet / is backwards.
  const rangeDates = form.dateMode === 'range' && form.rangeStart && form.rangeEnd && form.rangeStart <= form.rangeEnd
    ? datesInRange(form.rangeStart, form.rangeEnd)
    : []

  const openEdit = (s: Schedule) => {
    if (s.status === 'Completed') {
      toast.error('Completed schedules cannot be edited.')
      return
    }
    // ✅ UPDATED — mirrors the backend: block edits once the attendant's
    // CALL TIME has already passed, not just the ride's start time.
    if (isCallTimePassed(s)) {
      const startedDate = new Date(s.scheduleDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      toast.error(`This schedule cannot be edited — call time already passed at ${fmtTime(s.callTime)} on ${startedDate}.`)
      return
    }
    setEditSched(s)
    setForm({
      ...emptyForm,
      rideId:       s.rideId,
      attendantId:  String(s.attendantId ?? ''),
      scheduleDate: s.scheduleDate,
      callTime:     s.callTime?.slice(0, 5) ?? '',
      startTime:    s.startTime?.slice(0, 5) ?? '',
      endTime:      s.endTime?.slice(0, 5) ?? '',
      maxSlots:     s.maxSlots,
      status:       s.status ?? 'Open',
      scheduleType: s.scheduleType ?? 'Regular',
    })
    setDayModal(null)
    setModalOpen(true)
  }

  const handleSubmitClick = (e: FormEvent) => {
    e.preventDefault()
    if (!form.rideId)       { toast.error('Please select a ride.'); return }

    // ── Date-range mode (create-only): validate the range + times/slots
    // shared by every day, plus the attendant assignment(s), then hand off
    // to the same confirm dialog. Per-day creation happens in doSave. ──
    if (!editSched && form.dateMode === 'range') {
      if (!form.rangeStart || !form.rangeEnd) { toast.error('Pick both a start and end date for the range.'); return }
      if (form.rangeStart > form.rangeEnd)     { toast.error('Range end date must be on or after the start date.'); return }
      if (form.rangeStart < todayISO())        { toast.error('Range start date cannot be in the past.'); return }
      if (!form.startTime) { toast.error('Start time is required.'); return }
      if (!form.endTime)   { toast.error('End time is required.'); return }
      if (form.startTime >= form.endTime) { toast.error('End time must be after start time.'); return }
      {
        const rideForDuration = rides.find(r => r.id === Number(form.rideId))
        if (rideForDuration?.durationMinutes) {
          const expected = addMinutes(form.startTime, rideForDuration.durationMinutes)
          if (expected.wrapped) {
            toast.error(`${rideForDuration.name} runs ${rideForDuration.durationMinutes} minute(s) — that would push the end time past midnight from this start time. Pick an earlier start time.`)
            return
          }
          if (expected.time !== form.endTime) {
            toast.error(`${rideForDuration.name} runs exactly ${rideForDuration.durationMinutes} minute(s) — end time must be ${fmtTime(expected.time)}.`)
            return
          }
        }
      }
      if (!form.callTime) { toast.error('Call time is required.'); return }
      if (form.callTime >= form.startTime) { toast.error('Call time must be earlier than the start time.'); return }
      // If the range happens to start today, the shared times still can't
      // be behind the clock — same rule as single-date mode.
      if (rangeDates.includes(todayISO())) {
        const nowStr = nowHHMM()
        if (form.callTime < nowStr)  { toast.error(`Call time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
        if (form.startTime < nowStr) { toast.error(`Start time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
        if (form.endTime < nowStr)   { toast.error(`End time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
      }
      if (!form.maxSlots || form.maxSlots < 1) { toast.error('Max slots must be at least 1.'); return }
      const selectedRideForRange = rides.find(r => r.id === Number(form.rideId))
      if (selectedRideForRange && form.maxSlots > selectedRideForRange.maxCapacity) {
        toast.error(`Max slots (${form.maxSlots}) cannot exceed "${selectedRideForRange.name}"'s capacity (${selectedRideForRange.maxCapacity}).`)
        return
      }
      if (form.attendantMode === 'same') {
        if (!form.attendantId) { toast.error('Please assign an attendant — schedules cannot be Unassigned.'); return }
      } else {
        const missing = rangeDates.filter(d => !form.rangeAttendants[d])
        if (missing.length > 0) {
          toast.error(`Please assign an attendant for every date in the range (missing ${missing.length}).`)
          return
        }
      }
      setConfirmSave(true)
      return
    }

    if (!form.scheduleDate) { toast.error('Schedule date is required.'); return }
    if (!form.startTime)    { toast.error('Start time is required.'); return }
    if (!form.endTime)      { toast.error('End time is required.'); return }
    if (form.startTime >= form.endTime) { toast.error('End time must be after start time.'); return }
    // ── End time is auto-calculated from the ride's duration, but double
    // check it actually matches in case start time changed right as the
    // auto-calc effect was about to run (or wrapped past midnight). ──
    {
      const rideForDuration = rides.find(r => r.id === Number(form.rideId))
      if (rideForDuration?.durationMinutes) {
        const expected = addMinutes(form.startTime, rideForDuration.durationMinutes)
        if (expected.wrapped) {
          toast.error(`${rideForDuration.name} runs ${rideForDuration.durationMinutes} minute(s) — that would push the end time past midnight from this start time. Pick an earlier start time.`)
          return
        }
        if (expected.time !== form.endTime) {
          toast.error(`${rideForDuration.name} runs exactly ${rideForDuration.durationMinutes} minute(s) — end time must be ${fmtTime(expected.time)}.`)
          return
        }
      }
    }
    // ── Call time must exist and be strictly earlier than start time —
    // mirrors the backend's [TimeBefore] data annotation on the schedule DTOs.
    if (!form.callTime)     { toast.error('Call time is required.'); return }
    if (form.callTime >= form.startTime) { toast.error('Call time must be earlier than the start time.'); return }
    // ── Mirrors the backend's [NotInPast] validation — if the schedule is
    // for today, none of the three times may already be behind the clock. ──
    if (form.scheduleDate === todayISO()) {
      const nowStr = nowHHMM()
      if (form.callTime < nowStr)  { toast.error(`Call time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
      if (form.startTime < nowStr) { toast.error(`Start time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
      if (form.endTime < nowStr)   { toast.error(`End time cannot be earlier than the current time (${fmtTime(nowStr)}).`); return }
    }
    if (!form.attendantId)  { toast.error('Please assign an attendant — schedules cannot be Unassigned.'); return }
    if (!form.maxSlots || form.maxSlots < 1) { toast.error('Max slots must be at least 1.'); return }

    // ── Max slots cannot exceed the selected ride's capacity ──────
    const selectedRide = rides.find(r => r.id === Number(form.rideId))
    if (selectedRide && form.maxSlots > selectedRide.maxCapacity) {
      toast.error(`Max slots (${form.maxSlots}) cannot exceed "${selectedRide.name}"'s capacity (${selectedRide.maxCapacity}).`)
      return
    }

    // ── Max slots cannot drop below already-booked slots ──────────
    if (editSched) {
      const bookedSlots = editSched.maxSlots - editSched.availableSlots
      if (form.maxSlots < bookedSlots) {
        toast.error(`Cannot set max slots to ${form.maxSlots} — ${bookedSlots} slot(s) are already booked. Max slots must be at least ${bookedSlots}.`)
        return
      }
      // ✅ NEW — mirrors the backend: Regular/Promo are fully separate pools,
      // so flipping the type once anything is booked would orphan it.
      if (form.scheduleType !== (editSched.scheduleType ?? 'Regular') && bookedSlots > 0) {
        toast.error(`Cannot change this schedule's type — ${bookedSlots} slot(s) are already booked against it as '${editSched.scheduleType ?? 'Regular'}'.`)
        return
      }
    }

    setConfirmSave(true)
  }

  // Pulls the backend's actual validation message out of an error response,
  // same extraction logic used by the single-schedule save below.
  const extractErrMsg = (e: any, fallback: string) => {
    const data = e.response?.data
    const validationMsg = data?.errors ? Object.values(data.errors)[0] : null
    return data?.message ?? (Array.isArray(validationMsg) ? validationMsg[0] : null) ?? fallback
  }

  const doSave = async () => {
    setSaving(true)

    // ── Date-range mode: one POST per day in the range, sequentially so a
    // conflict on one day (e.g. the attendant already has something else
    // booked that slot) doesn't abort the rest of the batch. ──
    if (!editSched && form.dateMode === 'range') {
      let ok = 0
      const failures: string[] = []
      for (const date of rangeDates) {
        const attendantForDay = form.attendantMode === 'same' ? form.attendantId : form.rangeAttendants[date]
        const payload = {
          rideId:      Number(form.rideId),
          attendantId: attendantForDay ? Number(attendantForDay) : null,
          scheduleDate: date,
          callTime:    form.callTime.length === 5 ? `${form.callTime}:00` : form.callTime,
          startTime:   form.startTime.length === 5 ? `${form.startTime}:00` : form.startTime,
          endTime:     form.endTime.length === 5   ? `${form.endTime}:00`   : form.endTime,
          maxSlots:    form.maxSlots,
          scheduleType: form.scheduleType,
        }
        try {
          await api.post('/api/schedule', payload)
          ok++
        } catch (e: any) {
          failures.push(`${date}: ${extractErrMsg(e, 'failed')}`)
        }
      }
      setConfirmSave(false); setModalOpen(false); fetchSchedules()
      if (failures.length === 0) {
        toast.success(`Created ${ok} schedule${ok === 1 ? '' : 's'} across the date range.`)
      } else if (ok === 0) {
        toast.error(`All ${failures.length} schedule(s) failed to create. First issue: ${failures[0]}`)
      } else {
        toast.error(`Created ${ok}, but ${failures.length} failed. First issue: ${failures[0]}`)
      }
      setSaving(false)
      return
    }

    try {
      const payload = {
        rideId:      Number(form.rideId),
        attendantId: form.attendantId ? Number(form.attendantId) : null,
        scheduleDate: form.scheduleDate,
        callTime:    form.callTime.length === 5 ? `${form.callTime}:00` : form.callTime,
        startTime:   form.startTime.length === 5 ? `${form.startTime}:00` : form.startTime,
        endTime:     form.endTime.length === 5   ? `${form.endTime}:00`   : form.endTime,
        maxSlots:    form.maxSlots,
        scheduleType: form.scheduleType,
        ...(editSched && { status: form.status }),
      }
      if (editSched) {
        await api.put(`/api/schedule/${editSched.id}`, payload)
        toast.success('Schedule updated.')
      } else {
        await api.post('/api/schedule', payload)
        toast.success('Schedule created.')
      }
      setConfirmSave(false); setModalOpen(false); fetchSchedules()
    } catch (e: any) {
      setConfirmSave(false)
      // Surfaces the backend's [TimeBefore] validation message too, in case
      // the client-side check above ever drifts from the server-side rule.
      toast.error(extractErrMsg(e, 'Failed to save.'))
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/schedule/${deleteTarget.id}`)
      toast.success('Schedule deleted.')
      setDeleteTarget(null); setDayModal(null); fetchSchedules()
    } catch (e: any) {
      toast.error(`${e.response?.data?.message ?? 'Failed to delete.'}`)
    } finally { setDeleteLoading(false) }
  }

  const isToday = (day: number) => {
    return today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage schedules</h1>
          <p className="text-sm text-gray-500 mt-1">Click any day to view or manage schedules.</p>
        </div>
        <button onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add schedule
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Calendar header */}
        <div className="relative flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="relative">
            <button onClick={() => setPickerOpen(p => !p)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <Calendar className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-bold text-gray-900">{monthName}</h2>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {pickerOpen && (
              <MonthYearPicker
                year={calYear} month={calMonth}
                onChange={(y, m) => { setCalYear(y); setCalMonth(m) }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Status legend */}
        <div className="flex items-center gap-4 px-4 sm:px-6 py-2 border-b border-gray-50 bg-gray-50 flex-wrap">
          {['Open','Full','Completed','Cancelled'].map(s => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className={`w-2 h-2 rounded-full ${statusDot(s)}`} />
              {s}
            </div>
          ))}
        </div>

        {/* Calendar — horizontally scrollable on narrow screens so day cells
            stay wide enough to read the ride-name pills, instead of squishing
            7 columns into a 320px viewport. */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[130px] border-b border-r border-gray-50 bg-gray-50/50" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const daySched = getSchedulesForDay(day)
                  const cellDate = new Date(calYear, calMonth, day)
                  const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())

                  return (
                    <div key={day}
                      onClick={() => setDayModal(cellDate)}
                      className={`min-h-[130px] border-b border-r border-gray-100 p-2 cursor-pointer transition-colors group ${
                        isToday(day) ? 'bg-blue-50/60' : 'hover:bg-emerald-50/40'
                      }`}>
                      {/* Day number */}
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1.5 transition-colors ${
                        isToday(day)
                          ? 'bg-blue-500 text-white'
                          : isPast
                          ? 'text-gray-400 group-hover:bg-gray-100'
                          : 'text-gray-700 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                      }`}>
                        {day}
                      </div>

                      {/* Schedule pills */}
                      <div className="space-y-1">
                        {daySched.slice(0, 3).map(s => (
                          <div key={s.id}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium truncate border ${statusColor(s.status)}`}>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(s.status)}`} />
                            <span className="truncate">{s.rideName}</span>
                          </div>
                        ))}
                        {daySched.length > 3 && (
                          <div className="text-xs text-gray-400 pl-1.5">+{daySched.length - 3} more</div>
                        )}

                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day Detail Modal */}
      {dayModal && (
        <DayModal
          date={dayModal}
          schedules={getSchedulesForDay(dayModal.getDate())}
          onClose={() => setDayModal(null)}
          onEdit={s => openEdit(s)}
          onDelete={s => {
            if (s.status === 'Completed') {
              toast.error('Completed schedules cannot be deleted.')
              return
            }
            // ✅ NEW — mirrors the backend's DeleteAsync: block deletes once
            // the attendant's call time has already passed.
            if (isCallTimePassed(s)) {
              const startedDate = new Date(s.scheduleDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
              toast.error(`This schedule cannot be deleted — call time already passed at ${fmtTime(s.callTime)} on ${startedDate}.`)
              return
            }
            setDeleteTarget(s)
            setDayModal(null)
          }}
        />
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 sticky top-0 bg-white z-10 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editSched ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                  {editSched ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-[15px]">{editSched ? 'Edit schedule' : 'Add new schedule'}</div>
                  <div className="text-[11px] text-gray-400">{editSched ? `Editing: ${editSched.rideName}` : 'Fill in the details below'}</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitClick} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ride <span className="text-red-500">*</span></label>
                <SearchableSelect
                  value={String(form.rideId || '')}
                  onChange={v => setForm({...form, rideId: Number(v) || 0})}
                  placeholder="Select a ride..."
                  options={rides.map(r => ({ value: String(r.id), label: r.name }))}
                />
              </div>
              {/* ✅ NEW — Regular (directly bookable by visitors) vs Promo
                  (reserved for bundling into a Ride Promo). Fully separate
                  pools — a schedule can never be both. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['Regular', 'Promo'] as const).map(t => {
                    const bookedSlots = editSched ? editSched.maxSlots - editSched.availableSlots : 0
                    const locked = editSched != null && bookedSlots > 0 && (editSched.scheduleType ?? 'Regular') !== t
                    return (
                      <button key={t} type="button" disabled={locked}
                        title={locked ? `Can't change type — ${bookedSlots} slot(s) already booked as '${editSched?.scheduleType ?? 'Regular'}'.` : undefined}
                        onClick={() => setForm({ ...form, scheduleType: t })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          form.scheduleType === t
                            ? t === 'Promo' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-teal-600 border-teal-600 text-white'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {t}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {form.scheduleType === 'Promo'
                    ? "Reserved for bundling into a Ride Promo — won't show up for direct visitor booking."
                    : "Directly bookable by visitors on this ride's page."}
                </div>
              </div>
              {/* ✅ NEW — Single date (as before) vs a whole date range,
                  bulk-creating one schedule per day. Create-only — editing
                  always targets one existing schedule. */}
              {!editSched && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule for</label>
                  <div className="flex gap-2">
                    {([['single', 'Single date'], ['range', 'Date range']] as const).map(([m, label]) => (
                      <button key={m} type="button"
                        onClick={() => setForm({ ...form, dateMode: m })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          form.dateMode === m
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {form.dateMode === 'range'
                      ? 'Creates one schedule per day in the range, using the same ride/times/slots below.'
                      : 'Creates a single schedule on one date.'}
                  </div>
                </div>
              )}

              {(editSched || form.dateMode === 'single') ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Attendant <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      value={form.attendantId}
                      onChange={v => setForm({...form, attendantId: v})}
                      placeholder="Select an attendant..."
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...attendants.map(a => ({ value: String(a.id), label: `${a.firstName} ${a.lastName}` }))
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule date <span className="text-red-500">*</span></label>
                    <DatePicker value={form.scheduleDate} onChange={v => setForm({...form, scheduleDate: v})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Start date <span className="text-red-500">*</span></label>
                      <DatePicker value={form.rangeStart} onChange={v => setForm({...form, rangeStart: v})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">End date <span className="text-red-500">*</span></label>
                      <DatePicker value={form.rangeEnd} onChange={v => setForm({...form, rangeEnd: v})} />
                    </div>
                  </div>
                  {form.rangeStart && form.rangeEnd && form.rangeStart > form.rangeEnd && (
                    <div className="text-[11px] text-red-500 font-medium -mt-2">End date must be on or after the start date.</div>
                  )}
                  {rangeDates.length > 0 && (
                    <div className="text-[11px] text-gray-400 -mt-2">{rangeDates.length} day(s) selected.</div>
                  )}

                  {/* ✅ NEW — one attendant for the whole range, or pick a
                      different attendant per day. */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Attendant assignment <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 mb-2">
                      {([['same', 'One attendant for all'], ['different', 'Different per date']] as const).map(([m, label]) => (
                        <button key={m} type="button"
                          onClick={() => setForm({ ...form, attendantMode: m })}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                            form.attendantMode === m
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {form.attendantMode === 'same' ? (
                      <SearchableSelect
                        value={form.attendantId}
                        onChange={v => setForm({...form, attendantId: v})}
                        placeholder="Select an attendant..."
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...attendants.map(a => ({ value: String(a.id), label: `${a.firstName} ${a.lastName}` }))
                        ]}
                      />
                    ) : rangeDates.length === 0 ? (
                      <div className="text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-xl p-3 text-center">
                        Pick a start and end date above to assign an attendant per day.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {rangeDates.map(d => (
                          <div key={d} className="flex items-center gap-2">
                            <div className="w-24 flex-shrink-0 text-xs font-medium text-gray-600">
                              {new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="flex-1">
                              <SearchableSelect
                                value={form.rangeAttendants[d] ?? ''}
                                onChange={v => setForm({...form, rangeAttendants: { ...form.rangeAttendants, [d]: v }})}
                                placeholder="Select an attendant..."
                                options={[
                                  { value: '', label: 'Unassigned' },
                                  ...attendants.map(a => ({ value: String(a.id), label: `${a.firstName} ${a.lastName}` }))
                                ]}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ✅ NEW — Call time: must be strictly earlier than Start time. */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <AlarmClock className="w-3.5 h-3.5 text-red-500" />
                  Call time <span className="text-red-500">*</span>
                </label>
                <TimePicker value={form.callTime} onChange={v => setForm({...form, callTime: v})} accent="red" minTime={minTimeToday} />
                <div className="text-[11px] text-gray-400 mt-1">
                  When the attendant must be ready — must be earlier than the start time below.
                  {scheduleIsToday && (
                    <span className="block text-amber-600 font-medium mt-0.5">
                      Scheduling for today — times before {fmtTime(minTimeToday)} are disabled.
                    </span>
                  )}
                  {form.callTime && form.startTime && form.callTime >= form.startTime && (
                    <span className="block text-red-500 font-medium mt-0.5">
                      Call time must be earlier than {fmtTime(form.startTime)}.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start time <span className="text-red-500">*</span></label>
                  <TimePicker value={form.startTime} onChange={v => setForm({...form, startTime: v})} minTime={minTimeToday} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">End time <span className="text-red-500">*</span></label>
                  {/* ✅ NEW — visually locked: End time is derived from Start
                      time + the ride's own duration, not typed in by hand. */}
                  <div className={selectedRideDuration ? 'pointer-events-none opacity-70' : ''}>
                    <TimePicker value={form.endTime} onChange={v => setForm({...form, endTime: v})} minTime={minTimeToday} />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {selectedRideDuration
                      ? durationWraps
                        ? <span className="text-red-500 font-medium">
                            {selectedRideDuration.name} runs {selectedRideDuration.durationMinutes}m — that would push the end time past midnight. Pick an earlier start time.
                          </span>
                        : `Auto-calculated: ${selectedRideDuration.name} runs ${selectedRideDuration.durationMinutes}m from the start time above.`
                      : 'Select a ride above to auto-calculate this from its duration.'}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max slots <span className="text-red-500">*</span></label>
                <input type="number" required min="1" max="500" value={form.maxSlots}
                  onChange={e => setForm({...form, maxSlots: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                {(() => {
                  const selectedRide = rides.find(r => r.id === Number(form.rideId))
                  const bookedSlots = editSched ? editSched.maxSlots - editSched.availableSlots : 0
                  return (
                    <div className="text-[11px] text-gray-400 mt-1 space-y-0.5">
                      {selectedRide && (
                        <div>Ride capacity: <strong>{selectedRide.maxCapacity}</strong></div>
                      )}
                      {editSched && bookedSlots > 0 && (
                        <div>{bookedSlots} slot(s) already booked — max slots can't go below this.</div>
                      )}
                    </div>
                  )
                })()}
              </div>
              {editSched && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    {['Open','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editSched ? 'Save changes' : !editSched && form.dateMode === 'range' && rangeDates.length > 0 ? `Create ${rangeDates.length} schedule${rangeDates.length === 1 ? '' : 's'}` : 'Create schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Save */}
      {confirmSave && (
        <ConfirmModal
          title={editSched ? 'Save changes?' : form.dateMode === 'range' ? `Create ${rangeDates.length} schedules?` : 'Create schedule?'}
          message={
            !editSched && form.dateMode === 'range'
              ? `Create ${rangeDates.length} schedule(s) for ${rides.find(r => r.id === Number(form.rideId))?.name ?? 'this ride'}, one per day from ${form.rangeStart} to ${form.rangeEnd}?`
              : `${editSched ? 'Update' : 'Create'} schedule for ${rides.find(r => r.id === Number(form.rideId))?.name ?? 'this ride'} on ${form.scheduleDate}?`
          }
          confirmLabel={editSched ? 'Yes, save' : 'Yes, create'}
          onConfirm={doSave}
          onCancel={() => setConfirmSave(false)}
          loading={saving}
        />
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete schedule?"
          message={`Delete "${deleteTarget.rideName}" schedule? This cannot be undone.`}
          confirmLabel="Yes, delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
