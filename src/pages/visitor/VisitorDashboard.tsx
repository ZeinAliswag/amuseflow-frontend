import { useEffect, useState, useRef } from 'react'
import {
  Ticket, CheckCircle2, Clock, XCircle,
  Users, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Search, MapPin, ZoomIn, X, Loader2, ArrowLeft,
  UserCog, CalendarDays, AlarmClock,
  FerrisWheel, Tag, PackageCheck, Star
} from 'lucide-react'
import type { Booking, Ride, RidePromo, PromoRideItem, PaginationRequest } from '../../types'
import api, { promoApi, bookingApi, reviewApi } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
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
// ✅ CHANGED — added year so a filtered date range in a different year (e.g.
// picking a past/future year in the calendar) doesn't render ambiguously as
// just "Jan 9 – Jan 10" with no indication of which year.
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
const fmtLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
// ✅ CHANGED — a same-year range only needs the year once, at the end
// ("Jan 9 – Jan 10, 1974"); a range spanning two different years needs it on
// both ends ("Jan 9, 1974 – Jan 10, 1978") so it isn't ambiguous.
function fmtRange(from: string, to: string, sep = ' – ') {
  if (from === to) return fmtLong(from)
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${fmtShort(from)}${sep}${fmtLong(to)}`
    : `${fmtLong(from)}${sep}${fmtLong(to)}`
}

// ── Schedule type ─────────────────────────────────────────────
interface Schedule {
  id: number; rideId: number; rideName: string
  scheduleDate: string; callTime?: string; startTime: string; endTime: string
  availableSlots: number; maxSlots: number; status: string
  attendantName?: string
  scheduleType?: string  // ✅ NEW — 'Regular' | 'Promo', fully separate pools
}

// ── Confirm Modal ──────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

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

// ✅ NEW — read-only star row, used to show a rating that's already been
// submitted (e.g. "You rated this ride"). Half-star-free — ratings are
// always a whole 1-5 integer.
function StarRatingDisplay({ rating, size = 'w-3.5 h-3.5' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${size} ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  )
}

// ✅ NEW — an OPTIONAL rating (1-5) + comment left on a completed + paid
// ride booking. Never required — the visitor can always just close this
// without submitting anything.
function ReviewModal({ rideName, onSubmit, onCancel, loading }: {
  rideName: string
  onSubmit: (rating: number, comment: string) => void
  onCancel: () => void
  loading?: boolean
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-600">
          <Star className="w-6 h-6" />
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">Rate "{rideName}"</div>
        <div className="text-[12px] text-gray-500 mb-4">
          Totally optional — leave a rating and/or a quick comment, or just close this.
        </div>

        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star className={`w-7 h-7 transition-colors ${
                n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
              }`} />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Anything you'd like to add? (optional)"
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
        />

        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Not now
          </button>
          <button
            onClick={() => onSubmit(rating, comment.trim())}
            disabled={loading || rating === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors bg-amber-500 hover:bg-amber-600 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ✅ CHANGED — one ticket per booking (1:1): a single booking is exactly one
// guest/seat, collecting a name (and, when the ride has a restriction,
// birthdate/height/weight). Booking for someone else (e.g. your father) is
// its own separate booking — its own code, its own payment — not a second
// seat bundled under your booking.
// ✅ CHANGED — birthdate is now typed as three plain number fields
// (month/day/year) instead of picked from a calendar popover — much faster
// for a birthdate that could be decades in the past.
type GuestRow = { name: string; birthMonth: string; birthDay: string; birthYear: string; height: string; weight: string }

// Whether `year` is a leap year (Feb has 29 days instead of 28).
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// The real number of days in a given month/year — used to reject
// impossible calendar dates (September 31, February 30, February 29 outside
// a leap year) instead of the generic "1-31" range check that let them
// through and silently rolled over to the next month.
function daysInMonth(month: number, year: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1]
}

// Builds an ISO date string ("1990-05-14") from a guest row's typed
// month/day/year fields, or '' if any part is missing/invalid — including
// a day that doesn't actually exist in that month (e.g. "09/31/1990" or
// "02/29/2021" outside a leap year).
function birthDateISO(row: GuestRow): string {
  const m = parseInt(row.birthMonth)
  const d = parseInt(row.birthDay)
  const y = parseInt(row.birthYear)
  if (!m || m < 1 || m > 12 || !d || d < 1 || !y || y < 1900) return ''
  if (d > daysInMonth(m, y)) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ✅ NEW — prevents an impossible day from ever sitting in the field in the
// first place (e.g. typing 31 while September is selected, or picking
// September while 31 is already typed), instead of only catching it after
// the fact via birthDateISO's validation. Takes the row's CURRENT values
// plus whatever's about to change, and — if the resulting day doesn't exist
// in that month/year — silently caps the day down to that month's last
// valid day. Uses a leap year (2000) as a lenient placeholder for Feb 29
// until the year field is actually typed.
function clampBirthDay(row: GuestRow, patch: Partial<GuestRow>): Partial<GuestRow> {
  const merged = { ...row, ...patch }
  const m = parseInt(merged.birthMonth)
  const d = parseInt(merged.birthDay)
  const y = parseInt(merged.birthYear)
  if (m >= 1 && m <= 12 && d >= 1) {
    const max = daysInMonth(m, isNaN(y) ? 2000 : y)
    if (d > max) return { ...patch, birthDay: String(max) }
  }
  return patch
}

// Computes a whole-years age from a birthdate ("1990-05-14"), as of today.
function calcAge(birthDate: string): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return null
  const today = new Date()
  if (b > today) return null
  let age = today.getFullYear() - b.getFullYear()
  const beforeBirthdayThisYear =
    today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())
  if (beforeBirthdayThisYear) age--
  return age >= 0 ? age : null
}

// ✅ NEW — Ride Promo group bookings: a guest must qualify for EVERY ride
// bundled in the promo. Combines each ride's own min/max into the
// INTERSECTION of all of them (the strictest min, the strictest max) —
// satisfying the combined range guarantees satisfying every individual
// ride's restriction too, so the guest modal can show/validate one range
// per restriction type instead of one per ride.
function combinePromoRange(rides: PromoRideItem[], minKey: 'minHeightCm'|'minAgeYears'|'minWeightKg', maxKey: 'maxHeightCm'|'maxAgeYears'|'maxWeightKg') {
  const mins = rides.map(r => r[minKey]).filter((v): v is number => v != null)
  const maxs = rides.map(r => r[maxKey]).filter((v): v is number => v != null)
  return {
    min: mins.length ? Math.max(...mins) : undefined,
    max: maxs.length ? Math.min(...maxs) : undefined,
  }
}

function GuestBookingModal({
  rideName, date, time, price,
  minHeightCm, maxHeightCm, minAgeYears, maxAgeYears, minWeightKg, maxWeightKg, defaultName,
  onConfirm, onCancel, loading
}: {
  rideName: string; date: string; time: string; price: number
  minHeightCm?: number; maxHeightCm?: number; minAgeYears?: number; maxAgeYears?: number
  minWeightKg?: number; maxWeightKg?: number; defaultName: string
  onConfirm: (guests: { guestName: string; ageYears?: number; heightCm?: number; weightKg?: number }[]) => void
  onCancel: () => void; loading?: boolean
}) {
  const hasHeightRestriction = minHeightCm != null || maxHeightCm != null
  const hasAgeRestriction = minAgeYears != null || maxAgeYears != null
  const hasWeightRestriction = minWeightKg != null || maxWeightKg != null
  const hasRestriction = hasHeightRestriction || hasAgeRestriction || hasWeightRestriction

  // ✅ CHANGED — one ticket per booking (1:1), no more group/guest-list UI.
  // A single guest form, same shape/fields as before, just without the
  // add/remove-guest scaffolding.
  const [guest, setGuest] = useState<GuestRow>({ name: defaultName, birthMonth: '', birthDay: '', birthYear: '', height: '', weight: '' })
  const updateGuest = (patch: Partial<GuestRow>) => setGuest(g => ({ ...g, ...patch }))
  // ✅ NEW — routes every birthdate field change through clampBirthDay so an
  // impossible day (Sept 31, Feb 30, Feb 29 outside a leap year) can never
  // sit in the field — it's capped down automatically instead of only
  // failing validation after the fact.
  const updateBirthdate = (patch: Partial<GuestRow>) => updateGuest(clampBirthDay(guest, patch))
  const maxBirthDay = (() => {
    const m = parseInt(guest.birthMonth)
    const y = parseInt(guest.birthYear)
    return m >= 1 && m <= 12 ? daysInMonth(m, isNaN(y) ? 2000 : y) : 31
  })()

  const heightRangeLabel = minHeightCm != null && maxHeightCm != null
    ? `${minHeightCm}-${maxHeightCm}cm` : minHeightCm != null ? `min ${minHeightCm}cm` : `max ${maxHeightCm}cm`
  const ageRangeLabel = minAgeYears != null && maxAgeYears != null
    ? `${minAgeYears}-${maxAgeYears}y` : minAgeYears != null ? `min ${minAgeYears}y` : `max ${maxAgeYears}y`
  const weightRangeLabel = minWeightKg != null && maxWeightKg != null
    ? `${minWeightKg}-${maxWeightKg}kg` : minWeightKg != null ? `min ${minWeightKg}kg` : `max ${maxWeightKg}kg`

  const guestFails = (row: GuestRow): string[] => {
    const fails: string[] = []
    if (hasHeightRestriction) {
      const h = parseInt(row.height)
      if (!row.height || isNaN(h)) fails.push(heightRangeLabel)
      else if ((minHeightCm != null && h < minHeightCm) || (maxHeightCm != null && h > maxHeightCm)) fails.push(heightRangeLabel)
    }
    if (hasAgeRestriction) {
      const age = calcAge(birthDateISO(row))
      if (age == null) fails.push(ageRangeLabel)
      else if ((minAgeYears != null && age < minAgeYears) || (maxAgeYears != null && age > maxAgeYears)) fails.push(ageRangeLabel)
    }
    if (hasWeightRestriction) {
      const w = parseInt(row.weight)
      if (!row.weight || isNaN(w)) fails.push(weightRangeLabel)
      else if ((minWeightKg != null && w < minWeightKg) || (maxWeightKg != null && w > maxWeightKg)) fails.push(weightRangeLabel)
    }
    return fails
  }

  const fails = guestFails(guest)
  const age = calcAge(birthDateISO(guest))
  const birthdateTyped = guest.birthMonth || guest.birthDay || guest.birthYear
  const canSubmit = guest.name.trim().length > 0 && (!hasRestriction || fails.length === 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">Book "{rideName}"?</div>
        <div className="text-[12px] text-gray-500 mb-4">
          {new Date(date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {fmtTime(time)}
          {hasRestriction && (
            <span className="block mt-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              This ride requires you to be{' '}
              {[hasHeightRestriction ? `${heightRangeLabel.replace('cm', ' cm tall').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null,
                hasAgeRestriction ? `${ageRangeLabel.replace('y', ' years old').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null,
                hasWeightRestriction ? `${weightRangeLabel.replace('kg', 'kg').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null]
                .filter(Boolean).join(' and ')}.
            </span>
          )}
        </div>

        <div className="mb-3">
          <div className="border border-gray-200 rounded-xl p-3">
            <input
              value={guest.name}
              onChange={e => updateGuest({ name: e.target.value })}
              placeholder="Guest name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <div className="grid grid-cols-2 gap-2">
              {hasHeightRestriction && (
                <input type="number" min="0" value={guest.height}
                  onChange={e => updateGuest({ height: e.target.value })}
                  placeholder="Height (cm)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              )}
              {/* ✅ CHANGED — weight is always collected (like name), not
                  just when the ride restricts it. Validation still only
                  kicks in if the ride actually has a Min/Max Weight configured. */}
              <input type="number" min="0" value={guest.weight}
                onChange={e => updateGuest({ weight: e.target.value })}
                placeholder="Weight (kg)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              {hasAgeRestriction && (
                <div className="col-span-2">
                  {/* ✅ CHANGED — birthdate is typed as plain MM/DD/YYYY
                      number fields instead of picked from a calendar, and
                      validated against real days-per-month (e.g. no Sept 31,
                      no Feb 29 outside a leap year) — see birthDateISO. */}
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min="1" max="12" placeholder="MM" value={guest.birthMonth}
                      onChange={e => updateBirthdate({ birthMonth: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                    <input type="number" min="1" max={maxBirthDay} placeholder="DD" value={guest.birthDay}
                      onChange={e => updateBirthdate({ birthDay: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                    <input type="number" min="1900" max={new Date().getFullYear()} placeholder="YYYY" value={guest.birthYear}
                      onChange={e => updateBirthdate({ birthYear: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Birthdate (month / day / year)
                    {birthdateTyped ? ` — ${age != null ? `${age} years old` : 'invalid date'}` : ''}
                  </div>
                </div>
              )}
            </div>
            {fails.length > 0 && (
              <div className="text-[11px] text-red-600 mt-1.5">Doesn't meet requirement: {fails.join(', ')}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Total</span>
          <span className="font-bold text-emerald-600 text-sm">₱{fmt(price)}</span>
        </div>

        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm([{
              guestName: guest.name.trim(),
              ageYears: calcAge(birthDateISO(guest)) ?? undefined,
              heightCm: guest.height ? parseInt(guest.height) : undefined,
              weightKg: guest.weight ? parseInt(guest.weight) : undefined,
            }])}
            disabled={loading || !canSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ✅ NEW — Ride Promo equivalent of GuestBookingModal. Same guest-list
// collection/validation, but the height/age/weight range shown/checked is
// the combined intersection across every ride bundled in the promo (see
// combinePromoRange above) — a guest must qualify for all of them, using
// each included ride's own restrictions (set on Admin Rides), not a
// separate promo-level setting.
function PromoGuestBookingModal({
  promoName, rideCount, price,
  minHeightCm, maxHeightCm, minAgeYears, maxAgeYears, minWeightKg, maxWeightKg, defaultName,
  onConfirm, onCancel, loading
}: {
  promoName: string; rideCount: number; price: number
  minHeightCm?: number; maxHeightCm?: number; minAgeYears?: number; maxAgeYears?: number
  minWeightKg?: number; maxWeightKg?: number; defaultName: string
  onConfirm: (guests: { guestName: string; ageYears?: number; heightCm?: number; weightKg?: number }[]) => void
  onCancel: () => void; loading?: boolean
}) {
  const hasHeightRestriction = minHeightCm != null || maxHeightCm != null
  const hasAgeRestriction = minAgeYears != null || maxAgeYears != null
  const hasWeightRestriction = minWeightKg != null || maxWeightKg != null
  const hasRestriction = hasHeightRestriction || hasAgeRestriction || hasWeightRestriction

  // ✅ CHANGED — one ticket per booking (1:1): a single-guest form, same as
  // GuestBookingModal, no more multi-guest add/remove UI. Booking your
  // father under his own name/age/height is simply a separate booking with
  // its own code and its own payment, not a second seat tacked onto yours.
  const [guest, setGuest] = useState<GuestRow>({ name: defaultName, birthMonth: '', birthDay: '', birthYear: '', height: '', weight: '' })
  const updateGuest = (patch: Partial<GuestRow>) => setGuest(g => ({ ...g, ...patch }))
  // ✅ NEW — routes every birthdate field change through clampBirthDay so an
  // impossible day (Sept 31, Feb 30, Feb 29 outside a leap year) can never
  // sit in the field — it's capped down automatically instead of only
  // failing validation after the fact.
  const updateBirthdate = (patch: Partial<GuestRow>) => updateGuest(clampBirthDay(guest, patch))
  const maxBirthDay = (() => {
    const m = parseInt(guest.birthMonth)
    const y = parseInt(guest.birthYear)
    return m >= 1 && m <= 12 ? daysInMonth(m, isNaN(y) ? 2000 : y) : 31
  })()

  const heightRangeLabel = minHeightCm != null && maxHeightCm != null
    ? `${minHeightCm}-${maxHeightCm}cm` : minHeightCm != null ? `min ${minHeightCm}cm` : `max ${maxHeightCm}cm`
  const ageRangeLabel = minAgeYears != null && maxAgeYears != null
    ? `${minAgeYears}-${maxAgeYears}y` : minAgeYears != null ? `min ${minAgeYears}y` : `max ${maxAgeYears}y`
  const weightRangeLabel = minWeightKg != null && maxWeightKg != null
    ? `${minWeightKg}-${maxWeightKg}kg` : minWeightKg != null ? `min ${minWeightKg}kg` : `max ${maxWeightKg}kg`

  const guestFails = (row: GuestRow): string[] => {
    const fails: string[] = []
    if (hasHeightRestriction) {
      const h = parseInt(row.height)
      if (!row.height || isNaN(h)) fails.push(heightRangeLabel)
      else if ((minHeightCm != null && h < minHeightCm) || (maxHeightCm != null && h > maxHeightCm)) fails.push(heightRangeLabel)
    }
    if (hasAgeRestriction) {
      const age = calcAge(birthDateISO(row))
      if (age == null) fails.push(ageRangeLabel)
      else if ((minAgeYears != null && age < minAgeYears) || (maxAgeYears != null && age > maxAgeYears)) fails.push(ageRangeLabel)
    }
    if (hasWeightRestriction) {
      const w = parseInt(row.weight)
      if (!row.weight || isNaN(w)) fails.push(weightRangeLabel)
      else if ((minWeightKg != null && w < minWeightKg) || (maxWeightKg != null && w > maxWeightKg)) fails.push(weightRangeLabel)
    }
    return fails
  }

  const fails = guestFails(guest)
  const age = calcAge(birthDateISO(guest))
  const birthdateTyped = guest.birthMonth || guest.birthDay || guest.birthYear
  const canSubmit = guest.name.trim().length > 0 && (!hasRestriction || fails.length === 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-pink-100 text-pink-600">
          <PackageCheck className="w-6 h-6" />
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">Book promo "{promoName}"?</div>
        <div className="text-[12px] text-gray-500 mb-4">
          Covering {rideCount} rides as one booking.
          {hasRestriction && (
            <span className="block mt-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              Every ride in this promo requires you to be{' '}
              {[hasHeightRestriction ? `${heightRangeLabel.replace('cm', ' cm tall').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null,
                hasAgeRestriction ? `${ageRangeLabel.replace('y', ' years old').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null,
                hasWeightRestriction ? `${weightRangeLabel.replace('kg', 'kg').replace('-', ' to ').replace('min ', 'at least ').replace('max ', 'at most ')}` : null]
                .filter(Boolean).join(' and ')}.
            </span>
          )}
        </div>

        <div className="mb-3">
          <div className="border border-gray-200 rounded-xl p-3">
            <input
              value={guest.name}
              onChange={e => updateGuest({ name: e.target.value })}
              placeholder="Guest name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <div className="grid grid-cols-2 gap-2">
              {hasHeightRestriction && (
                <input type="number" min="0" value={guest.height}
                  onChange={e => updateGuest({ height: e.target.value })}
                  placeholder="Height (cm)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              )}
              <input type="number" min="0" value={guest.weight}
                onChange={e => updateGuest({ weight: e.target.value })}
                placeholder="Weight (kg)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              {hasAgeRestriction && (
                <div className="col-span-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min="1" max="12" placeholder="MM" value={guest.birthMonth}
                      onChange={e => updateBirthdate({ birthMonth: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    <input type="number" min="1" max={maxBirthDay} placeholder="DD" value={guest.birthDay}
                      onChange={e => updateBirthdate({ birthDay: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    <input type="number" min="1900" max={new Date().getFullYear()} placeholder="YYYY" value={guest.birthYear}
                      onChange={e => updateBirthdate({ birthYear: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-300" />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Birthdate (month / day / year)
                    {birthdateTyped ? ` — ${age != null ? `${age} years old` : 'invalid date'}` : ''}
                  </div>
                </div>
              )}
            </div>
            {fails.length > 0 && (
              <div className="text-[11px] text-red-600 mt-1.5">Doesn't meet requirement: {fails.join(', ')}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Total</span>
          <span className="font-bold text-pink-600 text-sm">₱{fmt(price)}</span>
        </div>

        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm([{
              guestName: guest.name.trim(),
              ageYears: calcAge(birthDateISO(guest)) ?? undefined,
              heightCm: guest.height ? parseInt(guest.height) : undefined,
              weightKg: guest.weight ? parseInt(guest.weight) : undefined,
            }])}
            disabled={loading || !canSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors bg-pink-600 hover:bg-pink-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm booking'}
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

// ── Month/Year dropdown for the mini calendar below — jump straight to any
// month or year, matching the pattern used elsewhere in the app. ──
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
                    ? 'bg-slate-700 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-slate-50 text-slate-700 border border-slate-200'
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

// ── Mini calendar grid — replaces plain native <input type="date"> fields
// (which pop the browser's own mismatched-looking date picker) with a
// custom-styled range picker matching the rest of the app. ──
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
                    ? 'bg-slate-700 text-white font-bold shadow-sm'
                    : inRange
                    ? 'bg-slate-100 text-slate-700 font-medium'
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
      ? fmtRange(from, to)
      : from ? `From ${fmtLong(from)}` : `Until ${fmtLong(to)}`

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

  // ref used to scroll down to the bookings section
  const bookingsSectionRef = useRef<HTMLDivElement>(null)

  // booking filters
  const [bookSearch, setBookSearch]   = useState('')
  const [bookDateFrom, setBookDateFrom] = useState('')
  const [bookDateTo, setBookDateTo]     = useState('')
  const [bookDateModalOpen, setBookDateModalOpen] = useState(false)

  // modals
  const [zoomSrc, setZoomSrc]           = useState<string|null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking|null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  // ✅ NEW — OPTIONAL rating/comment on a completed + paid booking.
  const [reviewTarget, setReviewTarget] = useState<Booking|null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  // ✅ CHANGED — group bookings: bookTarget now also carries whatever's
  // needed to render the guest-list step (how many seats are left, and
  // whether this ride has a height/age restriction to collect/validate per guest).
  const [bookTarget, setBookTarget]     = useState<{
    scheduleId:number; rideName:string; date:string; time:string; price:number
    availableSlots:number; minHeightCm?:number; maxHeightCm?:number
    minAgeYears?:number; maxAgeYears?:number
    minWeightKg?:number; maxWeightKg?:number
  }|null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => { fetchRides() }, [rideParams])
  // ✅ FIXED — fetchBookings used to only run once on mount/filter-change,
  // so booking status changes went stale the moment you landed on the
  // dashboard — a booking approved by an admin 5 minutes into your session
  // wouldn't show up until you changed a filter or re-logged in. Now it also
  // re-polls every 5s, same pattern as the Admin sidebar's pending-bookings
  // badge (AdminLayout.tsx). (The old local "unseen" bell badge that lived
  // in the hero was removed — real-time notifications now live in the
  // header bell.)
  useEffect(() => {
    fetchBookings()
    const interval = setInterval(fetchBookings, 5_000)
    return () => clearInterval(interval)
  }, [bookParams, bookSearch, bookDateFrom, bookDateTo])
  useEffect(() => { fetchPromos() }, [])

  const fetchPromos = async () => {
    setPromoLoading(true)
    try {
      const res = await promoApi.getAll({ page: 1, pageSize: 50 })
      const d = (res.data as any)?.data?.data ?? (res.data as any)?.data ?? res.data ?? []
      const list: RidePromo[] = Array.isArray(d) ? d : []
      // ✅ CHANGED — only show promos that are still bookable (strictly
      // future date). Expired ones (today or earlier) are hidden entirely
      // instead of showing as a grayed-out "Unavailable" card.
      setPromos(list.filter(p => !p.isDeleted && promoIsAvailable(p)))
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load promos.')) }
    finally { setPromoLoading(false) }
  }

  // ✅ CHANGED — a promo is only bookable while its date is strictly in the
  // future. Today's date (and anything earlier) now counts as expired, so
  // it no longer shows up in the list at all (see fetchPromos above).
  const promoIsAvailable = (promo: RidePromo) => {
    const today = toISO(new Date())
    return today < promo.promoDate.slice(0, 10)
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

  // ✅ CHANGED — group bookings: now takes the guest list collected in
  // PromoGuestBookingModal and posts it alongside promoId, instead of a
  // bare { promoId }.
  const doBookPromo = async (guests: { guestName:string; ageYears?:number; heightCm?:number; weightKg?:number }[]) => {
    if (!promoBookTarget) return
    setPromoBookingLoading(true)
    try {
      await bookingApi.bookPromo({ promoId: promoBookTarget.id, guests })
      toast.success(`Booked promo "${promoBookTarget.name}" for ${guests.length} guest(s)!`)
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
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load bookings.')) }
    finally { setBookLoading(false) }
  }

  // ✅ CHANGED — group bookings: now takes the guest list collected in
  // GuestBookingModal and posts it alongside the scheduleId, instead of a
  // bare { scheduleId }.
  const doBook = async (guests: { guestName:string; ageYears?:number; heightCm?:number }[]) => {
    if (!bookTarget) return
    setBookingLoading(true)
    try {
      await api.post('/api/booking', { scheduleId: bookTarget.scheduleId, guests })
      toast.success(`Booked "${bookTarget.rideName}" on ${bookTarget.date} for ${guests.length} guest(s)!`)
      setBookTarget(null)
      setSelectedRide(null)
      fetchBookings()
      fetchRides()
    } catch (e: any) {
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

  // ✅ NEW — OPTIONAL rating/comment on a completed + paid booking. Never
  // required — ReviewModal's "Not now" just closes this with no request sent.
  const doSubmitReview = async (rating: number, comment: string) => {
    if (!reviewTarget) return
    setReviewLoading(true)
    try {
      await reviewApi.create({ bookingId: reviewTarget.id, rating, comment: comment || undefined })
      toast.success('Thanks for your review!')
      setReviewTarget(null)
      fetchBookings()
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to submit review.'))
    } finally { setReviewLoading(false) }
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
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4 className="font-bold text-gray-900 text-base truncate">{ride.name}</h4>
                          {/* ✅ NEW — average rating from every OPTIONAL review
                              left on a completed + paid booking for this ride. */}
                          {ride.reviewCount > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 flex-shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {ride.averageRating.toFixed(1)}
                            </span>
                          )}
                        </div>
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
                        price: selectedRide.price,
                        availableSlots: s.availableSlots,
                        minHeightCm: selectedRide.minHeightCm,
                        maxHeightCm: selectedRide.maxHeightCm,
                        minAgeYears: selectedRide.minAgeYears,
                        maxAgeYears: selectedRide.maxAgeYears,
                        minWeightKg: selectedRide.minWeightKg,
                        maxWeightKg: selectedRide.maxWeightKg
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
                          <div className="flex items-center gap-1.5 mb-1">
                            <h4 className="font-bold text-gray-900 text-base truncate">{promo.name}</h4>
                            {/* ✅ NEW — average rating from every OPTIONAL review
                                left on a completed + paid promo booking (one
                                review per promo booking, not per included ride). */}
                            {promo.reviewCount > 0 && (
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 flex-shrink-0">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                {promo.averageRating.toFixed(1)}
                              </span>
                            )}
                          </div>
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
                <div key={b.id} className="flex flex-col px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
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
                      {/* ✅ FIXED — regular bookings: paymentAmount stays 0
                          until an attendant actually collects it, so the
                          ride's fixed price (ridePrice) is the "actual
                          price" to show. Promo bookings have no separate
                          price field, but their paymentAmount IS set to the
                          promo price at booking time, so it's still correct
                          there — hence the fallback. */}
                      <div className="font-bold text-gray-900 text-sm">₱{fmt(b.ridePrice ?? b.paymentAmount)}</div>
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
                  {/* ✅ CHANGED — an OPTIONAL rating on a completed + paid
                      booking, regular ride OR Ride Promo alike. A promo
                      booking gets exactly ONE review for the whole bundle
                      (not one per included ride) — the backend leaves that
                      review's RideId null so it never counts toward any
                      single ride's average rating. Sits on its own
                      full-width row below the main booking info (outside the
                      sm:flex-row wrapper above), so it never gets squeezed
                      onto the price/paid-date line. Shows the submitted
                      rating once left; otherwise a prominent, clickable
                      prompt to leave one. */}
                  {b.status === 'Completed' && b.paymentStatus === 'Paid' && (
                    b.review ? (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 flex-shrink-0">
                          <StarRatingDisplay rating={b.review.rating} />
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {b.promoId ? 'You rated this promo' : 'You rated this ride'}
                        </span>
                        {b.review.comment && (
                          <span className="text-[11px] text-gray-400 truncate italic">— "{b.review.comment}"</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => setReviewTarget(b)}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold transition-all shadow-sm">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          Leave a review
                          <span className="text-amber-500 font-normal">(optional)</span>
                        </button>
                      </div>
                    )
                  )}
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
      {/* ✅ CHANGED — one ticket per booking (1:1): a single-guest modal
          that collects a name (and age/height/weight, when the ride has a
          restriction), no more multi-guest add/remove UI. */}
      {bookTarget && (
        <GuestBookingModal
          rideName={bookTarget.rideName}
          date={bookTarget.date}
          time={bookTarget.time}
          price={bookTarget.price}
          minHeightCm={bookTarget.minHeightCm}
          maxHeightCm={bookTarget.maxHeightCm}
          minAgeYears={bookTarget.minAgeYears}
          maxAgeYears={bookTarget.maxAgeYears}
          minWeightKg={bookTarget.minWeightKg}
          maxWeightKg={bookTarget.maxWeightKg}
          defaultName={user?.fullName ?? 'Guest'}
          onConfirm={doBook}
          onCancel={() => setBookTarget(null)}
          loading={bookingLoading}
        />
      )}

      {/* Confirm Book Promo */}
      {/* ✅ CHANGED — one ticket per booking (1:1): a single-guest modal
          (like GuestBookingModal) that validates the guest against the
          combined intersection of EVERY included ride's height/age/weight
          restrictions. No more multi-guest add/remove UI. */}
      {promoBookTarget && (() => {
        const heightRange = combinePromoRange(promoBookTarget.rides, 'minHeightCm', 'maxHeightCm')
        const ageRange = combinePromoRange(promoBookTarget.rides, 'minAgeYears', 'maxAgeYears')
        const weightRange = combinePromoRange(promoBookTarget.rides, 'minWeightKg', 'maxWeightKg')
        return (
          <PromoGuestBookingModal
            promoName={promoBookTarget.name}
            rideCount={promoBookTarget.rides.length}
            price={promoBookTarget.price}
            minHeightCm={heightRange.min} maxHeightCm={heightRange.max}
            minAgeYears={ageRange.min} maxAgeYears={ageRange.max}
            minWeightKg={weightRange.min} maxWeightKg={weightRange.max}
            defaultName={user?.fullName ?? 'Guest'}
            onConfirm={doBookPromo}
            onCancel={() => setPromoBookTarget(null)}
            loading={promoBookingLoading}
          />
        )
      })()}

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

      {/* Leave a review — OPTIONAL, never blocks anything */}
      {reviewTarget && (
        <ReviewModal
          rideName={reviewTarget.promoId ? (reviewTarget.promoName ?? 'this promo') : (reviewTarget.rideName ?? 'this ride')}
          onSubmit={doSubmitReview}
          onCancel={() => setReviewTarget(null)}
          loading={reviewLoading}
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
