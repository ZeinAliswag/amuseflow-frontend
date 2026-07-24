import { useEffect, useState } from 'react'
import {
  Bell, CheckCheck, X, Calendar, Ticket,
  Search, ChevronLeft, ChevronRight, CalendarDays, ChevronDown,
  Shield, HardHat, UserRound, User as UserIcon,
  XCircle, Wallet, PartyPopper
} from 'lucide-react'
import type { Notification, PaginationRequest } from '../../types'
import { notificationApi } from '../../services/api'
import toast from 'react-hot-toast'

const READ_OPTS = [
  { label: 'Unread', value: 'false' },
  { label: 'Read', value: 'true' },
]

// ── Visual identity per notification, based on its title/module — same
// logic as the header bell's getNotificationVisual, so the module page and
// the dropdown read consistently. ──
function getNotificationVisual(n: Notification) {
  const t = n.title.toLowerCase()
  if (t.includes('reject') || t.includes('cancel'))
    return { Icon: XCircle, bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500' }
  if (t.includes('paid') || t.includes('payment'))
    return { Icon: Wallet, bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-500' }
  if (t.includes('approved') || t.includes('reopened'))
    return { Icon: PartyPopper, bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' }
  if (n.module === 'Schedule' || t.includes('schedule'))
    return { Icon: Calendar, bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' }
  return { Icon: Ticket, bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' }
}

const roleColor = (r?: string | null) => {
  if (r === 'Admin')          return { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200' }
  if (r === 'Ride Attendant') return { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200' }
  if (r === 'Visitor')        return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
  return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' }
}

function RoleIcon({ r }: { r?: string | null }) {
  const cls = 'w-3.5 h-3.5'
  if (r === 'Admin')          return <Shield    className={`${cls} text-indigo-600`} />
  if (r === 'Ride Attendant') return <HardHat   className={`${cls} text-amber-600`} />
  if (r === 'Visitor')        return <UserRound className={`${cls} text-emerald-600`} />
  return <UserIcon className={`${cls} text-gray-400`} />
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

// ── Generic combobox — reused for Module / Read-status / Role filters ──
function FilterCombobox({ label, value, options, onChange, icon }: {
  label: string; value: string; options: { label: string; value: string }[]
  onChange: (v: string) => void; icon: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)?.label ?? label

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {icon}
        {current}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                !value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              {label}
            </button>
            {options.map(o => (
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

// ── Month/Year dropdown ──────────────────────────────────────────
function MonthYearDropdown({ year, month, onChange, onClose }: {
  year: number; month: number
  onChange: (year: number, month: number) => void
  onClose: () => void
}) {
  const [viewYear, setViewYear] = useState(year)
  const today = new Date()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
                  isSelected ? 'bg-gray-800 text-white shadow-sm'
                    : isCurrent ? 'bg-gray-100 text-gray-700 border border-gray-200'
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
  const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
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
                  isStart || isEnd ? 'bg-gray-800 text-white font-bold shadow-sm'
                    : inRange ? 'bg-gray-100 text-gray-700 font-medium'
                    : isToday ? 'border border-gray-400 text-gray-700 font-semibold'
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

function groupByDate(list: Notification[]) {
  const groups: Record<string, Notification[]> = {}
  list.forEach(n => {
    const date = new Date(n.createdAt).toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(n)
  })
  return groups
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 20 })
  const [params, setParams]         = useState<PaginationRequest>({ page: 1, pageSize: 20, search: '' })
  const [readFilter, setReadFilter]     = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { fetchNotifications(); fetchUnreadCount() }, [params, readFilter, dateFrom, dateTo])

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationApi.getTotalUnreadCount()
      setUnreadCount(res.data?.data ?? 0)
    } catch { /* silent */ }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationApi.getAllAdmin({
        ...params,
        isRead: readFilter || undefined,
        fromDate: dateFrom || undefined,
        toDate: dateTo || undefined,
        // ✅ Locked — this page only ever shows a visitor cancelling their
        // own booking ("Booking cancelled"), no toggle to see anything else.
        cancelledOnly: true,
      })
      const d = res.data?.data ?? res.data
      const list: Notification[] = Array.isArray(d) ? d : (d?.data ?? [])
      setNotifications(list)
      const pg = res.data?.pagination ?? d?.pagination
      if (pg) setPagination(pg)
    } catch { toast.error('Failed to load notifications.') }
    finally { setLoading(false) }
  }

  const handleMarkRead = async (n: Notification) => {
    if (n.isRead) return
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
    setUnreadCount(c => Math.max(0, c - 1))
    try { await notificationApi.markAsRead(n.id) } catch { fetchNotifications() }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    setMarkingAll(true)
    try {
      await notificationApi.markAllAsReadGlobal()
      toast.success('All notifications marked as read.')
      setNotifications(prev => prev.map(x => ({ ...x, isRead: true })))
      setUnreadCount(0)
    } catch { toast.error('Failed to mark all as read.') }
    finally { setMarkingAll(false) }
  }

  const grouped = groupByDate(notifications)

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Booking cancellations only — every visitor who cancelled their own booking.
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {/* Filters — floating pill bar, not a bordered table toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input value={search}
            onChange={e => { setSearch(e.target.value); setParams(p => ({ ...p, search: e.target.value, page: 1 })) }}
            placeholder="Search by visitor, ride, or title..."
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-64 bg-white shadow-sm" />
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-1.5 py-1 shadow-sm">
          <FilterCombobox
            label="All statuses"
            value={readFilter}
            options={READ_OPTS}
            onChange={v => { setReadFilter(v); setParams(p => ({ ...p, page: 1 })) }}
            icon={<Bell className="w-3.5 h-3.5 text-gray-400" />}
          />
          <div className="w-px h-5 bg-gray-200" />
          <DateRangeButton
            from={dateFrom} to={dateTo}
            onClick={() => setDateModalOpen(true)}
          />
        </div>
      </div>

      {/* Feed — standalone cards on the page background, grouped by day */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <Bell className="w-8 h-8 text-gray-300" />
          </div>
          <div className="font-semibold text-gray-500">No cancellations found</div>
          <div className="text-xs mt-1">Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dateNotifs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="space-y-3">
                  {dateNotifs.map(n => {
                    const v = getNotificationVisual(n)
                    const rc = roleColor(n.recipientRole)
                    return (
                      <div key={n.id} onClick={() => handleMarkRead(n)}
                        className={`group relative flex items-start gap-4 rounded-2xl border px-5 py-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                          !n.isRead ? `bg-white ${v.border} shadow-sm` : 'bg-gray-50/70 border-gray-100'
                        }`}>
                        {!n.isRead && (
                          <span className={`absolute -left-1.5 top-5 w-3 h-3 rounded-full ${v.dot} ring-4 ring-white`} />
                        )}

                        <div className={`w-12 h-12 rounded-2xl ${v.bg} flex items-center justify-center flex-shrink-0`}>
                          <v.Icon className={`w-5 h-5 ${v.text}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${rc.bg} ${rc.text} ${rc.border}`}>
                              <RoleIcon r={n.recipientRole} /> {n.recipientName ?? 'Unknown'}
                            </span>
                            <span className="text-[11px] text-gray-400">@{n.recipientUsername}</span>
                            {!n.isRead && (
                              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold uppercase tracking-wide">New</span>
                            )}
                          </div>
                          <p className={`text-sm ${!n.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-600'}`}>{n.title}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{n.message}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                          {!n.isRead ? (
                            <span className="text-[10px] text-blue-500 font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to mark read
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                              <CheckCheck className="w-2.5 h-2.5 text-emerald-600" />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination — standalone floating bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm flex-wrap gap-2">
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
