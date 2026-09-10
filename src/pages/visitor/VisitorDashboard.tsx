import { useEffect, useState, useRef } from 'react'
import {
  Ticket, CheckCircle2, Clock, XCircle,
  Users, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Search, MapPin, ZoomIn, X, Loader2, ArrowLeft,
  UserCog, AlarmClock,
  FerrisWheel, Tag, PackageCheck, Star, Ruler, Cake, Weight,
  Filter, Banknote, SortAsc, SortDesc, Type, Maximize2, LayoutGrid,
  Baby, Backpack, Briefcase
} from 'lucide-react'
import type { Ride, RidePromo, PromoRideItem, PaginationRequest, RideValidationSettings } from '../../types'
import api, { promoApi, bookingApi, settingsApi } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const fmt = (n: any) => Number(n ?? 0).toFixed(2)

// ✅ NEW — Kid → Baby, Teen → Backpack, Adult → Briefcase, matching the
// icons Admin > Attractions and Admin > Settings > Rider Categories use for
// the same categories, so a visitor sees the same visual language.
function categoryChipIcon(name: string) {
  return name === 'Kid' ? Baby : name === 'Teen' ? Backpack : Briefcase
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

// Used by promoIsAvailable below (a promo is bookable only strictly before
// its date) — the fuller fmtShort/fmtLong/fmtRange date-range formatters
// used to live here too, but moved to MyBookings.tsx along with the
// booking-list date-range filter that was their only caller.
const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
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

// ── Call time badge — styled like a notification chip (pill background +
// border) instead of plain colored text, so it actually draws the eye. ──
function CallTimeBadge({ time, className = '', label = 'Call time' }: { time?: string; className?: string; label?: string }) {
  if (!time) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-semibold shadow-sm ${className}`}>
      <AlarmClock className="w-3.5 h-3.5" />
      {label}: {fmtTime(time)}
    </span>
  )
}

// ✅ NEW — pressing a "Bundle · N attractions" pill anywhere (bundle
// browsing card, My Bookings row) pops this up instead of navigating away,
// matching the same quick-preview modal already used on Admin Promos.tsx.
// Used for BROWSING a bundle — rides still have slots/status since nothing
// is booked yet.
// ✅ NEW — client-side pagination once a bundle has more than 3 rides, so
// the modal doesn't turn into one long scroll for big bundles.
const RIDES_MODAL_PAGE_SIZE = 3

function PromoRidesModal({ promo, onClose }: { promo: RidePromo; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(promo.rides.length / RIDES_MODAL_PAGE_SIZE))
  const pageRides = promo.rides.slice((page - 1) * RIDES_MODAL_PAGE_SIZE, page * RIDES_MODAL_PAGE_SIZE)

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm truncate">{promo.name}</div>
            <div className="text-xs text-gray-400">{promo.rides.length} attractions included · {promo.promoDate.slice(0, 10)}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {pageRides.map(r => {
            const full = r.availableSlots <= 0 || r.scheduleStatus === 'Cancelled'
            return (
              <div key={r.rideId} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-gray-900 text-sm">{r.rideName}</div>
                  <Badge label={full ? 'Full' : 'Available'} />
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
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          {promo.rides.length > RIDES_MODAL_PAGE_SIZE ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : <div />}
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rides / Promos switch — promoted to a real top-level tab bar that
// always sits in the exact same physical spot (top of the card, above the
// title + filters), instead of living inside the filter row where its
// position depended on how many sort/search controls were next to it.
// Underline-indicator style (Stripe/Linear-style tabs) reads as primary
// navigation rather than "just another filter chip", and gives a bigger,
// more obviously-tappable target on mobile. ──
function ViewToggle({ value, onChange }: { value: 'rides' | 'promos'; onChange: (v: 'rides' | 'promos') => void }) {
  return (
    <div className="flex items-center gap-1 px-4 sm:px-5 border-b border-gray-100 bg-gray-50/60">
      <button type="button" onClick={() => onChange('rides')}
        className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors active:scale-95 ${
          value === 'rides' ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600'
        }`}>
        <FerrisWheel className="w-4 h-4" /> Attractions
        {value === 'rides' && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />}
      </button>
      <button type="button" onClick={() => onChange('promos')}
        className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors active:scale-95 ${
          value === 'promos' ? 'text-pink-700' : 'text-gray-400 hover:text-gray-600'
        }`}>
        <Tag className="w-4 h-4" /> Bundles
        {value === 'promos' && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-pink-500" />}
      </button>
    </div>
  )
}

// ── Sort options — Price and Rating only (the two things a visitor
// actually cares about when comparing attractions), same combobox look as
// Admin's Rides.tsx. Direction defaults to Ascending since that's the
// common case here (cheapest / lowest-rated first when actively sorting). ──
const RIDE_SORT_BY_OPTS = [
  { value: '',            label: 'Sort by default', icon: <Filter className="w-3.5 h-3.5 text-gray-400" /> },
  { value: 'Name',        label: 'Name',            icon: <Type className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Price',       label: 'Price',           icon: <Banknote className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'MaxCapacity', label: 'Capacity',        icon: <Maximize2 className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Rating',      label: 'Rating',          icon: <Star className="w-3.5 h-3.5 text-gray-500" /> },
]

const RIDE_SORT_DIR_OPTS = [
  { value: 'ASC',  label: 'Ascending',  icon: <SortAsc className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'DESC', label: 'Descending', icon: <SortDesc className="w-3.5 h-3.5 text-gray-500" /> },
]

function RideSortByCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = RIDE_SORT_BY_OPTS.find(o => o.value === value) ?? RIDE_SORT_BY_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {RIDE_SORT_BY_OPTS.map(o => (
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

function RideSortDirCombobox({ value, onChange }: { value: 'ASC'|'DESC'; onChange: (v: 'ASC'|'DESC') => void }) {
  const [open, setOpen] = useState(false)
  const current = RIDE_SORT_DIR_OPTS.find(o => o.value === value) ?? RIDE_SORT_DIR_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {RIDE_SORT_DIR_OPTS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value as 'ASC'|'DESC'); setOpen(false) }}
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

// ── Rides per page — mid-small cards need a page size the visitor can pick,
// rather than a hardcoded value ──────────────────────────────────
const RIDE_PAGE_SIZE_OPTS = [
  { value: 8,  label: '8 per page' },
  { value: 10, label: '10 per page' },
  { value: 12, label: '12 per page' },
]

function RidePageSizeCombobox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const current = RIDE_PAGE_SIZE_OPTS.find(o => o.value === value) ?? RIDE_PAGE_SIZE_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        <LayoutGrid className="w-3.5 h-3.5 text-gray-500" />
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 right-0 sm:left-0 w-32 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {RIDE_PAGE_SIZE_OPTS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === o.value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ✅ NEW — skeleton card matching the mid-small ride card's shape (image
// block, title bar, description lines, badge pills, button bar). Shown
// instead of a centered spinner while paging/sorting/filtering the rides
// grid, so the grid keeps its shape instead of collapsing to a spinner.
function RideCardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-32 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-gray-100 rounded-full w-14" />
          <div className="h-5 bg-gray-100 rounded-full w-14" />
        </div>
        <div className="h-8 bg-gray-200 rounded-xl mt-2" />
      </div>
    </div>
  )
}

// ── Bundles sort — Name/Price only, client-side (promos aren't paginated
// or sorted server-side on this tab) ────────────────────────────────
const PROMO_SORT_BY_OPTS = [
  { value: '',      label: 'Sort by default', icon: <Filter className="w-3.5 h-3.5 text-gray-400" /> },
  { value: 'Name',  label: 'Name',            icon: <Type className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Price', label: 'Price',           icon: <Banknote className="w-3.5 h-3.5 text-gray-500" /> },
]

function PromoSortByCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = PROMO_SORT_BY_OPTS.find(o => o.value === value) ?? PROMO_SORT_BY_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {PROMO_SORT_BY_OPTS.map(o => (
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

function PromoSortDirCombobox({ value, onChange }: { value: 'ASC'|'DESC'; onChange: (v: 'ASC'|'DESC') => void }) {
  const [open, setOpen] = useState(false)
  const current = RIDE_SORT_DIR_OPTS.find(o => o.value === value) ?? RIDE_SORT_DIR_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {RIDE_SORT_DIR_OPTS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value as 'ASC'|'DESC'); setOpen(false) }}
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

// ✅ NEW — display-only variant of combinePromoRange, used just for the
// browsing card's badges (not the guest booking modal's actual
// validation). A General Admission ride included in the bundle (no rider
// category tag, nothing manually entered) has null min/max here, which
// combinePromoRange simply drops — if EVERY ride in the bundle is General
// Admission that leaves nothing to combine and the badges vanish, making
// the bundle look unrestricted. It isn't, so each General Admission ride's
// missing metric is filled with the Attraction Validation Settings
// floor/ceiling (`bounds`) before combining, same as a single ride card.
function combinePromoRangeDisplay(
  rides: PromoRideItem[], bounds: RideValidationSettings,
  minKey: 'minHeightCm'|'minAgeYears'|'minWeightKg', maxKey: 'maxHeightCm'|'maxAgeYears'|'maxWeightKg',
  floorKey: keyof RideValidationSettings, ceilingKey: keyof RideValidationSettings,
) {
  const mins = rides.map(r => r[minKey] ?? (bounds[floorKey] as number))
  const maxs = rides.map(r => r[maxKey] ?? (bounds[ceilingKey] as number))
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
              This attraction requires you to be{' '}
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
        <div className="text-[15px] font-bold text-gray-900 mb-1">Book bundle "{promoName}"?</div>
        <div className="text-[12px] text-gray-500 mb-4">
          Covering {rideCount} attractions as one booking.
          {hasRestriction && (
            <span className="block mt-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              Every attraction in this bundle requires you to be{' '}
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
        <img src={src} alt="Attraction" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
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
export function VisitorDashboard() {
  const { user } = useAuth()

  // rides list
  const [rides, setRides]         = useState<Ride[]>([])
  const [ridePag, setRidePag]     = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:8 })
  // ✅ CHANGED — default page size bumped from 6 to 9 to match the new
  // mid-small card layout (paired with RidePageSizeCombobox below).
  const [rideParams, setRideParams] = useState<PaginationRequest>({ page:1, pageSize:8, search:'' })
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  // ref used to scroll back to the top of the rides list on page change
  const ridesSectionRef = useRef<HTMLDivElement>(null)

  // ✅ NEW — Attraction Validation Settings' widest floor–ceiling range, used
  // to default-display a General Admission ride/bundle's restriction badges
  // (no rider category tag, nothing manually entered) instead of hiding them
  // entirely, matching the read-only "General Admission" card Admin sees in
  // Settings. Falls back to these hardcoded defaults if the fetch fails, so
  // the badges just quietly stop showing rather than breaking the page.
  const [bounds, setBounds] = useState<RideValidationSettings>({
    minHeightFloorCm: 50, minHeightCeilingCm: 250,
    maxHeightFloorCm: 50, maxHeightCeilingCm: 250,
    minAgeFloorYears: 1, minAgeCeilingYears: 100,
    maxAgeFloorYears: 1, maxAgeCeilingYears: 130,
    minWeightFloorKg: 1, minWeightCeilingKg: 400,
    maxWeightFloorKg: 1, maxWeightCeilingKg: 400,
    updatedAt: '',
  })
  useEffect(() => {
    settingsApi.getRideValidation()
      .then(res => {
        const data: RideValidationSettings = res.data?.data ?? res.data
        if (data) setBounds(data)
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  // ── Rides vs Promos toggle ──────────────────────────────────
  const [viewMode, setViewMode] = useState<'rides' | 'promos'>('rides')
  const [promos, setPromos]       = useState<RidePromo[]>([])
  const [promoLoading, setPromoLoading] = useState(true)
  // ✅ NEW — bundles are fetched once (not paginated/sorted server-side), so
  // sorting is done client-side over the already-fetched list.
  const [promoSortBy, setPromoSortBy]   = useState<'' | 'Name' | 'Price'>('')
  const [promoSortDir, setPromoSortDir] = useState<'ASC' | 'DESC'>('ASC')

  // ✅ NEW — derived, sorted view of `promos`; recomputed on every render
  // (list is capped at 50 items, so a plain sort here is cheap enough to
  // skip useMemo).
  const sortedPromos = !promoSortBy ? promos : [...promos].sort((a, b) => {
    const dir = promoSortDir === 'ASC' ? 1 : -1
    if (promoSortBy === 'Name') return a.name.localeCompare(b.name) * dir
    return (a.price - b.price) * dir
  })

  // selected promo — schedules are LOCKED IN per ride by the admin already,
  // so there's no schedule-picking step here, just a direct book button.
  const [selectedPromo, setSelectedPromo]       = useState<RidePromo | null>(null)
  const [promoBookTarget, setPromoBookTarget]   = useState<RidePromo | null>(null)
  const [promoBookingLoading, setPromoBookingLoading] = useState(false)

  // ✅ NEW — pressing the "Bundle · N attractions" pill on a browsing card
  // opens a quick-preview modal (rides + slots + status) without leaving the grid.
  const [viewRidesPromo, setViewRidesPromo] = useState<RidePromo | null>(null)

  // selected ride + its schedules
  const [selectedRide, setSelectedRide]   = useState<Ride | null>(null)
  const [schedules, setSchedules]         = useState<Schedule[]>([])
  const [schedLoading, setSchedLoading]   = useState(false)

  // ✅ CHANGED — the full searchable/filterable/paginated booking list (plus
  // cancel/review/view-details) moved to its own page, MyBookings.tsx,
  // reachable from the Visitor nav tabs (see VisitorNavTabs in
  // PortalLayouts.tsx) instead of a section at the bottom of this page. All
  // this page keeps is a lightweight "your activity this month" stats
  // summary, fed by its own slim fetch below — no pagination/search/filter
  // state needed for that.
  const [bookStats, setBookStats] = useState({ total:0, upcoming:0, completed:0, cancelled:0 })
  const [allBookingsRaw, setAllBookingsRaw] = useState<any[]>([])

  // modals
  const [zoomSrc, setZoomSrc]           = useState<string|null>(null)
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
  // ✅ NEW — pressing a pagination Prev/Next button used to leave the
  // scroll position wherever it was (usually at the bottom, right on the
  // pagination controls), so the newly-loaded page's first rows were
  // scrolled off-screen above. Snap back to the top of the rides list
  // whenever its page number changes.
  useEffect(() => {
    ridesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [rideParams.page])

  // ✅ CHANGED — was fetchBookings (paginated list + raw list together, for
  // both the My Bookings section AND these stats). Now just the slim raw
  // fetch the stats need, polling every 5s same as before so an admin
  // approving a booking mid-session still shows up without a refresh.
  useEffect(() => {
    fetchBookingStats()
    const interval = setInterval(() => fetchBookingStats({ silent: true }), 5_000)
    return () => clearInterval(interval)
  }, [])
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
      fetchBookingStats()
      fetchPromos()
    } catch (e: any) {
      setPromoBookTarget(null)
      toast.error(getErrorMessage(e, 'Bundle booking failed.'))
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
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed to load attractions.')) }
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

  // ✅ CHANGED — was fetchBookings: fetched both a paginated/searchable page
  // (for the on-page My Bookings list) AND a 500-row raw list (for the
  // month stats) together. The paginated half moved to MyBookings.tsx along
  // with the list it fed; this page only ever needed the raw list, to
  // compute bookStats below.
  const fetchBookingStats = async (opts: { silent?: boolean } = {}) => {
    try {
      const res = await api.get('/api/booking/my-bookings', { params: { page: 1, pageSize: 500 } })
      const all: any[] = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      setAllBookingsRaw(all)
    } catch (e: any) {
      if (!opts.silent) toast.error(getErrorMessage(e, 'Failed to load your booking activity.'))
    }
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
      fetchBookingStats()
      fetchRides()
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Booking failed.'))
    } finally { setBookingLoading(false) }
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
              <MapPin className="w-3 h-3" /> Glorious Fantasyland
            </div>
            <h1 className="text-2xl font-bold mb-1">{greeting}, {user?.firstName}! 🎢</h1>
            <p className="text-white/80 text-sm">Ready for an adventure? Browse attractions and pick a schedule.</p>
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
      <div ref={ridesSectionRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm scroll-mt-6">
        {/* ✅ CHANGED — Attractions/Bundles switch now lives here, fixed at
            the very top of the card regardless of which tab or drill-down
            view is active, instead of being reordered inside each tab's
            filter row. */}
        {!selectedRide && !selectedPromo && <ViewToggle value={viewMode} onChange={setViewMode} />}
        {viewMode === 'rides' ? ( !selectedRide ? (
          // ── Rides list ──────────────────────────────────────
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FerrisWheel className="w-5 h-5 text-emerald-500" /> Available attractions
                </h3>
              <p className="text-xs text-gray-500">Click an attraction to see available schedules and book.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ✅ NEW — sort by Price or Rating, ascending by default,
                    same combobox style as Admin's Rides.tsx. */}
                <RideSortByCombobox
                  value={rideParams.sortBy ?? ''}
                  onChange={v => setRideParams(p => ({ ...p, sortBy: v || undefined, page: 1 }))} />
                <RideSortDirCombobox
                  value={rideParams.sortDirection ?? 'ASC'}
                  onChange={v => setRideParams(p => ({ ...p, sortDirection: v, page: 1 }))} />
                {/* ✅ NEW — lets the visitor pick how many mid-small cards
                    load per page instead of a fixed 6. */}
                <RidePageSizeCombobox
                  value={rideParams.pageSize ?? 9}
                  onChange={v => setRideParams(p => ({ ...p, pageSize: v, page: 1 }))} />
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input value={search}
                    onChange={e => { setSearch(e.target.value); setRideParams(p => ({ ...p, search: e.target.value, page: 1 })) }}
                    placeholder="Search attractions..."
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-48 bg-gray-50" />
                </div>
              </div>
            </div>

            {loading ? (
              // ✅ CHANGED — was a centered spinner that blanked the whole
              // grid; now skeleton cards in the same mid-small grid shape,
              // sized to the current page size, so paging/sorting/filtering
              // doesn't cause the whole list to flash empty.
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-5">
                {Array.from({ length: rideParams.pageSize ?? 8 }).map((_, i) => <RideCardSkeleton key={i} />)}
              </div>
            ) : rides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FerrisWheel className="w-14 h-14 mb-3 text-gray-200" />
                <div className="font-semibold text-gray-500">No attractions available</div>
              </div>
            ) : (
              <>
                {/* ✅ CHANGED — added an xl breakpoint (4 columns) and shrank
                    the card image/padding/title so more mid-small cards fit
                    comfortably per row, matching the new 9/12-per-page option. */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-5">
                  {rides.map(ride => (
                    <div key={ride.id}
                      className="border border-gray-200 rounded-2xl overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all group">
                      {/* Image */}
                      <div className="relative h-32 bg-white overflow-hidden"
                        onClick={() => { const u = getImageUrl(ride.imagePath); if (u) setZoomSrc(u) }}>
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
                      <div className="p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{ride.name}</h4>
                          {/* ✅ NEW — average rating from every OPTIONAL review
                              left on a completed + paid booking for this ride. */}
                          {ride.reviewCount > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 flex-shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {ride.averageRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mb-2 min-h-[2rem]">{ride.description ?? 'No description'}</p>
                        <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ride.maxCapacity}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ride.durationMinutes}m</span>
                        </div>
                        {/* ✅ NEW — same restriction badges shown on the Admin
                            Rides card, surfaced here so visitors see height/age/
                            weight requirements while browsing, before they ever
                            open the booking modal.
                            ✅ NEW — a General Admission ride (no rider category
                            tag) with nothing manually entered has null fields
                            here, which used to hide the badges entirely and
                            make it look unrestricted. It isn't — General
                            Admission still enforces the widest range
                            Attraction Validation Settings (`bounds`) allows —
                            so each metric falls back to that floor–ceiling
                            pair whenever the ride has no manual value. */}
                        {(() => {
                          const isGeneralAdmission = !ride.categoryNames || ride.categoryNames.length === 0
                          const heightMin = ride.minHeightCm ?? (isGeneralAdmission ? bounds.minHeightFloorCm : null)
                          const heightMax = ride.maxHeightCm ?? (isGeneralAdmission ? bounds.maxHeightCeilingCm : null)
                          const ageMin = ride.minAgeYears ?? (isGeneralAdmission ? bounds.minAgeFloorYears : null)
                          const ageMax = ride.maxAgeYears ?? (isGeneralAdmission ? bounds.maxAgeCeilingYears : null)
                          const weightMin = ride.minWeightKg ?? (isGeneralAdmission ? bounds.minWeightFloorKg : null)
                          const weightMax = ride.maxWeightKg ?? (isGeneralAdmission ? bounds.maxWeightCeilingKg : null)

                          if (heightMin == null && heightMax == null
                            && ageMin == null && ageMax == null
                            && weightMin == null && weightMax == null) return null

                          return (
                            <div className="flex items-center gap-1.5 flex-wrap mb-3"
                              title="Every guest in the party must meet all of these to book this attraction">
                              {(heightMin != null || heightMax != null) && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-1 cursor-default">
                                  <Ruler className="w-3 h-3" />
                                  {heightMin != null && heightMax != null
                                    ? `${heightMin}-${heightMax}cm`
                                    : heightMin != null ? `${heightMin}cm+` : `Up to ${heightMax}cm`}
                                </span>
                              )}
                              {(ageMin != null || ageMax != null) && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-1 cursor-default">
                                  <Cake className="w-3 h-3" />
                                  {ageMin != null && ageMax != null
                                    ? `${ageMin}-${ageMax}y`
                                    : ageMin != null ? `${ageMin}y+` : `Up to ${ageMax}y`}
                                </span>
                              )}
                              {(weightMin != null || weightMax != null) && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 cursor-default">
                                  <Weight className="w-3 h-3" />
                                  {weightMin != null && weightMax != null
                                    ? `${weightMin}-${weightMax}kg`
                                    : weightMin != null ? `${weightMin}kg+` : `Up to ${weightMax}kg`}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                        {/* ✅ NEW — Kid/Teen/Adult tagging, same badge style
                            Admin > Attractions shows, so visitors see who
                            this attraction is meant for at a glance. */}
                        {ride.categoryNames && ride.categoryNames.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-3">
                            {ride.categoryNames.map((name, i) => {
                              const Icon = categoryChipIcon(name)
                              return (
                                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 cursor-default">
                                  <Icon className="w-3 h-3" />
                                  {name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        <button
                          onClick={() => fetchSchedules(ride)}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm">
                          <Calendar className="w-3.5 h-3.5" /> View schedules
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-5 pt-4 pb-3 mt-1 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Showing <strong>{rides.length}</strong> of <strong>{ridePag.totalCount}</strong> attractions</span>
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
                <ArrowLeft className="w-3.5 h-3.5" /> Back to attractions
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
                    <Tag className="w-5 h-5 text-pink-500" /> Attraction bundles
                  </h3>
                  <p className="text-xs text-gray-500">Bundle deals — click a bundle to pick schedules and book.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <PromoSortByCombobox value={promoSortBy} onChange={v => setPromoSortBy(v as '' | 'Name' | 'Price')} />
                  <PromoSortDirCombobox value={promoSortDir} onChange={setPromoSortDir} />
                </div>
              </div>

              {promoLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
                </div>
              ) : promos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                  <Tag className="w-14 h-14 mb-3 text-gray-200" />
                  <div className="font-semibold text-gray-500">No bundles available</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {sortedPromos.map(promo => {
                    const available = promoIsAvailable(promo)
                    return (
                      <div key={promo.id}
                        className={`border border-gray-200 rounded-2xl overflow-hidden hover:border-pink-300 hover:shadow-md transition-all group ${!available ? 'opacity-60' : ''}`}>
                        <div className="relative h-40 bg-white overflow-hidden"
                          onClick={() => { const u = getImageUrl(promo.imagePath); if (u) setZoomSrc(u) }}>
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
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <h4 className="font-bold text-gray-900 text-base truncate">{promo.name}</h4>
                            {/* ✅ CHANGED — was a static badge; now pressable,
                                opening a quick-preview modal of the included
                                rides right on the card, matching the same
                                pill-opens-modal pattern used on Admin
                                Promos.tsx and Admin Bookings.tsx. */}
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setViewRidesPromo(promo) }}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-semibold border border-pink-100 flex-shrink-0 hover:bg-pink-100 transition-colors">
                              Bundle · {promo.rides.length} attractions
                            </button>
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
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-pink-700 bg-pink-50 border border-pink-100 rounded-lg px-2 py-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {promo.promoDate.slice(0, 10)}
                            </div>
                            {/* ✅ NEW — rides are sorted by CallTime server-side,
                                so promo.rides[0] is always the one visitors need
                                to check in for first. */}
                            <CallTimeBadge time={promo.rides[0]?.callTime} className="text-[11px] px-2 py-1" label="First ride call time" />
                          </div>
                          {/* ✅ CHANGED — removed the per-ride name pill row;
                              the call time badge above already surfaces the
                              earliest ride at a glance, and "View details"
                              opens the full ride list. */}
                          {/* ✅ NEW — combined restriction badges across every
                              ride in this bundle (widest range that covers all
                              of them), same visual treatment as a single-ride
                              card so visitors see requirements up front. */}
                          {(() => {
                            const h = combinePromoRangeDisplay(promo.rides, bounds, 'minHeightCm', 'maxHeightCm', 'minHeightFloorCm', 'maxHeightCeilingCm')
                            const a = combinePromoRangeDisplay(promo.rides, bounds, 'minAgeYears', 'maxAgeYears', 'minAgeFloorYears', 'maxAgeCeilingYears')
                            const w = combinePromoRangeDisplay(promo.rides, bounds, 'minWeightKg', 'maxWeightKg', 'minWeightFloorKg', 'maxWeightCeilingKg')
                            const hasAny = h.min != null || h.max != null || a.min != null || a.max != null || w.min != null || w.max != null
                            if (!hasAny) return null
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap mb-3"
                                title="Every guest in the party must meet all of these across every included attraction">
                                {(h.min != null || h.max != null) && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-1 cursor-default">
                                    <Ruler className="w-3 h-3" />
                                    {h.min != null && h.max != null ? `${h.min}-${h.max}cm` : h.min != null ? `${h.min}cm+` : `Up to ${h.max}cm`}
                                  </span>
                                )}
                                {(a.min != null || a.max != null) && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-1 cursor-default">
                                    <Cake className="w-3 h-3" />
                                    {a.min != null && a.max != null ? `${a.min}-${a.max}y` : a.min != null ? `${a.min}y+` : `Up to ${a.max}y`}
                                  </span>
                                )}
                                {(w.min != null || w.max != null) && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 cursor-default">
                                    <Weight className="w-3 h-3" />
                                    {w.min != null && w.max != null ? `${w.min}-${w.max}kg` : w.min != null ? `${w.min}kg+` : `Up to ${w.max}kg`}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                          <button disabled={!available}
                            onClick={() => available && openPromo(promo)}
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
                  {promoHasSlots(selectedPromo) ? `Book this bundle — ₱${fmt(selectedPromo.price)}` : 'No slots left for this bundle'}
                </button>
              </div>
            </>
          )
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

      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}

      {viewRidesPromo && (
        <PromoRidesModal promo={viewRidesPromo} onClose={() => setViewRidesPromo(null)} />
      )}
    </div>
  )
}
