import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'

// ── Badge ─────────────────────────────────────────────────────
const badgeColors: Record<string, string> = {
  Pending:    'bg-amber-100 text-amber-800',
  Approved:   'bg-green-100 text-green-800',
  Rejected:   'bg-red-100 text-red-800',
  Cancelled:  'bg-gray-100 text-gray-700',
  Completed:  'bg-blue-100 text-blue-800',
  Open:       'bg-green-100 text-green-800',
  Full:       'bg-red-100 text-red-800',
  Paid:       'bg-green-100 text-green-800',
  Unpaid:     'bg-amber-100 text-amber-800',
  Active:     'bg-green-100 text-green-800',
  Inactive:   'bg-gray-100 text-gray-700',
  Admin:      'bg-blue-100 text-blue-800',
  Visitor:    'bg-emerald-100 text-emerald-800',
  'Ride Attendant': 'bg-amber-100 text-amber-800',
}

export function Badge({ label }: { label: string }) {
  const cls = badgeColors[label] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const btnVariants = {
  primary:   'bg-primary-300 hover:bg-primary-400 text-white border-transparent',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300',
  danger:    'bg-red-600 hover:bg-red-700 text-white border-transparent',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-600 border-transparent',
  success:   'bg-green-600 hover:bg-green-700 text-white border-transparent',
}

const btnSizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, className = '', ...props
}: BtnProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 font-medium rounded-lg border transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Input({ label, error, leftIcon, rightIcon, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          className={`w-full border rounded-lg py-2.5 text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent
            transition-all
            ${leftIcon ? 'pl-10' : 'pl-3'}
            ${rightIcon ? 'pr-10' : 'pr-3'}
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}
            ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ label, value, icon, color = 'green' }: {
  label: string; value: number | string; icon: ReactNode; color?: string
}) {
  const colors: Record<string, string> = {
    green:  'bg-primary-50 text-primary-400',
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray:   'bg-gray-100 text-gray-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        </div>
      </div>
    </Card>
  )
}

// ── Loading spinner ───────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-primary-300 ${className}`} />
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ icon, title, description }: {
  icon: ReactNode; title: string; description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-300 mb-3">{icon}</div>
      <p className="text-gray-500 font-medium">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
    </div>
  )
}

// ── Search Input ─────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
      />
    </div>
  )
}

// ── Filter Pill ──────────────────────────────────────────────
export function FilterPill({ active, activeClass, onClick, children }: {
  active: boolean; activeClass: string; onClick: () => void; children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${active ? activeClass : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

// ── Avatar ───────────────────────────────────────────────────
export function Avatar({ initials, size = 8 }: { initials: string; size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold" style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem`, fontSize: `${Math.max(10, size * 1.2)}px` }}>
      {initials}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────
export function Pagination({
  page, totalPages, totalCount, pageSize, onPage
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize?: (s: number) => void
}) {
  const from = Math.min((page - 1) * pageSize + 1, totalCount)
  const to   = Math.min(page * pageSize, totalCount)

  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{from}–{to}</span> of{' '}
        <span className="font-medium">{totalCount}</span> results
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >‹</button>
        {start > 1 && <span className="px-2 text-gray-400 text-sm">…</span>}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`px-3 py-1 rounded text-sm font-medium transition-all
              ${p === page
                ? 'bg-primary-300 text-white'
                : 'text-gray-600 hover:bg-gray-100'}`}
          >{p}</button>
        ))}
        {end < totalPages && <span className="px-2 text-gray-400 text-sm">…</span>}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >›</button>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open = true, onClose, title, children, size = 'md' }: {
  open?: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ headers, children, className = '' }: {
  headers: string[]; children: ReactNode; className?: string
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}

// ── Search Bar ────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
      />
    </div>
  )
}
