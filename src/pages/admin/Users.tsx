import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, UserCheck, UserX, Users, Filter,
  Shield, Key, CheckCircle2, Lock, UserCog, Loader2, ChevronDown, Phone
} from 'lucide-react'
import type { User, PagedResponse, PaginationRequest } from '../../types'
import api from '../../services/api'
import {
  Card, Modal, SearchBar
} from '../../components/shared'
import toast from 'react-hot-toast'

const ROLES = ['Visitor', 'Admin', 'Ride Attendant']

// Formats digits as the Filipino mobile style: 09XX XXX XXXX
function formatPHMobile(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean)
  return parts.join(' ')
}
const STATUS_FILTER_OPTS = [
  { label: 'All users',   value: 'all' },
  { label: 'Active',      value: 'active' },
  { label: 'Deactivated', value: 'inactive' },
]

const roleDot = (role: string) => {
  if (role === 'Admin')          return 'bg-blue-500'
  if (role === 'Ride Attendant') return 'bg-amber-500'
  return 'bg-emerald-500'
}
const roleSolid = (role: string) => {
  if (role === 'Admin')          return 'bg-blue-500'
  if (role === 'Ride Attendant') return 'bg-amber-500'
  return 'bg-emerald-500'
}
const statusDot = (value: string) => {
  if (value === 'active')   return 'bg-green-500'
  if (value === 'inactive') return 'bg-red-400'
  return 'bg-gray-300'
}
const statusSolid = (value: string) => {
  if (value === 'active')   return 'bg-green-500'
  if (value === 'inactive') return 'bg-red-500'
  return 'bg-gray-500'
}

// ── Status Filter Dropdown ────────────────────────────────────────
function StatusFilterDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = STATUS_FILTER_OPTS.find(o => o.value === value) ?? STATUS_FILTER_OPTS[0]
  const isFiltered = value !== 'all'

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          isFiltered ? `${statusSolid(value)} text-white border-transparent shadow-sm` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}>
        <span className={`w-2 h-2 rounded-full ${isFiltered ? 'bg-white/70' : statusDot(value)}`} />
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 left-0 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {STATUS_FILTER_OPTS.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === opt.value ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`w-2 h-2 rounded-full ${statusDot(opt.value)}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Role Filter Dropdown ──────────────────────────────────────────
function RoleFilterDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          value ? `${roleSolid(value)} text-white border-transparent shadow-sm` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}>
        {value ? <UserCog className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
        {value ? `Role: ${value}` : 'All roles'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                !value ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              All roles
            </button>
            {ROLES.map(r => (
              <button key={r} type="button"
                onClick={() => { onChange(r); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors ${
                  value === r ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`w-2 h-2 rounded-full ${roleDot(r)}`} />
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Inline Confirm Modal (no shared dependency) ───────────────
function ConfirmModal({
  icon, title, message, sub, confirmLabel, danger,
  onConfirm, onCancel, loading,
}: {
  icon: React.ReactNode; title: string; message: string; sub?: string
  confirmLabel: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          danger ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
        }`}>
          {icon}
        </div>
        <div className="text-[15px] font-bold text-gray-900 mb-1">{title}</div>
        <div className="text-[12px] text-gray-600 mb-1">{message}</div>
        {sub && <div className="text-[11px] text-amber-600 font-medium mb-5">⚠ {sub}</div>}
        {!sub && <div className="mb-5" />}
        <div className="flex gap-2.5">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-[12px] font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers]           = useState<User[]>([])
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 10 })
  const [params, setParams]         = useState<PaginationRequest>({ page: 1, pageSize: 10, search: '' })
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading]       = useState(true)

  // Create staff
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', username: '', contactNumber: '', password: '', role: 'Ride Attendant' })
  const [creating, setCreating]     = useState(false)

  // Edit modal
  const [editOpen, setEditOpen]     = useState(false)
  const [editUser, setEditUser]     = useState<User | null>(null)
  const [editTab, setEditTab]       = useState<'role' | 'password'>('role')
  const [newRole, setNewRole]       = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPwVal, setConfirmPwVal] = useState('')
  const [editContactNumber, setEditContactNumber] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Confirm modals
  const [confirmRole, setConfirmRole]     = useState(false)
  const [confirmPw, setConfirmPw]         = useState(false)
  const [toggleTarget, setToggleTarget]   = useState<User | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)

  useEffect(() => { fetchUsers() }, [params, roleFilter, statusFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const searchParts = [params.search, roleFilter].filter(Boolean)
      const res = await api.get<PagedResponse<User>>('/api/user', {
        params: { ...params, search: searchParts.join(' ') || undefined }
      })
      let data: User[] = res.data.data ?? []
      if (statusFilter === 'active')   data = data.filter(u => u.isActive)
      if (statusFilter === 'inactive') data = data.filter(u => !u.isActive)
      setUsers(data)
      setPagination(res.data.pagination)
    } catch { toast.error('Failed to load users.') }
    finally { setLoading(false) }
  }

  // ── Toggle activate/deactivate ────────────────────────────
  const doToggle = async () => {
    if (!toggleTarget) return
    setToggleLoading(true)
    try {
      await api.put(`/api/user/${toggleTarget.id}/active`, null, {
        params: { isActive: !toggleTarget.isActive }
      })
      toast.success(`User ${!toggleTarget.isActive ? 'activated' : 'deactivated'}.`)
      setToggleTarget(null)
      fetchUsers()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to update status.')
    }
    finally { setToggleLoading(false) }
  }

  // ── Create staff ──────────────────────────────────────────
  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault()
    const digits = createForm.contactNumber.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(digits)) {
      toast.error('Enter a valid PH mobile number (e.g. 0912 345 6789).')
      return
    }
    setConfirmCreate(true)
  }
  const doCreateStaff = async () => {
    setCreating(true)
    try {
      await api.post('/api/user/create-staff', {
        ...createForm,
        contactNumber: createForm.contactNumber.replace(/\D/g, '')
      })
      toast.success(`${createForm.role} account created.`)
      setConfirmCreate(false)
      setCreateOpen(false)
      setCreateForm({ firstName: '', lastName: '', username: '', contactNumber: '', password: '', role: 'Ride Attendant' })
      fetchUsers()
    } catch (e: any) {
      setConfirmCreate(false)
      toast.error(e.response?.data?.message ?? 'Failed to create staff.')
    }
    finally { setCreating(false) }
  }

  // ── Edit role ─────────────────────────────────────────────
  const openEdit = (user: User) => {
    setEditUser(user); setNewRole(user.role)
    setNewPw(''); setConfirmPwVal('')
    setEditContactNumber(formatPHMobile(user.contactNumber ?? ''))
    setEditTab('role'); setEditOpen(true)
  }

  const handleSaveRoleClick = () => {
    if (!editUser) return
    if (newRole === editUser.role) { toast.error('Role is already ' + newRole); return }
    setConfirmRole(true)
  }

  const doSaveRole = async () => {
    if (!editUser) return
    setEditSaving(true)
    try {
      await api.put(`/api/user/${editUser.id}/role`, {
        userId: editUser.id,
        role: newRole,
      })
      toast.success('Role updated. User must re-login.')
      setConfirmRole(false)
      setEditOpen(false)
      fetchUsers()
    } catch (e: any) {
      setConfirmRole(false)
      toast.error(e.response?.data?.message ?? 'Failed to update role.')
    }
    finally { setEditSaving(false) }
  }

  // ── Change password ───────────────────────────────────────
  // ── Detect what's actually being changed, for flexible submit + button label ──
  const isChangingPassword = newPw.length > 0 || confirmPwVal.length > 0
  const originalContactDigits = (editUser?.contactNumber ?? '').replace(/\D/g, '')
  const isChangingContact = editContactNumber.replace(/\D/g, '') !== originalContactDigits

  const savePasswordLabel = isChangingPassword && isChangingContact
    ? 'Update password & contact'
    : isChangingPassword
    ? 'Update password'
    : isChangingContact
    ? 'Update contact number'
    : 'No changes to save'

  const handleSavePasswordClick = () => {
    if (!editUser) return

    const contactDigits = editContactNumber.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(contactDigits)) {
      toast.error('Enter a valid PH mobile number (e.g. 0912 345 6789).')
      return
    }

    // Password fields are optional — only validate them if the admin actually typed something
    if (isChangingPassword) {
      if (newPw.length < 8) {
        toast.error('Password must be at least 8 characters.')
        return
      }
      if (!/[A-Z]/.test(newPw)) {
        toast.error('Password must have at least 1 uppercase letter.')
        return
      }
      if (!/[a-z]/.test(newPw)) {
        toast.error('Password must have at least 1 lowercase letter.')
        return
      }
      if (!/[0-9]/.test(newPw)) {
        toast.error('Password must have at least 1 number.')
        return
      }
      if (!/[@$!%*?&]/.test(newPw)) {
        toast.error('Password must have at least 1 special character (@$!%*?&).')
        return
      }
      if (newPw !== confirmPwVal) {
        toast.error('Passwords do not match.')
        return
      }
    }

    if (!isChangingPassword && !isChangingContact) {
      toast.error('Nothing to update — change the password and/or contact number first.')
      return
    }

    setConfirmPw(true)
  }

  const doSavePassword = async () => {
    if (!editUser) return
    setEditSaving(true)
    try {
      await api.put(`/api/user/${editUser.id}/password`, {
        userId: editUser.id,
        // Only send password fields if the admin actually filled them in —
        // leaving them out (rather than empty strings) lets the backend
        // know to keep the existing password unchanged.
        ...(isChangingPassword ? { newPassword: newPw, confirmPassword: confirmPwVal } : {}),
        contactNumber: editContactNumber.replace(/\D/g, ''),
      })
      toast.success(
        isChangingPassword && isChangingContact ? 'Password and contact number updated successfully.'
        : isChangingPassword ? 'Password changed successfully.'
        : 'Contact number updated successfully.'
      )
      setConfirmPw(false)
      setEditOpen(false)
      setNewPw(''); setConfirmPwVal('')
      fetchUsers()
    } catch (e: any) {
      setConfirmPw(false)
      toast.error(e.response?.data?.message ?? 'Failed to save changes.')
    }
    finally { setEditSaving(false) }
  }

  const roleColor = (role: string) => {
    if (role === 'Admin')          return 'bg-blue-100 text-blue-700'
    if (role === 'Ride Attendant') return 'bg-amber-100 text-amber-700'
    return 'bg-emerald-100 text-emerald-700'
  }
  const initials = (u: User) => (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage users</h1>
          <p className="text-sm text-gray-500 mt-1">View all users, create staff, change roles and passwords.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Create staff
        </button>
      </div>

      {/* Filters — kept outside <Card> so dropdown popovers aren't clipped by Card's overflow */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 sm:px-5 py-4 flex items-center gap-3 flex-wrap">
        <SearchBar
          value={params.search ?? ''}
          onChange={s => setParams(p => ({ ...p, search: s, page: 1 }))}
          placeholder="Search users..."
        />

        {/* Status filter dropdown */}
        <StatusFilterDropdown
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setParams(p => ({ ...p, page: 1 })) }}
        />

        {/* Role filter dropdown */}
        <RoleFilterDropdown
          value={roleFilter}
          onChange={v => { setRoleFilter(v); setParams(p => ({ ...p, page: 1 })) }}
        />
      </div>

      <Card>
        {/* Summary chips */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-gray-50 flex items-center gap-4 flex-wrap">
          {STATUS_FILTER_OPTS.slice(1).map(opt => {
            const count = opt.value === 'active'
              ? users.filter(u => u.isActive).length
              : users.filter(u => !u.isActive).length
            return (
              <div key={opt.value} className="flex items-center gap-1.5 text-xs text-gray-500">
                {opt.value === 'active'
                  ? <UserCheck className="w-3.5 h-3.5 text-green-500" />
                  : <UserX    className="w-3.5 h-3.5 text-red-400" />}
                <span>{count} {opt.label.toLowerCase()}</span>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="w-14 h-14 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500">No users found</div>
            <div className="text-sm mt-1">Try adjusting your filters.</div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-300">
              {users.map(u => (
                <div key={u.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50/70 transition-colors group ${!u.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 sm:contents">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0 shadow-sm ${roleColor(u.role)}`}>
                      {initials(u).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-gray-900 text-[14px]">{u.fullName}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleColor(u.role)}`}>
                          {u.role}
                        </span>
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Deactivated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        <span className="font-mono">@{u.username}</span>
                        {u.contactNumber && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.contactNumber}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>Joined {new Date(u.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end sm:justify-start sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => u.isActive && openEdit(u)}
                      title={u.isActive ? 'Edit user' : 'Activate user first to edit'}
                      disabled={!u.isActive}
                      className={`flex items-center justify-center w-8 h-8 border rounded-xl transition-all ${
                        u.isActive
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 cursor-pointer'
                          : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed opacity-50'
                      }`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    {u.isActive ? (
                      <button onClick={() => setToggleTarget(u)} title="Deactivate user"
                        className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl transition-all">
                        <UserX className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => setToggleTarget(u)} title="Activate user"
                        className="flex items-center justify-center w-8 h-8 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl transition-all">
                        <UserCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Showing <strong>{users.length}</strong> of <strong>{pagination.totalCount}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(params.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <UserX className="w-4 h-4 rotate-90" />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setParams(prev => ({ ...prev, page: p }))}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                      p === (params.page ?? 1) ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                    }`}>{p}</button>
                ))}
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(params.page ?? 1) >= pagination.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <UserCheck className="w-4 h-4 -rotate-90" />
                </button>
              </div>
              <select value={params.pageSize ?? 10}
                onChange={e => setParams(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none">
                {[10,20,50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </>
        )}
      </Card>

      {/* ── Create staff modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create staff account" size="sm">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First name <span className="text-red-500">*</span></label>
              <input required value={createForm.firstName}
                onChange={e => setCreateForm({...createForm, firstName: e.target.value})}
                placeholder="Juan"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name <span className="text-red-500">*</span></label>
              <input required value={createForm.lastName}
                onChange={e => setCreateForm({...createForm, lastName: e.target.value})}
                placeholder="Dela Cruz"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username <span className="text-red-500">*</span></label>
            <input required value={createForm.username}
              onChange={e => setCreateForm({...createForm, username: e.target.value})}
              placeholder="juan_att"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact number <span className="text-red-500">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input required value={createForm.contactNumber} inputMode="numeric" maxLength={13}
                onChange={e => setCreateForm({...createForm, contactNumber: formatPHMobile(e.target.value)})}
                placeholder="0912 345 6789"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <input required type="password" value={createForm.password}
              onChange={e => setCreateForm({...createForm, password: e.target.value})}
              placeholder="Min. 8 characters"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
            <select required value={createForm.role}
              onChange={e => setCreateForm({...createForm, role: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="Ride Attendant">Ride Attendant</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setCreateOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Create account
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit modal — Role + Password in tabs ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title={`Edit user — ${editUser?.fullName}`} size="sm">
        {editUser && (
          <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              editUser.role === 'Admin' ? 'bg-blue-100 text-blue-700'
              : editUser.role === 'Ride Attendant' ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
            }`}>
              {initials(editUser).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{editUser.fullName}</p>
              <p className="text-xs text-gray-500">@{editUser.username} · <span className="font-medium">{editUser.role}</span></p>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          <button onClick={() => setEditTab('role')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              editTab === 'role' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <UserCog className="w-4 h-4" /> Change role
          </button>
          <button onClick={() => setEditTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              editTab === 'password' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Key className="w-4 h-4" /> Change password
          </button>
        </div>

        {/* Change role tab */}
        {editTab === 'role' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New role</label>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    newRole === r ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="role" value={r} checked={newRole === r}
                      onChange={() => setNewRole(r)} className="accent-emerald-600" />
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                        r === 'Admin' ? 'bg-blue-100 text-blue-700'
                        : r === 'Ride Attendant' ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                      }`}>{r}</span>
                      <span className="text-xs text-gray-500">
                        {r === 'Admin' ? 'Full management access' : r === 'Ride Attendant' ? 'Verify and complete rides' : 'Browse and book rides'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              User must log out and sign in again for the new role to take effect.
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 mt-3">
              <button onClick={() => setEditOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveRoleClick} disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save role
              </button>
            </div>
          </div>
        )}

        {/* Change password tab */}
        {editTab === 'password' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Phone className="w-3.5 h-3.5 inline mr-1" /> Contact number <span className="text-red-500">*</span>
              </label>
              <input value={editContactNumber} inputMode="numeric" maxLength={13}
                onChange={e => setEditContactNumber(formatPHMobile(e.target.value))}
                placeholder="0912 345 6789"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              <div className="text-[10px] text-gray-400 mt-1">Leave as-is if the contact number isn't changing.</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Lock className="w-3.5 h-3.5 inline mr-1" /> New password <span className="text-red-500">*</span>
              </label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Lock className="w-3.5 h-3.5 inline mr-1" /> Confirm new password <span className="text-red-500">*</span>
              </label>
              <input type="password" value={confirmPwVal} onChange={e => setConfirmPwVal(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs mb-1">
              {[
                { label: '8+ characters',          ok: newPw.length >= 8 },
                { label: '1 uppercase (A-Z)',       ok: /[A-Z]/.test(newPw) },
                { label: '1 number (0-9)',          ok: /[0-9]/.test(newPw) },
                { label: '1 special (@$!%*?&)',     ok: /[@$!%*?&]/.test(newPw) },
              ].map(r => (
                <div key={r.label} className={`flex items-center gap-1.5 transition-colors ${r.ok ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${r.ok ? 'text-emerald-500' : 'text-gray-300'}`} />
                  {r.label}
                </div>
              ))}
            </div>
            {confirmPwVal && newPw !== confirmPwVal && (
              <div className="text-[11px] text-red-500 mb-1">⚠ Passwords do not match</div>
            )}
            {confirmPwVal && newPw === confirmPwVal && confirmPwVal.length > 0 && (
              <div className="text-[11px] text-emerald-600 mb-1">✅ Passwords match</div>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 mt-3">
              <button onClick={() => setEditOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSavePasswordClick} disabled={editSaving || (!isChangingPassword && !isChangingContact)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {savePasswordLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm: Create staff ── */}
      {confirmCreate && (
        <ConfirmModal
          icon={<Plus className="w-6 h-6" />}
          title="Create staff account?"
          message={`Create a new ${createForm.role} account for @${createForm.username}?`}
          sub="They will be able to log in immediately after creation."
          confirmLabel="Yes, create account"
          onConfirm={doCreateStaff}
          onCancel={() => setConfirmCreate(false)}
          loading={creating}
        />
      )}

      {/* ── Confirm: Change role ── */}
      {confirmRole && editUser && (
        <ConfirmModal
          icon={<UserCog className="w-6 h-6" />}
          title="Change user role?"
          message={`Change ${editUser.fullName}'s role from ${editUser.role} to ${newRole}?`}
          sub="The user will need to log out and sign in again."
          confirmLabel="Yes, change role"
          onConfirm={doSaveRole}
          onCancel={() => setConfirmRole(false)}
          loading={editSaving}
        />
      )}

      {/* ── Confirm: Change password ── */}
      {confirmPw && editUser && (
        <ConfirmModal
          icon={<Key className="w-6 h-6" />}
          title={
            isChangingPassword && isChangingContact ? 'Update password & contact number?'
            : isChangingPassword ? 'Change password?'
            : 'Update contact number?'
          }
          message={
            isChangingPassword && isChangingContact
              ? `Update the password and contact number for @${editUser.username}?`
              : isChangingPassword
              ? `Change the password for @${editUser.username}?`
              : `Update the contact number for @${editUser.username} to ${editContactNumber}?`
          }
          confirmLabel={`Yes, ${savePasswordLabel.toLowerCase()}`}
          onConfirm={doSavePassword}
          onCancel={() => setConfirmPw(false)}
          loading={editSaving}
        />
      )}

      {/* ── Confirm: Activate / Deactivate ── */}
      {toggleTarget && (
        <ConfirmModal
          icon={toggleTarget.isActive ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
          title={toggleTarget.isActive ? 'Deactivate user?' : 'Activate user?'}
          message={`${toggleTarget.isActive ? 'Deactivate' : 'Activate'} ${toggleTarget.fullName} (@${toggleTarget.username})?`}
          sub={toggleTarget.isActive ? 'They will no longer be able to log in until reactivated.' : 'They will be able to log in again immediately.'}
          confirmLabel={toggleTarget.isActive ? 'Yes, deactivate' : 'Yes, activate'}
          danger={toggleTarget.isActive}
          onConfirm={doToggle}
          onCancel={() => setToggleTarget(null)}
          loading={toggleLoading}
        />
      )}
    </div>
  )
}
