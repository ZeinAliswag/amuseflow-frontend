import { useEffect, useState } from 'react'
import {
  ClipboardList, Filter, X, Clock, User, Tag, FileText,
 Calendar, Ticket, UserCog, Search, ChevronLeft, ChevronRight, CalendarDays, ChevronDown,
  FerrisWheel, Shield, HardHat, UserRound
} from 'lucide-react'
import type { ActivityLog, PaginationRequest } from '../../types'
import api from '../../services/api'
import toast from 'react-hot-toast'

const MODULE_OPTS = ['Ride', 'Schedule', 'Booking', 'User']

const moduleColor = (m: string) => {
  if (m === 'Ride')     return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', line: 'bg-purple-200', solid: 'bg-purple-500' }
  if (m === 'Schedule') return { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  line: 'bg-amber-200', solid: 'bg-amber-500' }
  if (m === 'Booking')  return { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500',  line: 'bg-green-200', solid: 'bg-green-500' }
  if (m === 'User')     return { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500',   line: 'bg-blue-200', solid: 'bg-blue-500' }
  return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400', line: 'bg-gray-200', solid: 'bg-gray-400' }
}

function ModuleIcon({ m, size = 'sm' }: { m: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  if (m === 'Ride')     return <FerrisWheel   className={`${cls} text-purple-600`} />
  if (m === 'Schedule') return <Calendar className={`${cls} text-amber-600`} />
  if (m === 'Booking')  return <Ticket   className={`${cls} text-green-600`} />
  if (m === 'User')     return <UserCog  className={`${cls} text-blue-600`} />
  return <ClipboardList className={`${cls} text-gray-500`} />
}

// ✅ NEW — role palette, tied to the same accent colors as each role's own
// portal (Visitor portal = emerald, Ride Attendant portal = amber) so the
// admin Logs page reads consistently with the rest of the app. Admin = indigo.
const roleColor = (r?: string | null) => {
  if (r === 'Admin')          return { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200' }
  if (r === 'Ride Attendant') return { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200' }
  if (r === 'Visitor')        return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
  return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' }
}

function RoleIcon({ r, size = 'sm' }: { r?: string | null; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  if (r === 'Admin')          return <Shield    className={`${cls} text-indigo-600`} />
  if (r === 'Ride Attendant') return <HardHat   className={`${cls} text-amber-600`} />
  if (r === 'Visitor')        return <UserRound className={`${cls} text-emerald-600`} />
  return <User className={`${cls} text-gray-400`} />
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

// ── Module Filter — native combobox ────────────────────────────────
function ModuleCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = value || 'All modules'

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {value ? <ModuleIcon m={value} /> : <Filter className="w-3.5 h-3.5 text-gray-400" />}
        {label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                !value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              All modules
            </button>
            {MODULE_OPTS.map(m => (
              <button key={m} type="button"
                onClick={() => { onChange(m); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === m ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <ModuleIcon m={m} />
                {m}
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

// ── View Log Modal ─────────────────────────────────────────────
function LogModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const c = moduleColor(log.module)
  const role = log.role

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.bg} ${c.border}`}>
              <ModuleIcon m={log.module} size="lg" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-[13px]">Activity Detail</div>
              <div className="text-[10px] text-gray-400">Log #{log.id}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className={`flex items-center gap-2 p-3 rounded-xl border ${c.bg} ${c.border}`}>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
              <ModuleIcon m={log.module} /> {log.module}
            </span>
            <span className={`text-[12px] font-bold ${c.text}`}>{log.action}</span>
            {role && (
              <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleColor(role).bg} ${roleColor(role).text} ${roleColor(role).border}`}>
                <RoleIcon r={role} /> {role}
              </span>
            )}
          </div>
          {[
            { icon: <User className="w-3.5 h-3.5 text-indigo-600" />, bg: 'bg-indigo-50', label: 'Performed by', value: log.userName ?? 'System' },
            { icon: <Clock className="w-3.5 h-3.5 text-rose-600" />, bg: 'bg-rose-50', label: 'Timestamp', value: new Date(log.createdAt).toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
            { icon: <Tag className="w-3.5 h-3.5 text-cyan-600" />, bg: 'bg-cyan-50', label: 'Module', value: log.module },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg ${row.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>{row.icon}</div>
              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{row.label}</div>
                <div className="text-[12px] text-gray-900 font-medium">{row.value}</div>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Details</div>
              <div className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                {log.details ?? 'No additional details recorded.'}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[12px] font-medium hover:bg-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Group logs by date ─────────────────────────────────────────
function groupByDate(logs: ActivityLog[]) {
  const groups: Record<string, ActivityLog[]> = {}
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(log)
  })
  return groups
}

export default function AdminLogsPage() {
  const [logs, setLogs]             = useState<ActivityLog[]>([])
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 20 })
  const [params, setParams]         = useState<PaginationRequest>({ page: 1, pageSize: 20, search: '' })
  const [moduleFilter, setModuleFilter] = useState('')
  // ✅ UPDATED — locked to "Admin", no UI control to change it. This page is
  // Admin activity only — every admin's actions, never filtered down to
  // just the logged-in one — with no way to switch to Ride Attendant or
  // Visitor here (that's covered by their own portal's Activity logs panel).
  const roleFilter = 'Admin'
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [viewLog, setViewLog]       = useState<ActivityLog | null>(null)
  const [search, setSearch]         = useState('')

  useEffect(() => { fetchLogs() }, [params, moduleFilter, dateFrom, dateTo])

  // ✅ FIXED — moduleFilter used to be glued onto the search string
  // (`[params.search, moduleFilter].join(' ')`), which the backend matched
  // with a single LIKE '%...%' across Action/Module/Details/Username. That
  // meant a module filter could pull in unrelated rows whose Action/Details/
  // Username text merely contained the module name, and combining a typed
  // search term with a module filter at the same time broke matching
  // entirely (no single column contains both substrings glued together).
  // Module is now sent as its own query param and matched with exact
  // equality server-side (see ActivityLogFilterRequest.Module).
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/activitylog', {
        params: {
          ...params,
          module: moduleFilter || undefined,
          // sent as its own param (backend's ActivityLogFilterRequest.Role),
          // not folded into the free-text search.
          role: roleFilter || undefined,
          fromDate: dateFrom || undefined,
          toDate: dateTo || undefined,
        }
      })
      const d = res.data?.data ?? res.data
      let list: ActivityLog[] = Array.isArray(d) ? d : (d?.data ?? [])
      // client-side fallback filter in case the API doesn't support fromDate/toDate yet
      if (dateFrom) list = list.filter(l => new Date(l.createdAt) >= new Date(dateFrom))
      if (dateTo)   list = list.filter(l => new Date(l.createdAt) <= new Date(`${dateTo}T23:59:59`))
      setLogs(list)
      const pg = res.data?.pagination ?? d?.pagination
      if (pg) setPagination(pg)
    } catch { toast.error('Failed to load activity logs.') }
    finally { setLoading(false) }
  }

  const grouped = groupByDate(logs)



  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity logs</h1>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <span className="text-sm text-gray-500">Admin activity only — every admin, not filtered down to just you.</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-5 py-4 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input value={search}
            onChange={e => { setSearch(e.target.value); setParams(p => ({ ...p, search: e.target.value, page: 1 })) }}
            placeholder="Search actions or users..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-52 bg-gray-50" />
        </div>

        {/* Module filter — combobox */}
        <ModuleCombobox
          value={moduleFilter}
          onChange={v => { setModuleFilter(v); setParams(p => ({ ...p, page: 1 })) }}
        />

        {/* Date range — opens a centered modal, no dropdown */}
        <DateRangeButton
          from={dateFrom} to={dateTo}
          onClick={() => setDateModalOpen(true)}
        />
      </div>

      {/* Feed */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ClipboardList className="w-16 h-16 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">No activity logs found</div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {Object.entries(grouped).map(([date, dateLogs]) => (
                <div key={date}>
                  {/* Date header */}
                  <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{date}</span>
                    </div>
                  </div>

                  {/* Feed items */}
                  <div className="px-4 sm:px-6 py-2">
                    {dateLogs.map((log, idx) => {
                      const c = moduleColor(log.module)
                      const role = log.role
                      const rc = roleColor(role)
                      return (
                        <div key={log.id}
                          className="relative flex gap-4 py-3.5 cursor-pointer group"
                          onClick={() => setViewLog(log)}>
                          {/* Timeline line */}
                          {idx < dateLogs.length - 1 && (
                            <div className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${c.line}`} />
                          )}

                          {/* Module icon dot */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm z-10 ${c.bg}`}>
                            <ModuleIcon m={log.module} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 group-hover:bg-gray-50 rounded-xl px-3 py-2 transition-colors -mx-3">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
                                    <ModuleIcon m={log.module} /> {log.module}
                                  </span>
                                  {role && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${rc.bg} ${rc.text} ${rc.border}`}>
                                      <RoleIcon r={role} /> {role}
                                    </span>
                                  )}
                                  <span className="text-[13px] font-semibold text-gray-900">{log.action}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate max-w-md">{log.details ?? 'No details'}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                    <User className="w-3 h-3" />
                                    <span>{log.userName ?? 'System'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(log.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                                <span className="text-[10px] text-blue-500 font-medium sm:opacity-0 sm:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  View →
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> · <strong>{pagination.totalCount}</strong> entries
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(params.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const cur = params.page ?? 1
                  const start = Math.max(1, cur - 2)
                  return start + i
                }).filter(p => p <= pagination.totalPages).map(p => (
                  <button key={p} onClick={() => setParams(prev => ({ ...prev, page: p }))}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                      p === (params.page ?? 1) ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                    }`}>{p}</button>
                ))}
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(params.page ?? 1) >= pagination.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <select value={params.pageSize ?? 20}
                onChange={e => setParams(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none">
                {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {viewLog && <LogModal log={viewLog} onClose={() => setViewLog(null)} />}

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
