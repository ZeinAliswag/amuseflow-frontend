import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  Ticket, Search, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Clock, XCircle, CheckCircle2, X, Loader2, Tag, PackageCheck, Star,
  CalendarDays, FerrisWheel, ZoomIn, AlarmClock, Eye, User,
  FileText, Ruler, Cake, Weight,
} from 'lucide-react'
import type { Booking, BookingPromoItem } from '../../types'
import api, { reviewApi } from '../../services/api'
import toast from 'react-hot-toast'

// ── This page is the dedicated "My Bookings" destination reachable from the
// Visitor portal's nav tabs (see VisitorNavTabs in PortalLayouts.tsx),
// instead of a section the visitor had to scroll all the way down the
// Browse page to find. It owns its own booking list/search/filter/
// pagination/cancel/review state entirely — nothing here is shared with
// VisitorDashboard.tsx (the Browse page), which only keeps a lightweight
// month-stats summary of the same data. A handful of small formatter/
// display helpers below (fmt, fmtTime, Badge, CallTimeBadge, etc.) are
// intentionally duplicated from VisitorDashboard.tsx rather than factored
// into a shared module — this file follows the same "small helpers live
// next to where they're used" convention already used throughout this
// codebase (e.g. PortalLayouts.tsx duplicates its own toISO/fmtRange). ──

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const fmt = (n: any) => Number(n ?? 0).toFixed(2)
const RIDES_MODAL_PAGE_SIZE = 3
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function getImageUrl(path?: string) {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${BASE_URL}${path}`
  return `${BASE_URL}/images/${path}`
}

function fmtTime(t?: string) {
  if (!t) return '—'
  return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDateTime(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

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
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })
const fmtLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
function fmtRange(from: string, to: string, sep = ' – ') {
  if (from === to) return fmtLong(from)
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${fmtShort(from)}${sep}${fmtLong(to)}`
    : `${fmtLong(from)}${sep}${fmtLong(to)}`
}

// ✅ FIX (Bug: rejected/cancelled bookings misleadingly showed "Unpaid" +
// the ride price, which read as "you still owe this" even though no
// payment could ever be collected on a dead booking). Centralizes what the
// payment column should actually say for a given booking, used by both the
// row and the View Details modal so they never disagree with each other.
//   - Rejected: only ever happens while still Pending (see
//     BookingService.ApproveRejectAsync — only Pending bookings can be
//     rejected), so payment was never collected. No badge, no price —
//     just a plain explanation that nothing is owed.
//   - Cancelled + never paid: same story, explained the same way.
//   - Cancelled + already paid (a visitor can cancel an Approved/Paid
//     booking): payment WAS collected, so the price and a "Paid" badge
//     stay visible — but flagged so it doesn't read as a still-active
//     paid booking.
//   - Anything else: unchanged — real payment status + price.
function paymentSummary(b: Booking): { badge: string | null; note: string; showPrice: boolean } {
  if (b.status === 'Rejected')
    return { badge: null, note: 'No payment required — this booking was rejected.', showPrice: false }
  if (b.status === 'Cancelled') {
    return b.paymentStatus === 'Paid'
      ? { badge: 'Paid', note: 'Paid before this booking was cancelled.', showPrice: true }
      : { badge: null, note: 'No payment required — this booking was cancelled.', showPrice: false }
  }
  return { badge: b.paymentStatus, note: '', showPrice: true }
}

function CallTimeBadge({ time, className = '', label = 'Call time' }: { time?: string; className?: string; label?: string }) {
  if (!time) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-semibold shadow-sm ${className}`}>
      <AlarmClock className="w-3.5 h-3.5" />
      {label}: {fmtTime(time)}
    </span>
  )
}

function Badge({ label }: { label: string }) {
  const map: Record<string,string> = {
    Paid:'bg-green-100 text-green-700', Unpaid:'bg-amber-100 text-amber-700',
    Pending:'bg-amber-100 text-amber-700', Approved:'bg-green-100 text-green-700',
    Rejected:'bg-red-100 text-red-700', Completed:'bg-blue-100 text-blue-700',
    Cancelled:'bg-gray-100 text-gray-600', Open:'bg-green-100 text-green-700',
    Full:'bg-red-100 text-red-700', Missed:'bg-orange-100 text-orange-700',
    Available:'bg-green-100 text-green-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

function StarRatingDisplay({ rating, size = 'w-3.5 h-3.5' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${size} ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
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

function BookingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded w-28" />
        <div className="h-2.5 bg-gray-100 rounded w-48" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-14 flex-shrink-0" />
    </div>
  )
}

// ── Bundle rides preview — a My Bookings row's locked-in included rides
// (no slots/status, nothing left to pick). ──
function BookingRidesModal({ name, promoDate, rides, onClose }: {
  name: string; promoDate?: string; rides: BookingPromoItem[]; onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rides.length / RIDES_MODAL_PAGE_SIZE))
  const pageRides = rides.slice((page - 1) * RIDES_MODAL_PAGE_SIZE, page * RIDES_MODAL_PAGE_SIZE)

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm truncate">{name}</div>
            <div className="text-xs text-gray-400">
              {rides.length} attractions included{promoDate ? ` · ${promoDate.slice(0, 10)}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {pageRides.map(r => (
            <div key={r.rideId} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="font-semibold text-gray-900 text-sm mb-2">{r.rideName}</div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {r.scheduleDate.slice(0, 10)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                </div>
              </div>
              <CallTimeBadge time={r.callTime} className="text-[11px]" />
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          {rides.length > RIDES_MODAL_PAGE_SIZE ? (
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

      <div className="mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={gotoToday}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Jump to today
        </button>
      </div>
    </div>
  )
}

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
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
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

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
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

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3 flex-shrink-0">
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

// ✅ NEW (Bug: no way to see a booking's complete details in one place) —
// "View details" on a row opens this instead of relying on whatever fits
// inline in the row itself.
function BookingDetailModal({ booking, onClose, onViewRides }: {
  booking: Booking; onClose: () => void; onViewRides: () => void
}) {
  const b = booking
  const pay = paymentSummary(b)
  const title = b.promoId ? (b.promoName ?? 'Bundle') : (b.rideName ?? 'Attraction')
  const imagePath = b.promoId ? b.promoImagePath : b.rideImagePath
  const imageUrl = getImageUrl(imagePath)

  const rows: { icon: ReactNode; bg: string; label: string; value: string }[] = []
  if (!b.promoId) {
    rows.push({ icon: <Calendar className="w-3.5 h-3.5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Date', value: b.scheduleDate ?? '—' })
    rows.push({ icon: <Clock className="w-3.5 h-3.5 text-blue-600" />, bg: 'bg-blue-50', label: 'Time', value: b.startTime ? `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}` : '—' })
    if (b.callTime) rows.push({ icon: <AlarmClock className="w-3.5 h-3.5 text-cyan-600" />, bg: 'bg-cyan-50', label: 'Call time', value: fmtTime(b.callTime) })
  } else {
    const first = b.includedRides?.[0]
    rows.push({ icon: <Calendar className="w-3.5 h-3.5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Date', value: first?.scheduleDate?.slice(0, 10) ?? '—' })
  }
  rows.push({ icon: <User className="w-3.5 h-3.5 text-indigo-600" />, bg: 'bg-indigo-50', label: 'Booked by', value: b.visitorName ?? '—' })
  const bookedAtLabel = fmtDateTime(b.bookedAt)
  if (bookedAtLabel) rows.push({ icon: <FileText className="w-3.5 h-3.5 text-slate-600" />, bg: 'bg-slate-100', label: 'Booked at', value: bookedAtLabel })

  return (
    <div className="fixed inset-0 bg-black/40 z-[75] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${b.promoId ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : b.promoId ? <Tag className="w-5 h-5" /> : <FerrisWheel className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-sm truncate">{title}</div>
              <div className="font-mono text-[11px] text-gray-500">{b.bookingCode}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={b.status} />
            {pay.badge && <Badge label={pay.badge} />}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Payment</div>
            </div>
            {pay.showPrice ? (
              <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-sm font-bold text-gray-900">₱{fmt(b.ridePrice ?? b.paymentAmount)}</span>
                {b.paidAt && <span className="text-[10px] text-gray-400">Paid {fmtDateTime(b.paidAt)}</span>}
              </div>
            ) : null}
            {pay.note && (
              <div className={`text-[11px] font-medium leading-snug mt-1.5 ${pay.showPrice ? 'text-amber-600' : 'text-gray-500'}`}>{pay.note}</div>
            )}
          </div>

          {b.promoId && (
            <button type="button" onClick={onViewRides}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-pink-50 border border-pink-100 hover:bg-pink-100 transition-colors">
              <span className="flex items-center gap-2 text-xs font-semibold text-pink-700">
                <PackageCheck className="w-4 h-4" /> {b.includedRides?.length ?? 0} attractions included
              </span>
              <ChevronRight className="w-4 h-4 text-pink-400" />
            </button>
          )}

          {rows.map(row => (
            <div key={row.label} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg ${row.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>{row.icon}</div>
              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{row.label}</div>
                <div className="text-[12px] text-gray-900 font-medium">{row.value}</div>
              </div>
            </div>
          ))}

          {b.guests && b.guests.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Guest</div>
              {b.guests.map((g, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-[12px] text-gray-700 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-gray-900">{g.guestName}</span>
                  {g.ageYears != null && <span className="flex items-center gap-1 text-gray-500"><Cake className="w-3 h-3" /> {g.ageYears} yrs</span>}
                  {g.heightCm != null && <span className="flex items-center gap-1 text-gray-500"><Ruler className="w-3 h-3" /> {g.heightCm} cm</span>}
                  {g.weightKg != null && <span className="flex items-center gap-1 text-gray-500"><Weight className="w-3 h-3" /> {g.weightKg} kg</span>}
                </div>
              ))}
            </div>
          )}

          {b.notes && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</div>
              <div className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{b.notes}</div>
            </div>
          )}

          {b.review && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Your review</div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                <StarRatingDisplay rating={b.review.rating} />
                {b.review.comment && <div className="text-[12px] text-gray-600 mt-1.5 italic">"{b.review.comment}"</div>}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[12px] font-medium hover:bg-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function MyBookings() {
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [bookPag, setBookPag]     = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:5 })
  const [bookParams, setBookParams] = useState({ page:1, pageSize:5 })
  const [bookLoading, setBookLoading] = useState(true)

  const bookingsSectionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bookingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [bookParams.page])

  const [bookSearch, setBookSearch]   = useState('')
  const [bookDateFrom, setBookDateFrom] = useState('')
  const [bookDateTo, setBookDateTo]     = useState('')
  const [bookDateModalOpen, setBookDateModalOpen] = useState(false)

  const [zoomSrc, setZoomSrc]           = useState<string|null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking|null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<Booking|null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [viewBookingRides, setViewBookingRides] = useState<Booking | null>(null)
  const [detailTarget, setDetailTarget] = useState<Booking | null>(null)

  const fetchBookings = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setBookLoading(true)
    try {
      const res = await api.get('/api/booking/my-bookings', {
        params: {
          ...bookParams,
          search: bookSearch || undefined,
          fromDate: bookDateFrom || undefined,
          toDate: bookDateTo || undefined,
        }
      })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data ?? []
      let list: Booking[] = Array.isArray(d) ? d : []
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
      const pg = res.data?.data?.pagination ?? res.data?.pagination
      if (pg) setBookPag(pg)
    } catch (e: any) {
      if (!opts.silent) toast.error(getErrorMessage(e, 'Failed to load bookings.'))
    }
    finally { if (!opts.silent) setBookLoading(false) }
  }

  useEffect(() => {
    fetchBookings()
    // Same silent-poll pattern as the rest of the app — keeps statuses
    // fresh (e.g. an admin approving a booking) without flashing the whole
    // list back to a loading skeleton every 5s.
    const interval = setInterval(() => fetchBookings({ silent: true }), 5_000)
    return () => clearInterval(interval)
  }, [bookParams, bookSearch, bookDateFrom, bookDateTo])

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
  const rideActuallyEnded = (b: Booking) =>
    b.promoId
      ? (b.includedRides ?? []).every(r => new Date(`${r.scheduleDate.slice(0, 10)}T${r.endTime}`) <= now)
      : !b.scheduleDate || !b.endTime || new Date(`${b.scheduleDate.slice(0, 10)}T${b.endTime}`) <= now

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-emerald-500" /> My Bookings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Your attraction reservation history.</p>
      </div>

      <div ref={bookingsSectionRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm scroll-mt-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input value={bookSearch}
                onChange={e => { setBookSearch(e.target.value); setBookParams(p => ({ ...p, page: 1 })) }}
                placeholder="Search code or attraction..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full sm:w-56 bg-gray-50" />
            </div>
            <DateRangeButton
              from={bookDateFrom} to={bookDateTo}
              onClick={() => setBookDateModalOpen(true)}
            />
          </div>
          <span className="text-xs text-gray-400 font-medium">{bookPag.totalCount} total</span>
        </div>
        {bookLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: bookParams.pageSize ?? 5 }).map((_, i) => <BookingRowSkeleton key={i} />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Ticket className="w-14 h-14 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">No bookings found</div>
            <div className="text-xs mt-1">
              {bookSearch || bookDateFrom || bookDateTo ? 'Try adjusting your filters.' : 'Bookings you make will show up here.'}
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {bookings.map(b => {
                const pay = paymentSummary(b)
                return (
                <div key={b.id} className="flex flex-col px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {b.promoId ? (
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
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{b.promoName}</span>
                          <button type="button"
                            onClick={() => setViewBookingRides(b)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-semibold border border-pink-100 hover:bg-pink-100 transition-colors">
                            <PackageCheck className="w-3 h-3" /> Bundle · {b.includedRides?.length ?? 0} attractions
                          </button>
                        </div>
                        <div className="font-mono text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded font-semibold inline-block mb-1">
                          {b.bookingCode}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{b.includedRides?.[0]?.scheduleDate.slice(0, 10) ?? '—'}
                          </span>
                          <CallTimeBadge time={b.includedRides?.[0]?.callTime} className="text-[11px] px-2 py-0.5" label="First ride call time" />
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
                      {pay.badge && <Badge label={pay.badge} />}
                    </div>
                    <div className="text-right flex-shrink-0 max-w-[150px]">
                      {/* ✅ FIX — Rejected/Cancelled(unpaid) bookings no longer
                          show a bare "Unpaid" badge + price (which read as
                          "you still owe this"). A Cancelled-after-payment
                          booking still shows the price it was actually paid,
                          with a clarifying note underneath. See
                          paymentSummary() above. */}
                      {pay.showPrice && (
                        <div className="font-bold text-gray-900 text-sm">₱{fmt(b.ridePrice ?? b.paymentAmount)}</div>
                      )}
                      {pay.note ? (
                        <div className={`text-[11px] font-medium leading-snug mt-0.5 ${pay.showPrice ? 'text-amber-600' : 'text-gray-400'}`}>{pay.note}</div>
                      ) : b.paidAt ? (
                        <div className="text-[10px] text-gray-400 mt-0.5">Paid {fmtDateTime(b.paidAt)}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* ✅ NEW — View details opens a dedicated modal with
                          this booking's complete information. */}
                      <button onClick={() => setDetailTarget(b)} title="View details"
                        className="flex items-center justify-center w-8 h-8 bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      {b.status !== 'Completed' && b.status !== 'Cancelled' && b.status !== 'Rejected' && b.status !== 'Missed' && (
                        <button onClick={() => setCancelTarget(b)} title="Cancel booking"
                          className="flex items-center justify-center w-8 h-8 bg-white text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  </div>
                  {b.status === 'Completed' && b.paymentStatus === 'Paid' && (
                    b.review ? (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 flex-shrink-0">
                          <StarRatingDisplay rating={b.review.rating} />
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {b.promoId ? 'You rated this bundle' : 'You rated this attraction'}
                        </span>
                        {b.review.comment && (
                          <span className="text-[11px] text-gray-400 truncate italic">— "{b.review.comment}"</span>
                        )}
                      </div>
                    ) : rideActuallyEnded(b) ? (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => setReviewTarget(b)}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold transition-all shadow-sm">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          Leave a review
                          <span className="text-amber-500 font-normal">(optional)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {b.promoId
                          ? 'You can review this bundle once every included attraction is over.'
                          : `You can review this attraction once it ends${b.endTime ? ` at ${fmtTime(b.endTime)}` : ''}.`}
                      </div>
                    )
                  )}
                </div>
              )})}
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

      {cancelTarget && (
        <ConfirmModal
          title="Cancel booking?"
          message={`Cancel your booking for "${cancelTarget.promoId ? cancelTarget.promoName : cancelTarget.rideName}"? This cannot be undone.`}
          confirmLabel="Yes, cancel"
          danger
          onConfirm={doCancel}
          onCancel={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          rideName={reviewTarget.promoId ? (reviewTarget.promoName ?? 'this bundle') : (reviewTarget.rideName ?? 'this attraction')}
          onSubmit={doSubmitReview}
          onCancel={() => setReviewTarget(null)}
          loading={reviewLoading}
        />
      )}

      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}

      {viewBookingRides && (
        <BookingRidesModal
          name={viewBookingRides.promoName ?? 'Bundle'}
          promoDate={viewBookingRides.includedRides?.[0]?.scheduleDate}
          rides={viewBookingRides.includedRides ?? []}
          onClose={() => setViewBookingRides(null)}
        />
      )}

      {detailTarget && (
        <BookingDetailModal
          booking={detailTarget}
          onClose={() => setDetailTarget(null)}
          onViewRides={() => { setViewBookingRides(detailTarget); setDetailTarget(null) }}
        />
      )}

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
