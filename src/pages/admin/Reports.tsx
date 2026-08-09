import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3, Star, Printer, FerrisWheel, BadgePercent,
  TrendingUp, Award, ListChecks, Loader2, Filter,
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, X,
  SortAsc, SortDesc, Type, Search,
} from 'lucide-react'
import { reportApi } from '../../services/api'
import type { RatingTrend, RatingTrendPoint, EntityRating } from '../../types'
import { Card, Pagination } from '../../components/shared'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

// ── Letterhead constants — printable report header ──────────────
const PARK_NAME = 'Glorious Fantasyland'
const PARK_ADDRESS = 'GFL Complex, Sunset Boulevard, Dawo, Dapitan City, Zamboanga del Norte, 7101'
const LOGO_SRC = '/images__6_-removebg-preview.png'

type Scope = 'All' | 'Ride' | 'Promo'
type SortField = '' | 'Name' | 'Rating'

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'All',   label: 'All Attractions & Bundles' },
  { value: 'Ride',  label: 'Attractions only' },
  { value: 'Promo', label: 'Attraction Bundles only' },
]

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Sort combobox options for the Rating breakdown table — deliberately
// just Name/Rating (no "Date added"). ──
const SORT_BY_OPTS: { value: SortField; label: string; icon: ReactNode }[] = [
  { value: '',       label: 'Sort by default', icon: <Filter className="w-3.5 h-3.5 text-gray-400" /> },
  { value: 'Name',   label: 'Name',   icon: <Type className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Rating', label: 'Rating', icon: <Star className="w-3.5 h-3.5 text-gray-500" /> },
]

const SORT_DIR_OPTS: { value: 'ASC' | 'DESC'; label: string; icon: ReactNode }[] = [
  { value: 'DESC', label: 'Descending', icon: <SortDesc className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'ASC',  label: 'Ascending',  icon: <SortAsc className="w-3.5 h-3.5 text-gray-500" /> },
]

// ── Date helpers — local YYYY-MM-DD strings, no timezone surprises ──
const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })
const fmtLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
// Range display, from most to least compact as shared context grows:
//  - same day:            "August 9, 2026"
//  - same month & year:   "August 1–9, 2026"          (month/year said once)
//  - same year only:      "July 13 – August 13, 2026" (year said once)
//  - different years:     "July 13, 2024 – August 13, 2026" (nothing implied)
const fmtRange = (from: string, to: string) => {
  if (from === to) return fmtLong(from)
  const fromD = new Date(from + 'T00:00:00')
  const toD = new Date(to + 'T00:00:00')
  const fromYear = fromD.getFullYear()
  const toYear = toD.getFullYear()
  if (fromYear === toYear && fromD.getMonth() === toD.getMonth()) {
    const month = fromD.toLocaleDateString('en-PH', { month: 'long' })
    return `${month} ${fromD.getDate()}–${toD.getDate()}, ${toYear}`
  }
  return fromYear === toYear
    ? `${fmtShort(from)} – ${fmtShort(to)}, ${toYear}`
    : `${fmtLong(from)} – ${fmtLong(to)}`
}

// "This month" — the default report period: the 1st of the current month
// through today. Recomputed fresh (not a module-level constant) so it
// stays correct if the page is left open across a midnight/month rollover.
function thisMonthRange(): [string, string] {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return [toISO(start), toISO(today)]
}

function Stars({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  const rounded = Math.round(value)
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} style={{ width: size, height: size }}
          className={i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
      ))}
    </span>
  )
}

// ── Custom lightweight SVG line chart — no charting library dependency,
// matches this codebase's existing pattern of hand-rolled inline SVGs. ──
function RatingTrendChart({ points }: { points: RatingTrendPoint[] }) {
  const W = 760, H = 240
  const padL = 30, padR = 16, padT = 16, padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = points.length

  const xFor = (i: number) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1))
  const yFor = (v: number) => padT + innerH - (Math.max(0, Math.min(5, v)) / 5) * innerH

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.averageRating).toFixed(1)}`)
    .join(' ')

  const areaPath = n > 0
    ? `${linePath} L ${xFor(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    : ''

  const labelStep = n <= 8 ? 1 : Math.ceil(n / 8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly average rating trend">
      <defs>
        <linearGradient id="af-rating-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke="#eef2f7" strokeWidth={1} />
          <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
        </g>
      ))}

      {areaPath && <path d={areaPath} fill="url(#af-rating-gradient)" />}
      {linePath && (
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {points.map((p, i) => (
        <g key={`${p.year}-${p.month}`}>
          <circle cx={xFor(i)} cy={yFor(p.averageRating)} r={p.reviewCount > 0 ? 4 : 2.5}
            fill={p.reviewCount > 0 ? '#f59e0b' : '#e5e7eb'} stroke="#fff" strokeWidth={1.5} />
          <title>
            {p.monthLabel}: {p.reviewCount > 0 ? `${p.averageRating.toFixed(2)} ★` : 'No reviews'} ({p.reviewCount} review{p.reviewCount === 1 ? '' : 's'})
          </title>
        </g>
      ))}

      {points.map((p, i) => (
        i % labelStep === 0 && (
          <text key={`lbl-${p.year}-${p.month}`} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {p.monthLabel.split(' ')[0]}
          </text>
        )
      ))}
    </svg>
  )
}

// ── Report period picker — quick presets + calendar, same "select date"
// pattern as the Bookings/Promos date filters elsewhere in Admin, gray-
// themed. Unlike those, this one always has a value (never "All dates") —
// it's initialized to "This month" and Clear resets back to that instead
// of an empty filter, since a report always needs some period. ──
function ReportRangeCalendar({ from, to, onChange }: {
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
    </div>
  )
}

function ReportDateRangeModal({ from, to, onApply, onClose }: {
  from: string; to: string
  onApply: (from: string, to: string) => void
  onClose: () => void
}) {
  const [tempFrom, setTempFrom] = useState(from)
  const [tempTo, setTempTo] = useState(to)
  const today = new Date()

  const presets = [
    { label: 'Today', get: () => { const d = toISO(today); return [d, d] as [string, string] } },
    { label: 'This month', get: () => thisMonthRange() },
    { label: 'Last 3 months', get: () => { const s = new Date(today.getFullYear(), today.getMonth() - 2, 1); return [toISO(s), toISO(today)] as [string, string] } },
    { label: 'Last 6 months', get: () => { const s = new Date(today.getFullYear(), today.getMonth() - 5, 1); return [toISO(s), toISO(today)] as [string, string] } },
    { label: 'Last 12 months', get: () => { const s = new Date(today.getFullYear(), today.getMonth() - 11, 1); return [toISO(s), toISO(today)] as [string, string] } },
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
            <div className="font-semibold text-gray-900 text-[14px]">Select report period</div>
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
              Pick a date {tempFrom && tempTo ? `— ${fmtRange(tempFrom, tempTo)}` : ''}
            </div>
            <ReportRangeCalendar from={tempFrom} to={tempTo} onChange={(f, t) => { setTempFrom(f); setTempTo(t) }} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button type="button" onClick={() => { const [f, t] = thisMonthRange(); setTempFrom(f); setTempTo(t) }}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Reset to this month
          </button>
          <button type="button" disabled={!tempFrom || !tempTo}
            onClick={() => { onApply(tempFrom, tempTo || tempFrom); onClose() }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 transition-colors disabled:opacity-50">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function DateRangeButton({ from, to, onClick }: { from: string; to: string; onClick: () => void }) {
  const [tmFrom, tmTo] = thisMonthRange()
  const label = from === tmFrom && to === tmTo
    ? 'This month'
    : fmtRange(from, to)

  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors">
      <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  )
}

// ── Sort-by / sort-direction comboboxes — same icon+label dropdown pattern
// used on the Admin Rides/Promos pages' own sort controls, so the Reports
// breakdown table's sorting looks and behaves consistently with the rest
// of Admin. ──
function SortByCombobox({ value, onChange }: { value: SortField; onChange: (v: SortField) => void }) {
  const [open, setOpen] = useState(false)
  const current = SORT_BY_OPTS.find(o => o.value === value) ?? SORT_BY_OPTS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {SORT_BY_OPTS.map(o => (
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

function SortDirCombobox({ value, onChange, disabled }: { value: 'ASC' | 'DESC'; onChange: (v: 'ASC' | 'DESC') => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const current = SORT_DIR_OPTS.find(o => o.value === value) ?? SORT_DIR_OPTS[0]

  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {current.icon}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {SORT_DIR_OPTS.map(o => (
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

// ── Scope combobox — same icon+label dropdown pattern as the sort
// controls, replacing the plain native <select> for "more user
// interactive" filtering. ──
const SCOPE_ICONS: Record<Scope, ReactNode> = {
  All:   <Filter className="w-3.5 h-3.5 text-gray-400" />,
  Ride:  <FerrisWheel className="w-3.5 h-3.5 text-emerald-500" />,
  Promo: <BadgePercent className="w-3.5 h-3.5 text-pink-500" />,
}

function ScopeCombobox({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  const [open, setOpen] = useState(false)
  const current = SCOPE_OPTIONS.find(o => o.value === value) ?? SCOPE_OPTIONS[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {SCOPE_ICONS[current.value]}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {SCOPE_OPTIONS.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === o.value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {SCOPE_ICONS[o.value]}
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Entity combobox — searchable, shows each Attraction/Bundle's own
// rating so an admin can spot the one they want without leaving the
// dropdown. Only ever receives options that already have at least one
// review (see entityOptions in the page component) — an unrated entity
// isn't offered here, matching the breakdown table's own "no reviews,
// don't show it" rule. ──
function EntityCombobox({ scope, options, value, onChange }: {
  scope: 'Ride' | 'Promo'
  options: EntityRating[]
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const allLabel = scope === 'Ride' ? 'All Attractions' : 'All Attraction Bundles'
  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const close = () => { setOpen(false); setQuery('') }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors max-w-[220px]">
        <span className="truncate">{selected ? selected.name : allLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute z-20 mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${scope === 'Ride' ? 'attractions' : 'bundles'}...`}
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              <button type="button" onClick={() => { onChange(undefined); close() }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  value == null ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {allLabel}
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  {options.length === 0 ? 'No reviewed items yet' : 'No matches'}
                </div>
              ) : filtered.map(o => (
                <button key={o.id} type="button" onClick={() => { onChange(o.id); close() }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors truncate ${
                    value === o.id ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminReportsPage() {
  const { user } = useAuth()

  const [scope, setScope] = useState<Scope>('All')
  const [entityId, setEntityId] = useState<number | undefined>(undefined)

  const [[fromDate, toDate], setRange] = useState<[string, string]>(() => thisMonthRange())
  const [dateModalOpen, setDateModalOpen] = useState(false)

  const [trend, setTrend] = useState<RatingTrend | null>(null)
  const [breakdown, setBreakdown] = useState<EntityRating[]>([])
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [loadingBreakdown, setLoadingBreakdown] = useState(true)

  // ── Breakdown table sort + pagination (client-side — the list of
  // Attractions/Bundles is small enough that a second server round trip
  // per sort/page click isn't worth it). ──
  const [sortBy, setSortBy] = useState<SortField>('')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ── Stale-response guards ──────────────────────────────────────────
  // Filters (scope/entity/date range) can change faster than a fetch
  // resolves. Without a guard, an older in-flight request for a wider
  // range can resolve AFTER a newer request for a narrower range and
  // silently overwrite the chart/table with stale data — the period
  // label above (driven straight from state) would then disagree with
  // what the chart/table actually show. Each fetch stamps a request id;
  // only the most recent one is allowed to commit its result.
  const trendRequestId = useRef(0)
  const breakdownRequestId = useRef(0)

  const fetchTrend = async () => {
    const requestId = ++trendRequestId.current
    setLoadingTrend(true)
    // Belt-and-suspenders: drop the previous filter's chart data the
    // instant a new filter is applied, so a spinner (never a stale
    // scopeLabel/points combo) is the only thing that can show while the
    // new request is in flight.
    setTrend(null)
    try {
      const res = await reportApi.getRatingTrend({ scope, id: entityId, fromDate, toDate })
      if (requestId !== trendRequestId.current) return // a newer request superseded this one
      setTrend(res.data?.data ?? null)
    } catch (e: any) {
      if (requestId !== trendRequestId.current) return
      toast.error(e.response?.data?.message ?? 'Failed to load rating trend.')
      setTrend(null)
    } finally {
      if (requestId === trendRequestId.current) setLoadingTrend(false)
    }
  }

  const fetchBreakdown = async () => {
    const requestId = ++breakdownRequestId.current
    setLoadingBreakdown(true)
    try {
      const res = await reportApi.getRatingBreakdown({ fromDate, toDate })
      if (requestId !== breakdownRequestId.current) return
      const data = res.data?.data ?? []
      setBreakdown(Array.isArray(data) ? data : [])
    } catch {
      if (requestId !== breakdownRequestId.current) return
      toast.error('Failed to load rating breakdown.')
    } finally {
      if (requestId === breakdownRequestId.current) setLoadingBreakdown(false)
    }
  }

  useEffect(() => { fetchTrend() }, [scope, entityId, fromDate, toDate])
  useEffect(() => { fetchBreakdown() }, [fromDate, toDate])
  // Any filter/sort change invalidates the current page.
  useEffect(() => { setPage(1) }, [scope, entityId, fromDate, toDate, sortBy, sortDir, pageSize])

  const handleScopeChange = (value: Scope) => {
    setScope(value)
    setEntityId(undefined)
  }

  // Everything matching the scope/entity filter, INCLUDING unrated
  // entities.
  const scopedBreakdown = breakdown.filter(e => {
    if (scope === 'Ride' && e.type !== 'Attraction') return false
    if (scope === 'Promo' && e.type !== 'Attraction Bundle') return false
    if (entityId != null && e.id !== entityId) return false
    return true
  })

  // ✅ CHANGED — an Attraction/Bundle with no reviews yet is dropped
  // entirely from the breakdown table (not shown as a "— / 0 reviews"
  // row). This is the list the table, sorting, pagination, and printable
  // report all actually render.
  const reviewedBreakdown = scopedBreakdown.filter(e => e.reviewCount > 0)

  // Entity filter dropdown options — every Attraction/Bundle of the
  // CURRENT scope that has at least one review, independent of entityId
  // (so picking one doesn't collapse the list down to just itself).
  const entityOptions = breakdown.filter(e =>
    e.reviewCount > 0 && (scope === 'Ride' ? e.type === 'Attraction' : e.type === 'Attraction Bundle')
  )

  // '' ("Sort by default") keeps the backend's own order (highest-rated
  // first) — no client-side re-sort needed for that case.
  const sortedBreakdown = sortBy === ''
    ? reviewedBreakdown
    : [...reviewedBreakdown].sort((a, b) => {
        const cmp = sortBy === 'Name' ? a.name.localeCompare(b.name) : a.averageRating - b.averageRating
        return sortDir === 'ASC' ? cmp : -cmp
      })

  const totalCount = sortedBreakdown.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pagedBreakdown = sortedBreakdown.slice(pageStart, pageStart + pageSize)

  const ratedCount = reviewedBreakdown.length
  const topRated = [...reviewedBreakdown].sort((a, b) => b.averageRating - a.averageRating)[0]

  const periodLabel = fmtRange(fromDate, toDate)
  const generatedAtLabel = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Average visitor ratings by month, attraction, and attraction bundle.</p>
        </div>
        <button onClick={() => window.print()} disabled={loadingTrend || loadingBreakdown}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          <Printer className="w-4 h-4" /> Print report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 sm:px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <ScopeCombobox value={scope} onChange={handleScopeChange} />

        {scope !== 'All' && (
          <EntityCombobox scope={scope as 'Ride' | 'Promo'} options={entityOptions} value={entityId} onChange={setEntityId} />
        )}

        <DateRangeButton from={fromDate} to={toDate} onClick={() => setDateModalOpen(true)} />
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br from-amber-400 to-amber-500">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div className="text-3xl font-bold mb-0.5">{(trend?.overallAverage ?? 0).toFixed(2)}</div>
          <div className="text-white/80 text-xs font-medium">Overall average rating</div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        </div>
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br from-blue-500 to-blue-600">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="text-3xl font-bold mb-0.5">{trend?.overallReviewCount ?? 0}</div>
          <div className="text-white/80 text-xs font-medium">Reviews in period</div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        </div>
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br from-emerald-500 to-green-600">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <div className="text-3xl font-bold mb-0.5">{ratedCount}</div>
          <div className="text-white/80 text-xs font-medium">Rated so far</div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        </div>
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br from-purple-500 to-purple-600">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div className="text-base font-bold mb-0.5 truncate" title={topRated?.name ?? '—'}>{topRated?.name ?? '—'}</div>
          <div className="text-white/80 text-xs font-medium flex items-center gap-1.5">
            {topRated ? <>{topRated.averageRating.toFixed(2)} <Stars value={topRated.averageRating} size={11} /></> : 'No reviews yet'}
          </div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Monthly average rating trend</div>
            <div className="text-xs text-gray-400">{trend?.scopeLabel ?? 'Loading…'} · {periodLabel}</div>
          </div>
        </div>
        <div className="p-5">
          {loadingTrend ? (
            <div className="flex items-center justify-center h-60"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : trend && trend.points.length > 0 ? (
            <RatingTrendChart points={trend.points} />
          ) : (
            <div className="flex items-center justify-center h-60 text-sm text-gray-400">No rating data for this period.</div>
          )}
        </div>
      </div>

      {/* Breakdown table */}
      <Card className="!mb-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Rating breakdown</div>
              <div className="text-xs text-gray-400">Average rating per attraction / bundle, {periodLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SortByCombobox value={sortBy} onChange={setSortBy} />
            <SortDirCombobox value={sortDir} onChange={setSortDir} disabled={sortBy === ''} />
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </div>

        {loadingBreakdown ? (
          <div className="flex items-center justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : pagedBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <ListChecks className="w-12 h-12 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">Nothing to show</div>
            <div className="text-sm mt-1">Try a different filter.</div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {pagedBreakdown.map(e => (
                <div key={`${e.type}-${e.id}`} className="flex items-center gap-4 px-4 sm:px-5 py-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    e.type === 'Attraction' ? 'bg-emerald-50 text-emerald-600' : 'bg-pink-50 text-pink-600'
                  }`}>
                    {e.type === 'Attraction' ? <FerrisWheel className="w-4.5 h-4.5" /> : <BadgePercent className="w-4.5 h-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{e.name}</div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      e.type === 'Attraction' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-pink-50 text-pink-700 border-pink-100'
                    }`}>
                      {e.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Stars value={e.averageRating} />
                    <span className="text-sm font-bold text-gray-900 w-10 text-right">
                      {e.reviewCount > 0 ? e.averageRating.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
                    {e.reviewCount} review{e.reviewCount === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      {dateModalOpen && (
        <ReportDateRangeModal
          from={fromDate} to={toDate}
          onApply={(f, t) => setRange([f, t])}
          onClose={() => setDateModalOpen(false)}
        />
      )}

      {/* ── Printable letterhead report — hidden on screen, shown only when
          printing (see the .af-printable rules in index.css). Everything
          the admin needs for a physical/PDF record: park letterhead with
          logo + address, the filter/period that was applied, the summary
          numbers, the monthly trend (chart + exact table), and the FULL
          (unpaginated) breakdown table, in the same sort order chosen
          on-screen. ── */}
      <div className="af-printable hidden bg-white text-gray-900 p-10">
        <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-6">
          <img src={LOGO_SRC} alt={PARK_NAME} className="w-20 h-20 object-contain flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold tracking-tight">{PARK_NAME}</div>
            <div className="text-xs text-gray-600 mt-0.5">{PARK_ADDRESS}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-lg font-bold uppercase tracking-wide">Attraction &amp; Bundle Rating Report</div>
          <div className="text-xs text-gray-500 mt-1">
            Scope: <strong>{trend?.scopeLabel ?? '—'}</strong> &nbsp;·&nbsp; Period: {periodLabel}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] uppercase text-gray-500 mb-1">Overall Average Rating</div>
            <div className="text-xl font-bold flex items-center gap-2">
              {(trend?.overallAverage ?? 0).toFixed(2)} <Stars value={trend?.overallAverage ?? 0} />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] uppercase text-gray-500 mb-1">Total Reviews</div>
            <div className="text-xl font-bold">{trend?.overallReviewCount ?? 0}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] uppercase text-gray-500 mb-1">Entities Rated</div>
            <div className="text-xl font-bold">{ratedCount}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Monthly Average Rating Trend</div>
          {trend && trend.points.length > 0 && <RatingTrendChart points={trend.points} />}
        </div>

        <table className="w-full text-xs mb-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-1.5">Month</th>
              <th className="text-left py-1.5">Average Rating</th>
              <th className="text-left py-1.5">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {trend?.points.map(p => (
              <tr key={`row-${p.year}-${p.month}`} className="border-b border-gray-100">
                <td className="py-1">{p.monthLabel}</td>
                <td className="py-1">{p.reviewCount > 0 ? p.averageRating.toFixed(2) : '—'}</td>
                <td className="py-1">{p.reviewCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-xs font-semibold uppercase text-gray-500 mb-2">
          Rating Breakdown by {scope === 'Promo' ? 'Attraction Bundle' : scope === 'Ride' ? 'Attraction' : 'Attraction / Bundle'}
          {sortBy !== '' && ` (sorted by ${SORT_BY_OPTS.find(o => o.value === sortBy)?.label}, ${sortDir === 'ASC' ? 'ascending' : 'descending'})`}
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-1.5">Name</th>
              <th className="text-left py-1.5">Type</th>
              <th className="text-left py-1.5">Average Rating</th>
              <th className="text-left py-1.5">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {sortedBreakdown.map(e => (
              <tr key={`print-${e.type}-${e.id}`} className="border-b border-gray-100">
                <td className="py-1">{e.name}</td>
                <td className="py-1">{e.type}</td>
                <td className="py-1">{e.reviewCount > 0 ? e.averageRating.toFixed(2) : '—'}</td>
                <td className="py-1">{e.reviewCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-12 mt-14 mb-2">
          <div>
            {/* Blank on purpose — reserved for an actual pen signature. */}
            <div className="border-b border-gray-800 h-10" />
            <div className="text-xs font-semibold text-gray-900 mt-1">{user?.fullName ?? ' '}</div>
            <div className="text-[10px] text-gray-500">Prepared by</div>
          </div>
          <div>
            <div className="border-b border-gray-800 h-10" />
            <div className="text-xs font-semibold text-gray-900 mt-1">&nbsp;</div>
            <div className="text-[10px] text-gray-500">Verified by</div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400">
          <div className="flex items-center justify-between">
            <span>{PARK_NAME} — Internal Report, Confidential</span>
            <span>Auto-generated by AmuseFlow System</span>
          </div>
          <div className="text-center mt-1">Generated: {generatedAtLabel} &nbsp;·&nbsp; By: {user?.fullName ?? 'Admin'}</div>
        </div>
      </div>
    </div>
  )
}
