import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, RotateCcw, Upload,
  CheckCircle2, Clock, Users, Search,
  ChevronLeft, ChevronRight, ZoomIn, X, Loader2, ChevronDown, Filter,
  SortAsc, SortDesc, Type, Banknote,
  FerrisWheel,
  Maximize2, Ruler, Cake, Weight, Star,
  Baby, Backpack, Briefcase, Globe
} from 'lucide-react'
import type { Ride, PaginationRequest, RideValidationSettings, RiderCategoryPreset } from '../../types'
import api, { apiForm, extractApiError, settingsApi, riderCategoryApi } from '../../services/api'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const fmt = (n: any) => Number(n ?? 0).toFixed(2)

// ✅ CHANGED — the old Spinner() component was only ever used for this grid's
// loading state, now replaced by RideCardSkeleton below, so it's removed
// rather than left as dead code.
//
// ✅ NEW — skeleton card mirroring the real card's shape (image block, title
// bar, description lines, meta row, badge pills, button bar). Used instead
// of a spinner when paging/sorting/filtering an already-visible grid, so the
// layout doesn't collapse to a single centered spinner — the grid keeps its
// shape and just "loads in", which reads as faster and avoids layout shift.
function RideCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-gray-100 rounded-full w-16" />
          <div className="h-5 bg-gray-100 rounded-full w-16" />
        </div>
        <div className="h-9 bg-gray-200 rounded-xl mt-2" />
      </div>
    </div>
  )
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

  // ✅ NEW — live, as-you-type range check against the fetched `bounds`.
  // Previously a value outside the configured floor/ceiling only surfaced
  // as a toast on Save — typing an out-of-range number (e.g. a Max age of
  // 103 when the ceiling is 100) looked identical to a valid one until
  // submit. This returns an error string the moment the field is out of
  // range so the input can show a red border + inline message immediately.
  const fieldRangeError = (value: string | number, floor: number, ceiling: number, rangeLabel?: string): string | null => {
    if (value === '' || value == null) return null
    const n = Number(value)
    if (isNaN(n)) return null
    if (n < floor || n > ceiling) return `Must be between ${floor} and ${ceiling}${rangeLabel ? ` (${rangeLabel} range).` : '.'}`
    return null
  }

  // ✅ CHANGED — Kid/Teen/Adult rider category presets (Admin > Settings).
  // Picking a chip both (a) pre-fills this modal's Height/Age/Weight fields
  // with the union of the selected presets' ranges — same convenience as
  // before — AND (b) is now the real, saved answer to "who can ride this",
  // persisted on the Ride itself (RideCategoryLinks) so Attraction Bundles
  // can filter their ride picker by category. Failing silently here (like
  // `bounds` above) just means the chip row doesn't render — manual entry
  // of the height/age/weight fields still works.
  const [categoryPresets, setCategoryPresets] = useState<RiderCategoryPreset[]>([])
  // Which chips are currently toggled on — this IS the ride's stored
  // category tagging now, so Edit mode loads it straight from
  // ride.categoryIds instead of always starting empty.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [savedCategoryIds, setSavedCategoryIds] = useState<number[]>([])

  useEffect(() => {
    riderCategoryApi.getAll()
      .then(res => {
        const list: RiderCategoryPreset[] = res.data?.data ?? res.data ?? []
        setCategoryPresets(list)
      })
      .catch(() => { /* quick-select chips just won't show */ })
  }, [])

  // "All Visitors" = ids [] → clears every restriction field. One or more
  // categories selected → union of their ranges (lowest min, highest max)
  // so a ride open to "Teens & Adults" admits anyone either range covers.
  const applyCategorySelection = (ids: number[]) => {
    if (ids.length === 0) {
      setForm(f => ({
        ...f,
        minHeightCm: '', maxHeightCm: '',
        minAgeYears: '', maxAgeYears: '',
        minWeightKg: '', maxWeightKg: '',
      }))
      return
    }
    const selected = categoryPresets.filter(c => ids.includes(c.id))
    if (selected.length === 0) return
    setForm(f => ({
      ...f,
      minAgeYears: Math.min(...selected.map(c => c.minAgeYears)),
      maxAgeYears: Math.max(...selected.map(c => c.maxAgeYears)),
      minHeightCm: Math.min(...selected.map(c => c.minHeightCm)),
      maxHeightCm: Math.max(...selected.map(c => c.maxHeightCm)),
      minWeightKg: Math.min(...selected.map(c => c.minWeightKg)),
      maxWeightKg: Math.max(...selected.map(c => c.maxWeightKg)),
    }))
  }

  const toggleCategoryChip = (id: number) => {
    setSelectedCategoryIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      applyCategorySelection(next)
      return next
    })
  }

  // ✅ CHANGED — once Rider Categories are selected, none of Min/Max
  // height, age, or weight can be fine-tuned into a value that would
  // silently exclude one of the selected categories. E.g. Kid+Teen+Adult
  // selected (ages 1–12 / 13–17 / 18–100): a Max age of 13 technically sits
  // inside the overall 1–100 envelope, but it excludes every Adult (who
  // starts at 18) — nobody 18+ could ever satisfy "age ≤ 13", making the
  // Adult selection meaningless. Same logic applies to height and weight.
  // So each field gets its OWN tighter floor/ceiling instead of sharing one
  // envelope:
  //   • The Min field must stay ≤ the smallest selected category's max (so
  //     it doesn't already exclude that category) → minCeiling = min(maxes)
  //   • The Max field must stay ≥ the largest selected category's min (so
  //     the "highest-starting" category is still reachable) → maxFloor = max(mins)
  // Both fields still allow the full envelope on their other side
  // (minFloor = min of mins, maxCeiling = max of maxes). No category
  // selected (General Admission) → governed only by the broader Attraction
  // Validation Settings bounds, same as before.
  const selectedFieldBounds = (getMin: (c: RiderCategoryPreset) => number, getMax: (c: RiderCategoryPreset) => number) => {
    if (selectedCategoryIds.length === 0) return null
    const selected = categoryPresets.filter(c => selectedCategoryIds.includes(c.id))
    if (selected.length === 0) return null
    const mins = selected.map(getMin)
    const maxs = selected.map(getMax)
    return {
      minFloor: Math.min(...mins),
      minCeiling: Math.min(...maxs),
      maxFloor: Math.max(...mins),
      maxCeiling: Math.max(...maxs),
      label: selected.map(c => c.name).join('/'),
    }
  }

  const selectedAgeBounds = selectedFieldBounds(c => c.minAgeYears, c => c.maxAgeYears)
  const selectedHeightBounds = selectedFieldBounds(c => c.minHeightCm, c => c.maxHeightCm)
  const selectedWeightBounds = selectedFieldBounds(c => c.minWeightKg, c => c.maxWeightKg)

  const selectAllVisitorsChip = () => {
    setSelectedCategoryIds([])
    applyCategorySelection([])
  }

  const categoryChipIcon = (name: string) =>
    name === 'Kid' ? Baby : name === 'Teen' ? Backpack : Briefcase

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

  // ✅ FIXED (again) — was window.scrollTo(), a no-op since AdminLayout's
  // real scroll container is #admin-scroll-area, not the window. Then
  // switched away from el.scrollTo({behavior:'smooth'}) too, since that JS
  // API doesn't reliably animate on non-body scroll containers on some
  // mobile browsers and was silently doing nothing on phones. Setting
  // scrollTop directly always works; the container's own `scroll-smooth`
  // CSS class (AdminLayout.tsx) animates it wherever that's supported.
  useEffect(() => {
    const el = document.getElementById('admin-scroll-area')
    if (el) el.scrollTop = 0
    // ✅ FIXED (again, mobile) — see Logs.tsx for the full explanation:
    // some mobile browsers still leave the outer app shell scrollable, so
    // reset the window/document scroll position too, not just the inner
    // container.
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [params.page])

  const openCreate = () => {
    setEditRide(null); setForm({ ...emptyForm }); setSavedForm({ ...emptyForm })
    setImageFile(null); setImagePreview('')
    setSelectedCategoryIds([]); setSavedCategoryIds([])
    setModalOpen(true)
  }

  // ✅ CHANGED — Save button stays disabled until something actually
  // differs from the loaded ride (or, in Create mode, is always considered
  // "changed" since there's no original to compare against). A newly
  // picked image file always counts as a change. Now also compares the
  // selected category chips against what was loaded, since those are a
  // real saved field now, not just a pre-fill helper.
  const categoryIdsChanged = () => {
    const a = [...selectedCategoryIds].sort()
    const b = [...savedCategoryIds].sort()
    return a.length !== b.length || a.some((id, i) => id !== b[i])
  }
  const hasFormChanges = !editRide || imageFile !== null || categoryIdsChanged() ||
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
    // ✅ CHANGED — categories are the ride's real saved tagging now, so
    // Edit mode loads whatever this ride is actually tagged with.
    setSelectedCategoryIds(ride.categoryIds ?? [])
    setSavedCategoryIds(ride.categoryIds ?? [])
    setModalOpen(true)
  }

  // ✅ NEW — client-side size/type guard so an oversized or unsupported
  // photo gets an immediate toast instead of only failing after the whole
  // file has already round-tripped to the backend. Mirrors the backend's
  // own limit (10MB) and allowed types (adds HEIC/HEIF for iPhone photos).
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024
  const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
      toast.error('Only JPG, PNG, WEBP, GIF, and HEIC/HEIF images are allowed.')
      e.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Photo must be under 10MB.')
      e.target.value = ''
      return
    }

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

    // ✅ CHANGED — once Rider Categories are selected, Min/Max height, age,
    // and weight each get their own tighter floor/ceiling so neither side
    // can quietly exclude one of the selected categories (see
    // selectedFieldBounds above for why) — matches the live check on the
    // fields below.
    const minHeightFloor = selectedHeightBounds ? selectedHeightBounds.minFloor : bounds.minHeightFloorCm
    const minHeightCeiling = selectedHeightBounds ? selectedHeightBounds.minCeiling : bounds.minHeightCeilingCm
    const maxHeightFloor = selectedHeightBounds ? selectedHeightBounds.maxFloor : bounds.maxHeightFloorCm
    const maxHeightCeiling = selectedHeightBounds ? selectedHeightBounds.maxCeiling : bounds.maxHeightCeilingCm
    const heightRangeSuffix = selectedHeightBounds ? ` (${selectedHeightBounds.label} range)` : ''
    if (form.minHeightCm !== '' && (Number(form.minHeightCm) < minHeightFloor || Number(form.minHeightCm) > minHeightCeiling)) {
      if (fail(`Minimum height must be between ${minHeightFloor} and ${minHeightCeiling}${heightRangeSuffix} cm.`)) return
    }
    if (form.maxHeightCm !== '' && (Number(form.maxHeightCm) < maxHeightFloor || Number(form.maxHeightCm) > maxHeightCeiling)) {
      if (fail(`Maximum height must be between ${maxHeightFloor} and ${maxHeightCeiling}${heightRangeSuffix} cm.`)) return
    }

    const minAgeFloor = selectedAgeBounds ? selectedAgeBounds.minFloor : bounds.minAgeFloorYears
    const minAgeCeiling = selectedAgeBounds ? selectedAgeBounds.minCeiling : bounds.minAgeCeilingYears
    const maxAgeFloor = selectedAgeBounds ? selectedAgeBounds.maxFloor : bounds.maxAgeFloorYears
    const maxAgeCeiling = selectedAgeBounds ? selectedAgeBounds.maxCeiling : bounds.maxAgeCeilingYears
    const ageRangeSuffix = selectedAgeBounds ? ` (${selectedAgeBounds.label} range)` : ''
    if (form.minAgeYears !== '' && (Number(form.minAgeYears) < minAgeFloor || Number(form.minAgeYears) > minAgeCeiling)) {
      if (fail(`Minimum age must be between ${minAgeFloor} and ${minAgeCeiling}${ageRangeSuffix}.`)) return
    }
    if (form.maxAgeYears !== '' && (Number(form.maxAgeYears) < maxAgeFloor || Number(form.maxAgeYears) > maxAgeCeiling)) {
      if (fail(`Maximum age must be between ${maxAgeFloor} and ${maxAgeCeiling}${ageRangeSuffix}.`)) return
    }

    const minWeightFloor = selectedWeightBounds ? selectedWeightBounds.minFloor : bounds.minWeightFloorKg
    const minWeightCeiling = selectedWeightBounds ? selectedWeightBounds.minCeiling : bounds.minWeightCeilingKg
    const maxWeightFloor = selectedWeightBounds ? selectedWeightBounds.maxFloor : bounds.maxWeightFloorKg
    const maxWeightCeiling = selectedWeightBounds ? selectedWeightBounds.maxCeiling : bounds.maxWeightCeilingKg
    const weightRangeSuffix = selectedWeightBounds ? ` (${selectedWeightBounds.label} range)` : ''
    if (form.minWeightKg !== '' && (Number(form.minWeightKg) < minWeightFloor || Number(form.minWeightKg) > minWeightCeiling)) {
      if (fail(`Minimum weight must be between ${minWeightFloor} and ${minWeightCeiling}${weightRangeSuffix} kg.`)) return
    }
    if (form.maxWeightKg !== '' && (Number(form.maxWeightKg) < maxWeightFloor || Number(form.maxWeightKg) > maxWeightCeiling)) {
      if (fail(`Maximum weight must be between ${maxWeightFloor} and ${maxWeightCeiling}${weightRangeSuffix} kg.`)) return
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
      // ✅ NEW — this ride's real, saved Kid/Teen/Adult tagging. Repeated
      // form fields, same pattern the backend already expects for RideIds
      // on Attraction Bundles. Omitted entirely = "All Visitors".
      selectedCategoryIds.forEach(id => fd.append('categoryIds', String(id)))
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
          // ✅ CHANGED — was a centered spinner that blanked the whole grid;
          // now skeleton cards in the same grid shape, sized to the current
          // page size, so paging/sorting/filtering feels instant instead of
          // a jarring "everything disappears then reappears" flash.
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: params.pageSize ?? 10 }).map((_, i) => <RideCardSkeleton key={i} />)}
          </div>
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

                    {/* ✅ NEW — this ride's real, saved Kid/Teen/Adult
                        tagging (separate row from the height/age/weight
                        pills above, since it's a different kind of fact —
                        "who this is FOR" vs "what's actually enforced"). */}
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
                      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" onChange={handleImageChange} className="hidden" />
                    </label>
                    <p className="text-xs text-gray-400 mt-1.5">JPG, PNG, WEBP, HEIC/HEIF · Max 10MB</p>
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

              {/* ✅ CHANGED — Kid/Teen/Adult quick-select, pulled from Admin >
                  Settings > Rider Categories. This IS the ride's real saved
                  category tagging now (used to filter which rides can join
                  a category-restricted Attraction Bundle) — picking one or
                  more chips also fills the Height/Age/Weight fields below
                  with the union of the selected categories' ranges (lowest
                  min, highest max), which stay editable afterward. "All
                  Visitors" clears both — a ride is either open to everyone
                  or tagged with a combination of categories. */}
              {categoryPresets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Who can ride?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllVisitorsChip}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selectedCategoryIds.length === 0
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      General Admission
                    </button>

                    {categoryPresets.map(cat => {
                      const Icon = categoryChipIcon(cat.name)
                      const active = selectedCategoryIds.includes(cat.id)
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategoryChip(cat.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Fills in the fields below — you can still fine-tune them manually.
                  </p>
                </div>
              )}

              {/* ✅ CHANGED — height is now an optional min-max range (e.g.
                  100–180) instead of just a floor. Leave either side blank
                  for an open-ended range ("100cm and up", "up to 130cm", etc). */}
              {(() => {
                // ✅ CHANGED — same category-aware tightening as age: Min
                // height can't exceed the smallest selected category's max
                // height, and Max height can't fall below the largest
                // selected category's min height, so a selection can't
                // silently exclude one of its own categories.
                const minHeightFloor = selectedHeightBounds ? selectedHeightBounds.minFloor : bounds.minHeightFloorCm
                const minHeightCeiling = selectedHeightBounds ? selectedHeightBounds.minCeiling : bounds.minHeightCeilingCm
                const maxHeightFloor = selectedHeightBounds ? selectedHeightBounds.maxFloor : bounds.maxHeightFloorCm
                const maxHeightCeiling = selectedHeightBounds ? selectedHeightBounds.maxCeiling : bounds.maxHeightCeilingCm
                const minHeightErr = fieldRangeError(form.minHeightCm, minHeightFloor, minHeightCeiling, selectedHeightBounds?.label)
                const maxHeightErr = fieldRangeError(form.maxHeightCm, maxHeightFloor, maxHeightCeiling, selectedHeightBounds?.label)
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. height (cm)</label>
                      <input type="number"
                        min={minHeightFloor} max={minHeightCeiling}
                        value={form.minHeightCm}
                        onChange={e => setForm({...form, minHeightCm: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          minHeightErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {minHeightErr && (
                        <p className="text-xs text-red-500 mt-1">{minHeightErr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. height (cm)</label>
                      <input type="number"
                        min={maxHeightFloor} max={maxHeightCeiling}
                        value={form.maxHeightCm}
                        onChange={e => setForm({...form, maxHeightCm: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          maxHeightErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {maxHeightErr && (
                        <p className="text-xs text-red-500 mt-1">{maxHeightErr}</p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* ✅ CHANGED — age is now an optional min-max range (e.g. 24–50)
                  instead of just a floor. Leave either side blank for an
                  open-ended range ("18 and up", "up to 12", etc). */}
              {(() => {
                // ✅ CHANGED — Min age and Max age now each get their own
                // floor/ceiling (see selectedAgeBounds above): Min age can't
                // exceed the smallest selected category's max, and Max age
                // can't fall below the largest selected category's min —
                // otherwise a selection like Kid+Teen+Adult could silently
                // end up excluding Adult (e.g. Max age = 13, but Adult
                // starts at 18).
                const minAgeFloor = selectedAgeBounds ? selectedAgeBounds.minFloor : bounds.minAgeFloorYears
                const minAgeCeiling = selectedAgeBounds ? selectedAgeBounds.minCeiling : bounds.minAgeCeilingYears
                const maxAgeFloor = selectedAgeBounds ? selectedAgeBounds.maxFloor : bounds.maxAgeFloorYears
                const maxAgeCeiling = selectedAgeBounds ? selectedAgeBounds.maxCeiling : bounds.maxAgeCeilingYears
                const minAgeErr = fieldRangeError(form.minAgeYears, minAgeFloor, minAgeCeiling, selectedAgeBounds?.label)
                const maxAgeErr = fieldRangeError(form.maxAgeYears, maxAgeFloor, maxAgeCeiling, selectedAgeBounds?.label)
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. age (years)</label>
                      <input type="number"
                        min={minAgeFloor} max={minAgeCeiling}
                        value={form.minAgeYears}
                        onChange={e => setForm({...form, minAgeYears: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          minAgeErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {minAgeErr && (
                        <p className="text-xs text-red-500 mt-1">{minAgeErr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. age (years)</label>
                      <input type="number"
                        min={maxAgeFloor} max={maxAgeCeiling}
                        value={form.maxAgeYears}
                        onChange={e => setForm({...form, maxAgeYears: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          maxAgeErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {maxAgeErr && (
                        <p className="text-xs text-red-500 mt-1">{maxAgeErr}</p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* ✅ NEW — optional weight range restriction, same min/max pattern as age. */}
              {(() => {
                // ✅ CHANGED — same category-aware tightening as age/height:
                // Min weight can't exceed the smallest selected category's
                // max weight, and Max weight can't fall below the largest
                // selected category's min weight.
                const minWeightFloor = selectedWeightBounds ? selectedWeightBounds.minFloor : bounds.minWeightFloorKg
                const minWeightCeiling = selectedWeightBounds ? selectedWeightBounds.minCeiling : bounds.minWeightCeilingKg
                const maxWeightFloor = selectedWeightBounds ? selectedWeightBounds.maxFloor : bounds.maxWeightFloorKg
                const maxWeightCeiling = selectedWeightBounds ? selectedWeightBounds.maxCeiling : bounds.maxWeightCeilingKg
                const minWeightErr = fieldRangeError(form.minWeightKg, minWeightFloor, minWeightCeiling, selectedWeightBounds?.label)
                const maxWeightErr = fieldRangeError(form.maxWeightKg, maxWeightFloor, maxWeightCeiling, selectedWeightBounds?.label)
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. weight (kg)</label>
                      <input type="number"
                        min={minWeightFloor} max={minWeightCeiling}
                        value={form.minWeightKg}
                        onChange={e => setForm({...form, minWeightKg: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          minWeightErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {minWeightErr && (
                        <p className="text-xs text-red-500 mt-1">{minWeightErr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. weight (kg)</label>
                      <input type="number"
                        min={maxWeightFloor} max={maxWeightCeiling}
                        value={form.maxWeightKg}
                        onChange={e => setForm({...form, maxWeightKg: e.target.value})}
                        placeholder="No restriction"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                          maxWeightErr ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-green-300'
                        }`} />
                      {maxWeightErr && (
                        <p className="text-xs text-red-500 mt-1">{maxWeightErr}</p>
                      )}
                    </div>
                  </div>
                )
              })()}

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
