import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, ChevronDown, History, KeyRound, X, Loader2,
  Calendar, CheckCircle2, Filter,
  Circle, Pencil, Lock, Ticket, UserCog, ClipboardList,
  Search, ChevronLeft, ChevronRight, CalendarDays, Tag, FileText, User, Clock
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import type { ActivityLog } from '../../types'

// Formats digits as the Filipino mobile style: 09XX XXX XXXX
function formatPHMobile(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean)
  return parts.join(' ')
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${color}`}>
      {initials}
    </div>
  )
}

// ── Logout Confirm Modal ────────────────────────────────────────────
function LogoutConfirmModal({ loading, onConfirm, onCancel }: {
  loading: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <LogOut className="w-6 h-6" />
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">Sign out?</div>
        <div className="text-[12px] text-gray-500 mb-6">Are you sure you want to log out of your account?</div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors bg-red-600 hover:bg-red-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><LogOut className="w-4 h-4" /> Yes, sign out</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Change Password Modal — self-service, all roles ────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [initialContactNumber, setInitialContactNumber] = useState(formatPHMobile(user?.contactNumber ?? ''))
  const [contactNumber, setContactNumber] = useState(initialContactNumber)
  const [saving, setSaving] = useState(false)

  const [contactLocked, setContactLocked] = useState(initialContactNumber.replace(/\D/g, '').length > 0)

  const [loadingContact, setLoadingContact] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/user/me/contact-number')
        const raw = res.data?.data?.contactNumber ?? res.data?.contactNumber ?? ''
        const formatted = formatPHMobile(raw ?? '')
        if (!cancelled) {
          setInitialContactNumber(formatted)
          setContactNumber(formatted)
          setContactLocked(formatted.replace(/\D/g, '').length > 0)
        }
      } catch {
        // Silent — falls back to whatever was already seeded from the auth context.
      } finally {
        if (!cancelled) setLoadingContact(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const checks = [
    { label: '8+ characters', ok: newPassword.length >= 8 },
    { label: '1 uppercase (A-Z)', ok: /[A-Z]/.test(newPassword) },
    { label: '1 number (0-9)', ok: /[0-9]/.test(newPassword) },
    { label: '1 special (@$!%*?&)', ok: /[@$!%*?&]/.test(newPassword) },
  ]

  const isChangingPassword = newPassword.length > 0 || confirmPassword.length > 0
  const isChangingContact = !contactLocked && contactNumber.replace(/\D/g, '') !== initialContactNumber.replace(/\D/g, '')
  const hasChanges = isChangingPassword || isChangingContact

  const savePasswordLabel = isChangingPassword && isChangingContact
    ? 'Update password & contact'
    : isChangingPassword
    ? 'Update password'
    : isChangingContact
    ? 'Update contact number'
    : 'No changes to save'

  const handleSave = async () => {
    if (!hasChanges) {
      toast('No changes to save.')
      return
    }
    if (isChangingContact) {
      const contactDigits = contactNumber.replace(/\D/g, '')
      if (!/^09\d{9}$/.test(contactDigits)) {
        toast.error('Enter a valid PH mobile number (e.g. 0912 345 6789).')
        return
      }
    }
    if (isChangingPassword) {
      if (!checks.every(c => c.ok)) { toast.error('Password does not meet all requirements.'); return }
      if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return }
    }
    setSaving(true)
    try {
      const res = await api.put('/api/user/me/password', {
        ...(isChangingPassword ? { newPassword, confirmPassword } : {}),
        contactNumber: contactNumber.replace(/\D/g, ''),
      })
      toast.success(res.data?.message ?? 'Updated successfully.')
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to save changes.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-gray-600" />
            </div>
            <div className="font-bold text-gray-900 text-[14px]">Change password</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-700">Contact number</label>
              {contactLocked && (
                <button type="button" onClick={() => setContactLocked(false)}
                  className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            <div className="relative">
              <input value={loadingContact ? '' : contactNumber} inputMode="numeric" maxLength={13}
                disabled={contactLocked || loadingContact}
                onChange={e => setContactNumber(formatPHMobile(e.target.value))}
                placeholder={loadingContact ? 'Loading…' : '0912 345 6789'}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${
                  contactLocked || loadingContact ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed pr-9' : 'border-gray-300'
                }`} />
              {loadingContact ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 animate-spin pointer-events-none" />
              ) : contactLocked && (
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              )}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {loadingContact
                ? 'Fetching your saved contact number…'
                : contactLocked ? 'Your contact number is on file. Tap Edit to change it.' : 'Enter your new contact number.'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
          {checks.map(c => (
            <span key={c.label} className={`flex items-center gap-1 ${c.ok ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
              {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 flex-shrink-0" />} {c.label}
            </span>
          ))}
          </div>
          <div className="text-[10px] text-gray-400">Leave password fields blank if you only want to update your contact number.</div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors flex-shrink-0">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loadingContact || !hasChanges}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-full text-[13px] font-medium text-white bg-gray-800 hover:bg-gray-900 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 whitespace-nowrap">
            {saving ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <KeyRound className="w-4 h-4 flex-shrink-0" />}
            {!saving && savePasswordLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Mini Activity Panel — backed by the REAL GET /api/activitylog endpoint
// (same one the admin Logs page uses). Header filter bar (search + module
// combobox + date range) and the click-to-view Activity Detail modal are
// deliberately styled/behave the same as Logs.tsx so it reads as the same
// feature, just scoped to "my activity" (backend auto-scopes non-admins). ──

// ✅ Same fixed module list as the admin Logs page (Logs.tsx's MODULE_OPTS),
// instead of deriving options from whatever modules happen to appear in the
// currently-loaded `logs` list. That dynamic approach was the bug: options
// were computed from the (already filtered) results, so picking "Booking"
// shrank `logs` down to Booking-only entries, which in turn made "User"
// vanish from the dropdown itself — filtering one module made every other
// module look like it no longer existed as a choice.
const MODULE_OPTS = ['Booking', 'User']

// Matches the palette used on the admin Logs page (Logs.tsx).
const moduleColor = (m: string) => {
  if (m === 'Booking')  return { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' }
  if (m === 'User')     return { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' }
  return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
}

function ModuleIcon({ m, size = 'sm' }: { m: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  if (m === 'Booking')  return <Ticket        className={`${cls} text-green-600`} />
  if (m === 'User')     return <UserCog       className={`${cls} text-blue-600`} />
  return <ClipboardList className={`${cls} text-gray-500`} />
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function groupLogsByDate(logs: ActivityLog[]) {
  const groups: Record<string, ActivityLog[]> = {}
  logs.forEach(log => {
    const label = new Date(log.createdAt).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(log)
  })
  return groups
}

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

// ── Module Filter — native combobox, same look as the admin Logs page ──
function ModuleCombobox({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
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
          <div className="fixed inset-0 z-[105]" onClick={() => setOpen(false)} />
          <div className="absolute z-[106] mt-1 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                !value ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              All modules
            </button>
            {options.map(m => (
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

// ── Mini Calendar — same restyled month grid as the admin Logs page ──
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function MonthYearDropdown({ year, month, onChange, onClose }: {
  year: number; month: number
  onChange: (year: number, month: number) => void
  onClose: () => void
}) {
  const [viewYear, setViewYear] = useState(year)
  const today = new Date()

  return (
    <>
      <div className="fixed inset-0 z-[130]" onClick={onClose} />
      <div className="absolute z-[131] mt-2 left-1/2 -translate-x-1/2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
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

      {/* Footer — single full-width pill */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={gotoToday}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Jump to today
        </button>
      </div>
    </div>
  )
}

// ── Date Range Modal — same centered dialog as the admin Logs page, bumped
// to z-[120] since it now nests inside the z-[100] activity panel. ──
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
    <div className="fixed inset-0 bg-black/40 z-[120] flex items-center justify-center p-4"
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

// ── Date Range Trigger Button — same style as the admin Logs page ──
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

// ── Activity Detail modal — same layout/copy as the admin Logs page's
// LogModal, nested above the panel at z-[110]. ──
function ActivityDetailModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const c = moduleColor(log.module)
  return (
    <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4"
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

function MiniActivityPanel({ role, onClose }: { role: 'Visitor' | 'Ride Attendant'; onClose: () => void }) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [viewLog, setViewLog] = useState<ActivityLog | null>(null)

  useEffect(() => { fetchLogs() }, [search, moduleFilter, dateFrom, dateTo])

  // Module is sent as its own query param and matched with exact equality
  // server-side (see ActivityLogFilterRequest.Module) — not folded into the
  // free-text search.
  const fetchLogs = async () => {
    setLoading(true)
    try {
      // ✅ Real data — same endpoint as the admin Logs page. The backend
      // ignores any role/userId a non-admin sends and forces it to their own
      // account, so this is always "my activity" here.
      const res = await api.get('/api/activitylog', {
        params: {
          page: 1,
          pageSize: 30,
          search: search || undefined,
          module: moduleFilter || undefined,
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
    } catch {
      // Silent — panel just shows the empty state below.
    } finally {
      setLoading(false)
    }
  }

  const grouped = groupLogsByDate(logs)

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <History className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-[14px]">Activity logs</div>
              <div className="text-[11px] text-gray-400">
                {role === 'Visitor' ? 'Your recent bookings & account activity' : 'Your recent check-ins & account activity'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar — search + module combobox + date range, same as the admin Logs page */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-white flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search actions..."
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 w-full bg-gray-50" />
          </div>
          {/* ✅ FIXED — now uses the same fixed MODULE_OPTS list as the admin
              Logs page instead of options derived from the current `logs`
              result set. Previously, filtering to "Booking" shrank `logs`
              down to Booking-only rows, and since the dropdown's options were
              computed from that same shrunken list, "User" disappeared from
              the dropdown itself the moment you filtered — you couldn't even
              switch back to it without clearing the filter first. */}
          <ModuleCombobox value={moduleFilter} options={MODULE_OPTS} onChange={setModuleFilter} />
          <DateRangeButton from={dateFrom} to={dateTo} onClick={() => setDateModalOpen(true)} />
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <History className="w-10 h-10 mb-2 text-gray-200" />
              <div className="text-sm">No activity found</div>
            </div>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                {/* Date header — matches the admin Logs page's date group bar */}
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{date}</span>
                  </div>
                </div>
                <div className="px-2 py-1">
                  {items.map(log => {
                    const c = moduleColor(log.module)
                    return (
                      <div key={log.id}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                        onClick={() => setViewLog(log)}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${c.bg}`}>
                          <ModuleIcon m={log.module} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
                              {log.module}
                            </span>
                            <span className="text-[13px] font-semibold text-gray-900">{log.action}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">{log.details ?? 'No details'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                          <span className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            View →
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {viewLog && <ActivityDetailModal log={viewLog} onClose={() => setViewLog(null)} />}
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

function PortalHeader({
  portalLabel, portalIcon, accentColor, avatarColor, roleLabel, roleBadgeColor, children,
  iconWrapperClassName = 'w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center'
}: {
  portalLabel: string
  portalIcon: ReactNode
  accentColor: string
  avatarColor: string
  roleLabel: string
  roleBadgeColor: string
  children: ReactNode
  iconWrapperClassName?: string
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const res = await api.post('/api/auth/logout')
      logout()
      navigate('/login')
      toast.success(res.data?.message ?? 'Signed out successfully.')
    } catch (e: any) {
      logout()
      navigate('/login')
      toast.success(e.response?.data?.message ?? 'Signed out successfully.')
    } finally {
      setLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className={`${accentColor} sticky top-0 z-30 shadow-sm w-full`}>
        <div className="px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className={iconWrapperClassName}>
              {portalIcon}
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">Gloria's Fantasyland</p>
              <p className="text-white/70 text-xs">{portalLabel}</p>
            </div>
          </div>

          {/* User menu */}
          <div className="relative">
            <button onClick={() => setOpen(!open)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-all border border-white/20">
              <Avatar initials={user?.initials ?? '?'} color={avatarColor} />
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-white leading-tight">{user?.fullName}</p>
                <p className="text-white/60 text-[10px]">@{user?.username}</p>
              </div>
              <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${roleBadgeColor}`}>
                {roleLabel}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl w-64 z-50 overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${avatarColor}`}>
                        {user?.initials ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{user?.fullName}</p>
                        <p className="text-xs text-gray-400 truncate">@{user?.username}</p>
                        <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadgeColor}`}>
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Activity */}
                  <button onClick={() => { setShowActivity(true); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <History className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    Activity logs
                  </button>

                  {/* Change password */}
                  <button onClick={() => { setShowPasswordModal(true); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <KeyRound className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    Change password
                  </button>

                  {/* Sign out */}
                  <button onClick={() => { setShowLogoutConfirm(true); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border-t border-gray-100">
                    <LogOut className="w-4 h-4 text-red-600" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>

      {showActivity && (
        <MiniActivityPanel
          role={roleLabel === 'Visitor' ? 'Visitor' : 'Ride Attendant'}
          onClose={() => setShowActivity(false)}
        />
      )}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
      {showLogoutConfirm && (
        <LogoutConfirmModal
          loading={loggingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  )
}

export function VisitorLayout({ children }: { children: ReactNode }) {
  return (
    <PortalHeader
      portalLabel="Visitor Portal"
      portalIcon={<img src="/images__6_-removebg-preview.png" alt="Gloria's Fantasyland" className="w-14 h-14 object-contain" />}
      iconWrapperClassName="w-14 h-14 flex items-center justify-center"
      accentColor="bg-emerald-600"
      avatarColor="bg-emerald-700"
      roleLabel="Visitor"
      roleBadgeColor="bg-emerald-700/50 text-white">
      {children}
    </PortalHeader>
  )
}

export function AttendantLayout({ children }: { children: ReactNode }) {
  return (
    <PortalHeader
      portalLabel="Ride Attendant Portal"
      portalIcon={<img src="/images__6_-removebg-preview.png" alt="Gloria's Fantasyland" className="w-14 h-14 object-contain" />}
      iconWrapperClassName="w-14 h-14 flex items-center justify-center"
      accentColor="bg-amber-600"
      avatarColor="bg-amber-700"
      roleLabel="Ride Attendant"
      roleBadgeColor="bg-amber-700/50 text-white">
      {children}
    </PortalHeader>
  )
}
