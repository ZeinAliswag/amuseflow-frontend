import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, RotateCcw, Upload,
  CheckCircle2, Clock, Users, Search,
  ChevronLeft, ChevronRight, ZoomIn, X, Loader2, ChevronDown, Filter,
  SortAsc, SortDesc, Type, Banknote,
  FerrisWheel,
  Maximize2
} from 'lucide-react'
import type { Ride, PaginationRequest } from '../../types'
import api, { apiForm } from '../../services/api'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const fmt = (n: any) => Number(n ?? 0).toFixed(2)

function Spinner() {
  return <div className="w-7 h-7 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin" />
}

function Badge({ label }: { label: string }) {
  const map: Record<string,string> = {
    Active:'bg-green-100 text-green-700',
    Deleted:'bg-red-100 text-red-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

const STATUS_OPTS = [
  { value: 'active',  label: 'Active',  icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> },
  { value: 'all',     label: 'All',     icon: <FerrisWheel className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'deleted', label: 'Deleted', icon: <Trash2 className="w-3.5 h-3.5 text-red-500" /> },
] as const

// ── Status Filter — custom combobox with icons ──────────────────
function StatusCombobox({ value, onChange }: {
  value: 'active'|'all'|'deleted'
  onChange: (v: 'active'|'all'|'deleted') => void
}) {
  const [open, setOpen] = useState(false)
  const current = STATUS_OPTS.find(o => o.value === value)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {current?.icon}
        {current?.label}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {STATUS_OPTS.map(o => (
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

// ── Sort options ──────────────────────────────────────────────
const SORT_BY_OPTS = [
  { value: '', label: 'Sort by default', icon: <Filter className="w-3.5 h-3.5 text-gray-400" /> },
  { value: 'Name', label: 'Name', icon: <Type className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'Price', label: 'Price', icon: <Banknote className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'MaxCapacity', label: 'Capacity', icon: <Maximize2 className="w-3.5 h-3.5 text-gray-500" /> },
]

const SORT_DIR_OPTS = [
  { value: 'DESC', label: 'Descending', icon: <SortDesc className="w-3.5 h-3.5 text-gray-500" /> },
  { value: 'ASC',  label: 'Ascending',  icon: <SortAsc className="w-3.5 h-3.5 text-gray-500" /> },
]

// ── Sort By — combobox ──────────────────────────────────────────
function SortByCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = SORT_BY_OPTS.find(o => o.value === value) ?? SORT_BY_OPTS[0]

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

// ── Sort Direction — combobox ────────────────────────────────────
function SortDirCombobox({ value, onChange }: { value: 'ASC'|'DESC'; onChange: (v: 'ASC'|'DESC') => void }) {
  const [open, setOpen] = useState(false)
  const current = SORT_DIR_OPTS.find(o => o.value === value) ?? SORT_DIR_OPTS[0]

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
            {SORT_DIR_OPTS.map(o => (
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

// ── Confirm Modal ──────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
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
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Image Zoom Overlay ─────────────────────────────────────────
function ImageZoom({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="relative max-w-2xl max-h-[80vh]">
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10">
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img src={src} alt="Ride" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    </div>
  )
}

const emptyForm = { name:'', description:'', maxCapacity:20, durationMinutes:5, price:'' as string | number }

export default function AdminRidesPage() {
  const [rides, setRides]           = useState<Ride[]>([])
  const [pagination, setPagination] = useState({ currentPage:1, totalPages:1, totalCount:0, pageSize:10 })
  const [params, setParams]         = useState<PaginationRequest>({ page:1, pageSize:10, search:'' })
  const [statusFilter, setStatusFilter] = useState<'active'|'all'|'deleted'>('active')
  const [restoreTarget, setRestoreTarget] = useState<Ride | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editRide, setEditRide]     = useState<Ride | null>(null)
  const [form, setForm]             = useState({ ...emptyForm })
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  // confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Ride | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  // image zoom
  const [zoomSrc, setZoomSrc]       = useState<string | null>(null)

  const getImageUrl = (path?: string) => {
    if (!path) return null
    if (path.startsWith('http')) return path
    if (path.startsWith('/')) return `${BASE_URL}${path}`
    return `${BASE_URL}/images/${path}`
  }

  const fetchRides = async () => {
    setLoading(true)
    try {
      const showDel = statusFilter !== 'active'
      const res = await api.get('/api/ride', { params: { ...params, includeDeleted: showDel, showDeleted: showDel } })
      const d = res.data?.data?.data ?? res.data?.data ?? res.data
      let rideList: any[] = Array.isArray(d) ? d : []
      if (statusFilter === 'deleted') rideList = rideList.filter((r: any) => r.isDeleted)
      if (statusFilter === 'active') rideList = rideList.filter((r: any) => !r.isDeleted)
      setRides(rideList)
      const pg = res.data?.data?.pagination ?? res.data?.pagination
      if (pg) setPagination(pg)
    } catch { toast.error('Failed to load rides.') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchRides() }, [params, statusFilter])

  const openCreate = () => {
    setEditRide(null); setForm({ ...emptyForm })
    setImageFile(null); setImagePreview(''); setFormErr(''); setModalOpen(true)
  }

  const openEdit = (ride: Ride) => {
    setEditRide(ride)
    setForm({
      name: ride.name,
      description: ride.description ?? '',
      maxCapacity: ride.maxCapacity,
      durationMinutes: ride.durationMinutes,
      price: Number(ride.price) || 0,  // ensure number
    })
    setImageFile(null)
    setImagePreview(ride.imagePath ? getImageUrl(ride.imagePath)! : '')
    setFormErr(''); setModalOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr('')
    const priceNum = parseFloat(String(form.price))
    if (!form.name)           { setFormErr('Ride name is required.'); return }
    if (isNaN(priceNum) || priceNum < 0) { setFormErr('Please enter a valid price.'); return }
    if (!editRide && !imageFile) { setFormErr('Image is required for new rides.'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name',            form.name)
      fd.append('description',     form.description as string)
      fd.append('maxCapacity',     String(form.maxCapacity))
      fd.append('durationMinutes', String(form.durationMinutes))
      fd.append('price',           String(priceNum))
      if (imageFile) fd.append('file', imageFile)

      if (editRide) {
        await apiForm.put(`/api/ride/${editRide.id}`, fd)
        toast.success('Ride updated successfully.')
      } else {
        await apiForm.post('/api/ride', fd)
        toast.success('Ride created successfully.')
      }
      setModalOpen(false); fetchRides()
    } catch (e: any) {
      setFormErr(e.response?.data?.message ?? 'Failed to save ride.')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/ride/${deleteTarget.id}`)
      toast.success(`"${deleteTarget.name}" deleted.`)
      setDeleteTarget(null); fetchRides()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to delete.')
    } finally { setDeleteLoading(false) }
  }

  const doRestore = async () => {
    if (!restoreTarget) return
    setRestoreLoading(true)
    try {
      await api.put(`/api/ride/${restoreTarget.id}/restore`)
      toast.success(`"${restoreTarget.name}" restored!`)
      setRestoreTarget(null); fetchRides()
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to restore.')
    } finally { setRestoreLoading(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage rides</h1>
          <p className="text-sm text-gray-500 mt-1">Create, update, delete and restore rides.</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add ride
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input value={params.search ?? ''}
              onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
              placeholder="Search rides..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 w-full sm:w-52" />
          </div>

          {/* Status filter — custom combobox with icons */}
          <StatusCombobox
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setParams(p => ({ ...p, page: 1 })) }}
          />

          <SortByCombobox
            value={params.sortBy ?? ''}
            onChange={v => setParams(p => ({ ...p, sortBy: v, page: 1 }))}
          />
          <SortDirCombobox
            value={(params.sortDirection as 'ASC'|'DESC') ?? 'DESC'}
            onChange={v => setParams(p => ({ ...p, sortDirection: v, page: 1 }))}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner /></div>
        ) : rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FerrisWheel className="w-16 h-16 mb-3 text-gray-200" />
            <div className="font-semibold text-gray-500 text-base">No rides found</div>
            <div className="text-sm mt-1 text-gray-400">Try adjusting your search or add a new ride.</div>
          </div>
        ) : (
          <>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rides.map(ride => (
                <div key={ride.id}
                  className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all group ${
                    ride.isDeleted ? 'opacity-60' : ''
                  }`}>
                  {/* Image */}
                  <div className="relative h-44 bg-white cursor-pointer overflow-hidden"
                    onClick={() => ride.imagePath && setZoomSrc(getImageUrl(ride.imagePath)!)}>
                    {ride.imagePath ? (
                      <>
                        <img src={getImageUrl(ride.imagePath)!} alt={ride.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-gray-700" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <img src="/images__6_-removebg-preview.png" alt="AmuseFlow" className="w-24 h-24 object-contain" />
                      </div>
                    )}
                    {/* Status badge on image */}
                    <div className="absolute top-3 left-3">
                      <Badge label={ride.isDeleted ? 'Deleted' : 'Active'} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-[14px] mb-1 truncate">{ride.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3 min-h-[2rem]">{ride.description ?? 'No description'}</p>

                    {/* Stats row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[13px] font-bold text-emerald-600">₱{fmt(ride.price)}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {ride.maxCapacity}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {ride.durationMinutes}m
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      {ride.isDeleted ? (
                        <button onClick={() => setRestoreTarget(ride)} title="Restore ride"
                          className="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openEdit(ride)} title="Edit ride"
                            className="flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(ride)} title="Delete ride"
                            className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Showing <strong>{rides.length}</strong> of <strong>{pagination.totalCount}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  disabled={(params.page ?? 1) <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - (params.page ?? 1)) <= 2)
                  .map(p => (
                    <button key={p} onClick={() => setParams(prev => ({ ...prev, page: p }))}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-medium transition-colors ${
                        p === (params.page ?? 1) ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                      }`}>{p}</button>
                  ))}
                <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  disabled={(params.page ?? 1) >= pagination.totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <select value={params.pageSize ?? 10}
                onChange={e => setParams(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none">
                {[8,12,20,40].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editRide ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                  {editRide ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-[15px]">{editRide ? 'Edit ride' : 'Add new ride'}</div>
                  <div className="text-[11px] text-gray-400">{editRide ? `Editing: ${editRide.name}` : 'Fill in the details below'}</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Image — clickable to zoom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ride image {!editRide && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  {imagePreview ? (
                    <div className="relative group cursor-pointer flex-shrink-0"
                      onClick={() => setZoomSrc(imagePreview)}>
                      <img src={imagePreview} alt="preview"
                        className="w-20 h-20 rounded-xl object-cover border border-gray-200 group-hover:brightness-75 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                      <FerrisWheel className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium transition-colors">
                      <Upload className="w-4 h-4" />
                      {editRide ? 'Change image (optional)' : 'Upload image'}
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    <p className="text-xs text-gray-400 mt-1.5">JPG, PNG, WEBP · Max 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ride name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  required placeholder="Dragon Coaster"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description as string} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Describe the ride..." rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (₱) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    required placeholder="150.00"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity *</label>
                  <input type="number" min="1" value={form.maxCapacity ?? 20}
                    onChange={e => setForm({...form, maxCapacity: parseInt(e.target.value)})}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (min) *</label>
                  <input type="number" min="1" value={form.durationMinutes ?? 5}
                    onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value)})}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
              </div>

              {formErr && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">⚠ {formErr}</div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  {editRide ? 'Save changes' : 'Create ride'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete ride?"
          message={`Delete "${deleteTarget.name}"? It can be restored later.`}
          confirmLabel="Yes, delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Confirm Restore Modal */}
      {restoreTarget && (
        <ConfirmModal
          title="Restore ride?"
          message={`Restore "${restoreTarget.name}"? It will be set back to active and visible to visitors.`}
          confirmLabel="Yes, restore"
          onConfirm={doRestore}
          onCancel={() => setRestoreTarget(null)}
          loading={restoreLoading}
        />
      )}

      {/* Image Zoom Overlay */}
      {zoomSrc && <ImageZoom src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  )
}
