import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, RotateCcw, Upload,
  CheckCircle2, Clock, Users, Search,
  ChevronLeft, ChevronRight, ZoomIn, X, Loader2, ChevronDown, Filter,
  SortAsc, SortDesc, Type, Banknote,
  FerrisWheel,
  Maximize2, Ruler, Cake, Weight, Star
} from 'lucide-react'
import type { Ride, PaginationRequest, RideValidationSettings } from '../../types'
import api, { apiForm, extractApiError, settingsApi } from '../../services/api'
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
  // ✅ NEW — backend now supports this (RideRepository substitutes a
  // correlated AVG(Rating) subquery for this one value; see the frontend
  // Visitor sort control, which added the same option first).
  { value: 'Rating', label: 'Rating', icon: <Star className="w-3.5 h-3.5 text-gray-500" /> },
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
    <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4">
      <div className="relative max-w-2xl max-h-[80vh]">
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10">
          <X className="w-4 h-4 text-gray-700" />
        </button>
        <img src={src} alt="Attraction" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
      </div>
    </div>
  )
}

const emptyForm = {
  name:'', description:'', maxCapacity:20, durationMinutes:5, price:'' as string | number,
  // ✅ NEW — optional restrictions enforced per guest at booking time.
  // Height is now an optional min-max range (e.g. 100–180), not just a floor.
  minHeightCm:'' as string | number, maxHeightCm:'' as string | number,
  // ✅ CHANGED — age is now an optional min-max range (e.g. 24–50), not just a floor.
  minAgeYears:'' as string | number, maxAgeYears:'' as string | number,
  // ✅ NEW — optional weight range restriction, same min/max pattern as age.
  minWeightKg:'' as string | number, maxWeightKg:'' as string | number,
}

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
  // ✅ NEW — snapshot of the form as it was when the Edit modal was opened,
  // so the Save button can stay disabled until the admin actually changes
  // something (mirrors the same pattern on the Settings page). Not
  // meaningful in Create mode — there's no "original" to compare against
  // there, so Create is always left enabled.
  const [savedForm, setSavedForm]   = useState({ ...emptyForm })
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Ride | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  // image zoom
  const [zoomSrc, setZoomSrc]       = useState<string | null>(null)

  // ✅ CHANGED — the allowed floor/ceiling for each restriction field used to
  // be hardcoded here (mirroring the backend's now-removed [Range]
  // attributes). It's now fetched from the admin-configurable Settings
  // module, so a bounds change there is reflected here without a redeploy.
  // Falls back to the original hardcoded defaults if the fetch fails, so
  // ride saving still works even if Settings is unreachable.
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
      .catch(() => { /* keep defaults — ride saving still works */ })
  }, [])

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
    setEditRide(null); setForm({ ...emptyForm }); setSavedForm({ ...emptyForm })
    setImageFile(null); setImagePreview(''); setModalOpen(true)
  }

  // ✅ NEW — Save button stays disabled until something actually differs
  // from the loaded ride (or, in Create mode, is always considered
  // "changed" since there's no original to compare against). A newly
  // picked image file always counts as a change.
  const hasFormChanges = !editRide || imageFile !== null ||
    (Object.keys(form) as (keyof typeof form)[]).some(key => String(form[key]) !== String(savedForm[key]))

  const openEdit = (ride: Ride) => {
    setEditRide(ride)
    const loaded = {
      name: ride.name,
      description: ride.description ?? '',
      maxCapacity: ride.maxCapacity,
      durationMinutes: ride.durationMinutes,
      price: Number(ride.price) || 0,  // ensure number
      minHeightCm: ride.minHeightCm ?? '',
      maxHeightCm: ride.maxHeightCm ?? '',
      minAgeYears: ride.minAgeYears ?? '',
      maxAgeYears: ride.maxAgeYears ?? '',
      minWeightKg: ride.minWeightKg ?? '',
      maxWeightKg: ride.maxWeightKg ?? '',
    }
    setForm({ ...loaded })
    setSavedForm({ ...loaded })
    setImageFile(null)
    setImagePreview(ride.imagePath ? getImageUrl(ride.imagePath)! : '')
    setModalOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const priceNum = parseFloat(String(form.price))
    if (!form.name)           { toast.error('Attraction name is required.'); return }
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Please enter a valid price.'); return }
    if (!editRide && !imageFile) { toast.error('Image is required for new attractions.'); return }
    // ✅ NEW — these used to rely purely on the native min="1" attribute
    // (silent browser bubble); now caught explicitly so noValidate on the
    // form doesn't leave them unchecked client-side.
    if (!form.maxCapacity || Number(form.maxCapacity) < 1) { toast.error('Capacity must be at least 1.'); return }
    if (!form.durationMinutes || Number(form.durationMinutes) < 1) { toast.error('Duration must be at least 1 minute.'); return }
    // ✅ CHANGED — used to mirror the backend's static [Range]
    // DataAnnotations on CreateRideRequest with hardcoded numbers. Those
    // attributes are gone; the bounds now come from the admin-configurable
    // Settings module (`bounds`, fetched on mount), so this stays in sync
    // with whatever an admin has set there — an out-of-range value is still
    // caught here with the real wording instead of round-tripping to the
    // server and coming back as a generic "Failed to save ride." — the
    // server-side check still runs too (see catch block below), this is
    // just to fail fast with the real message.
    // ✅ CHANGED — validation errors now surface as a toast only (no more
    // inline red banner in the modal), per request.
    const fail = (msg: string) => { toast.error(msg); return true }
    if (form.minHeightCm !== '' && (Number(form.minHeightCm) < bounds.minHeightFloorCm || Number(form.minHeightCm) > bounds.minHeightCeilingCm)) {
      if (fail(`Minimum height must be between ${bounds.minHeightFloorCm} and ${bounds.minHeightCeilingCm} cm.`)) return
    }
    if (form.maxHeightCm !== '' && (Number(form.maxHeightCm) < bounds.maxHeightFloorCm || Number(form.maxHeightCm) > bounds.maxHeightCeilingCm)) {
      if (fail(`Maximum height must be between ${bounds.maxHeightFloorCm} and ${bounds.maxHeightCeilingCm} cm.`)) return
    }
    if (form.minAgeYears !== '' && (Number(form.minAgeYears) < bounds.minAgeFloorYears || Number(form.minAgeYears) > bounds.minAgeCeilingYears)) {
      if (fail(`Minimum age must be between ${bounds.minAgeFloorYears} and ${bounds.minAgeCeilingYears} years.`)) return
    }
    if (form.maxAgeYears !== '' && (Number(form.maxAgeYears) < bounds.maxAgeFloorYears || Number(form.maxAgeYears) > bounds.maxAgeCeilingYears)) {
      if (fail(`Maximum age must be between ${bounds.maxAgeFloorYears} and ${bounds.maxAgeCeilingYears} years.`)) return
    }
    if (form.minWeightKg !== '' && (Number(form.minWeightKg) < bounds.minWeightFloorKg || Number(form.minWeightKg) > bounds.minWeightCeilingKg)) {
      if (fail(`Minimum weight must be between ${bounds.minWeightFloorKg} and ${bounds.minWeightCeilingKg} kg.`)) return
    }
    if (form.maxWeightKg !== '' && (Number(form.maxWeightKg) < bounds.maxWeightFloorKg || Number(form.maxWeightKg) > bounds.maxWeightCeilingKg)) {
      if (fail(`Maximum weight must be between ${bounds.maxWeightFloorKg} and ${bounds.maxWeightCeilingKg} kg.`)) return
    }
    // ✅ CHANGED — sanity-check the restriction ranges before submitting.
    // Was `>` only, which let Min == Max slip through (e.g. Min age 10,
    // Max age 10) — a real range needs Min strictly less than Max, so this
    // is now `>=`.
    if (form.minHeightCm !== '' && form.maxHeightCm !== '' && Number(form.minHeightCm) >= Number(form.maxHeightCm)) {
      if (fail('Min height must be less than max height.')) return
    }
    if (form.minAgeYears !== '' && form.maxAgeYears !== '' && Number(form.minAgeYears) >= Number(form.maxAgeYears)) {
      if (fail('Min age must be less than max age.')) return
    }
    if (form.minWeightKg !== '' && form.maxWeightKg !== '' && Number(form.minWeightKg) >= Number(form.maxWeightKg)) {
      if (fail('Min weight must be less than max weight.')) return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name',            form.name)
      fd.append('description',     form.description as string)
      fd.append('maxCapacity',     String(form.maxCapacity))
      fd.append('durationMinutes', String(form.durationMinutes))
      fd.append('price',           String(priceNum))
      // ✅ NEW — optional restrictions enforced per guest at booking time.
      // Only send a value when the admin actually entered one — an empty
      // string means "no restriction" and should stay null server-side.
      if (form.minHeightCm !== '' && form.minHeightCm != null) fd.append('minHeightCm', String(form.minHeightCm))
      if (form.maxHeightCm !== '' && form.maxHeightCm != null) fd.append('maxHeightCm', String(form.maxHeightCm))
      if (form.minAgeYears !== '' && form.minAgeYears != null) fd.append('minAgeYears', String(form.minAgeYears))
      if (form.maxAgeYears !== '' && form.maxAgeYears != null) fd.append('maxAgeYears', String(form.maxAgeYears))
      if (form.minWeightKg !== '' && form.minWeightKg != null) fd.append('minWeightKg', String(form.minWeightKg))
      if (form.maxWeightKg !== '' && form.maxWeightKg != null) fd.append('maxWeightKg', String(form.maxWeightKg))
      if (imageFile) fd.append('file', imageFile)

      if (editRide) {
        await apiForm.put(`/api/ride/${editRide.id}`, fd)
        toast.success('Attraction updated successfully.')
      } else {
        await apiForm.post('/api/ride', fd)
        toast.success('Attraction created successfully.')
      }
      setModalOpen(false); fetchRides()
    } catch (e: any) {
      // ✅ FIXED — the backend returns ASP.NET Core's default
      // ValidationProblemDetails shape for [Range]/[Required] failures
      // (e.g. { errors: { MaxHeightCm: ["Maximum height must be..."] } }),
      // which has no top-level `.message`. extractApiError() pulls the
      // real per-field text out of `.errors` so the admin sees exactly
      // which value is invalid instead of a generic "Failed to save ride."
      const msg = extractApiError(e, 'Failed to save attraction.')
      toast.error(msg)
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
          <h1 className="text-2xl font-bold text-gray-900">Manage attractions</h1>
          <p className="text-sm text-gray-500 mt-1">Create, update, delete and restore attractions.</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add attraction
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
              placeholder="Search attractions..."
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
            <div className="font-semibold text-gray-500 text-base">No attractions found</div>
            <div className="text-sm mt-1 text-gray-400">Try adjusting your search or add a new attraction.</div>
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
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="font-bold text-gray-900 text-[14px] truncate">{ride.name}</h3>
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

                    {/* ✅ CHANGED — restriction badges, only shown when the
                        ride actually has a height, age, and/or weight
                        requirement. Split into one chip per metric (instead
                        of one flat string) so each is scannable at a glance,
                        color-coded by type, with a hover tooltip explaining
                        that a guest must meet ALL of the ones shown. Age/
                        weight render as a range when both ends are set, or
                        an open-ended "X+"/"up to X" otherwise. */}
                    {(ride.minHeightCm != null || ride.maxHeightCm != null
                      || ride.minAgeYears != null || ride.maxAgeYears != null
                      || ride.minWeightKg != null || ride.maxWeightKg != null) && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-3"
                        title="Every guest in the party must meet all of these to book this attraction">
                        {(ride.minHeightCm != null || ride.maxHeightCm != null) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-1 cursor-default">
                            <Ruler className="w-3 h-3" />
                            {ride.minHeightCm != null && ride.maxHeightCm != null
                              ? `${ride.minHeightCm}-${ride.maxHeightCm}cm`
                              : ride.minHeightCm != null ? `${ride.minHeightCm}cm+` : `Up to ${ride.maxHeightCm}cm`}
                          </span>
                        )}
                        {(ride.minAgeYears != null || ride.maxAgeYears != null) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-1 cursor-default">
                            <Cake className="w-3 h-3" />
                            {ride.minAgeYears != null && ride.maxAgeYears != null
                              ? `${ride.minAgeYears}-${ride.maxAgeYears}y`
                              : ride.minAgeYears != null ? `${ride.minAgeYears}y+` : `Up to ${ride.maxAgeYears}y`}
                          </span>
                        )}
                        {(ride.minWeightKg != null || ride.maxWeightKg != null) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 cursor-default">
                            <Weight className="w-3 h-3" />
                            {ride.minWeightKg != null && ride.maxWeightKg != null
                              ? `${ride.minWeightKg}-${ride.maxWeightKg}kg`
                              : ride.minWeightKg != null ? `${ride.minWeightKg}kg+` : `Up to ${ride.maxWeightKg}kg`}
                          </span>
                        )}
                      </div>
                    )}

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
                        <button onClick={() => setRestoreTarget(ride)} title="Restore attraction"
                          className="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openEdit(ride)} title="Edit attraction"
                            className="flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {/* ✅ NEW — disabled while the ride has an open,
                              upcoming, or ongoing schedule, mirroring the
                              same rule enforced server-side. */}
                          {ride.hasActiveSchedule ? (
                            <button disabled title="This attraction has an open, upcoming, or ongoing schedule — it can't be deleted until that schedule is cancelled or completes."
                              className="flex items-center justify-center w-8 h-8 bg-gray-50 text-gray-300 border border-gray-200 rounded-xl cursor-not-allowed">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => setDeleteTarget(ride)} title="Delete attraction"
                              className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
      {/* ✅ CHANGED — no more click-outside-to-close: an accidental click on
          the backdrop (e.g. missing a button) used to exit the whole form.
          Now the modal only closes via the explicit X button or Cancel. */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editRide ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                  {editRide ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-[15px]">{editRide ? 'Edit attraction' : 'Add new attraction'}</div>
                  <div className="text-[11px] text-gray-400">{editRide ? `Editing: ${editRide.name}` : 'Fill in the details below'}</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ✅ CHANGED — noValidate so the browser's native validation
                bubble never appears; every check now runs in handleSubmit
                and reports via toast instead. */}
            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
              {/* Image — clickable to zoom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attraction image {!editRide && <span className="text-red-500">*</span>}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Attraction name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  required placeholder="Dragon Coaster"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description as string} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Describe the attraction..." rows={3}
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

              {/* ✅ CHANGED — height is now an optional min-max range (e.g.
                  100–180) instead of just a floor. Leave either side blank
                  for an open-ended range ("100cm and up", "up to 130cm", etc). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. height (cm)</label>
                  <input type="number" min="0" value={form.minHeightCm}
                    onChange={e => setForm({...form, minHeightCm: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. height (cm)</label>
                  <input type="number" min="0" value={form.maxHeightCm}
                    onChange={e => setForm({...form, maxHeightCm: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
              </div>

              {/* ✅ CHANGED — age is now an optional min-max range (e.g. 24–50)
                  instead of just a floor. Leave either side blank for an
                  open-ended range ("18 and up", "up to 12", etc). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. age (years)</label>
                  <input type="number" min="0" value={form.minAgeYears}
                    onChange={e => setForm({...form, minAgeYears: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. age (years)</label>
                  <input type="number" min="0" value={form.maxAgeYears}
                    onChange={e => setForm({...form, maxAgeYears: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
              </div>

              {/* ✅ NEW — optional weight range restriction, same min/max pattern as age. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. weight (kg)</label>
                  <input type="number" min="0" value={form.minWeightKg}
                    onChange={e => setForm({...form, minWeightKg: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. weight (kg)</label>
                  <input type="number" min="0" value={form.maxWeightKg}
                    onChange={e => setForm({...form, maxWeightKg: e.target.value})}
                    placeholder="No restriction"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !hasFormChanges}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  {editRide ? 'Save changes' : 'Create attraction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete attraction?"
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
          title="Restore attraction?"
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
