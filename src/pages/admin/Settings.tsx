import { useEffect, useState } from 'react'
import {
  ChevronDown, Save, Loader2, FerrisWheel, RotateCcw,
  ArrowDownToLine, ArrowUpToLine, Minus, Plus,
  Layers, Baby, Backpack, Briefcase, Lock, Globe
} from 'lucide-react'
import type { RideValidationSettings, RiderCategoryPreset } from '../../types'
import { settingsApi, riderCategoryApi, extractApiError } from '../../services/api'
import toast from 'react-hot-toast'

// Form state mirrors RideValidationSettings but keeps every field as a
// string while editing, same pattern as Rides.tsx's restriction inputs —
// avoids fighting React over "" vs 0 while the admin is mid-edit.
type FieldKey =
  | 'minHeightFloorCm' | 'minHeightCeilingCm' | 'maxHeightFloorCm' | 'maxHeightCeilingCm'
  | 'minAgeFloorYears' | 'minAgeCeilingYears' | 'maxAgeFloorYears' | 'maxAgeCeilingYears'
  | 'minWeightFloorKg' | 'minWeightCeilingKg' | 'maxWeightFloorKg' | 'maxWeightCeilingKg'

type FormState = Record<FieldKey, string>

const EMPTY_FORM: FormState = {
  minHeightFloorCm: '', minHeightCeilingCm: '', maxHeightFloorCm: '', maxHeightCeilingCm: '',
  minAgeFloorYears: '', minAgeCeilingYears: '', maxAgeFloorYears: '', maxAgeCeilingYears: '',
  minWeightFloorKg: '', minWeightCeilingKg: '', maxWeightFloorKg: '', maxWeightCeilingKg: '',
}

function toForm(s: RideValidationSettings): FormState {
  return {
    // Start at 1 instead of 0.
    minHeightFloorCm: String(Math.max(1, s.minHeightFloorCm)),
    minHeightCeilingCm: String(Math.max(1, s.minHeightCeilingCm)),
    maxHeightFloorCm: String(Math.max(1, s.maxHeightFloorCm)),
    maxHeightCeilingCm: String(Math.max(1, s.maxHeightCeilingCm)),

    minAgeFloorYears: String(Math.max(1, s.minAgeFloorYears)),
    minAgeCeilingYears: String(Math.max(1, s.minAgeCeilingYears)),
    maxAgeFloorYears: String(Math.max(1, s.maxAgeFloorYears)),
    maxAgeCeilingYears: String(Math.max(1, s.maxAgeCeilingYears)),

    minWeightFloorKg: String(Math.max(1, s.minWeightFloorKg)),
    minWeightCeilingKg: String(Math.max(1, s.minWeightCeilingKg)),
    maxWeightFloorKg: String(Math.max(1, s.maxWeightFloorKg)),
    maxWeightCeilingKg: String(Math.max(1, s.maxWeightCeilingKg)),
  }
}

// ✅ NEW — same string-while-editing pattern, for the 3 Kid/Teen/Adult
// rider category presets. Each category (keyed by its id: 1=Kid, 2=Teen,
// 3=Adult) gets its own independent form + saved-snapshot + saving state,
// so editing/saving one category never touches the others.
type CategoryFieldKey =
  | 'minAgeYears' | 'maxAgeYears' | 'minHeightCm' | 'maxHeightCm' | 'minWeightKg' | 'maxWeightKg'

type CategoryFormState = Record<CategoryFieldKey, string>

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  minAgeYears: '', maxAgeYears: '', minHeightCm: '', maxHeightCm: '', minWeightKg: '', maxWeightKg: '',
}

function categoryToForm(p: RiderCategoryPreset): CategoryFormState {
  return {
    minAgeYears: String(Math.max(1, p.minAgeYears)),
    maxAgeYears: String(Math.max(1, p.maxAgeYears)),
    minHeightCm: String(Math.max(1, p.minHeightCm)),
    maxHeightCm: String(Math.max(1, p.maxHeightCm)),
    minWeightKg: String(Math.max(1, p.minWeightKg)),
    maxWeightKg: String(Math.max(1, p.maxWeightKg)),
  }
}

// Kid → Baby, Teen → Backpack, Adult → Briefcase — each reads clearly
// distinct at a glance (Teen/Adult used to both be person-silhouette icons
// that looked too similar).
function categoryIcon(name: string) {
  if (name === 'Kid') return Baby
  if (name === 'Teen') return Backpack
  return Briefcase
}

// ── Stepper input — a labeled pill (Floor/Ceiling, with a directional icon)
// sitting on top of a −/+ stepper, instead of a bare number box with a plain
// text label. Clicking −/+ nudges the value by 1; the number itself is still
// directly editable/selectable. ──────────────────────────────────────────
function StepperInput({ pillLabel, icon, tone, value, unit, onChange, disabled, invalid }: {
  pillLabel: string
  icon: React.ReactNode
  tone: 'sky' | 'rose'
  value: string
  unit: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  // Keep the stepper from ever going below 1.
  const step = (delta: number) => {
    const current = Number(value) || 1
    const nextValue = Math.max(1, current + delta)

    onChange(String(nextValue))
  }

  const toneClasses = tone === 'sky'
    ? 'bg-sky-50 text-sky-700 border-sky-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'

  return (
    <div className="flex-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold mb-1.5 ${toneClasses}`}>
        {icon} {pillLabel}
      </span>

      <div className={`flex items-center rounded-xl border bg-gray-50 overflow-hidden focus-within:ring-2 transition-shadow ${
        invalid
          ? 'border-red-300 focus-within:ring-red-200 focus-within:border-red-400'
          : 'border-gray-200 focus-within:ring-blue-200 focus-within:border-blue-300'
      }`}>

        <button
          type="button"
          disabled={disabled}
          onClick={() => step(-1)}
          className="px-2.5 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
          aria-label={`Decrease ${pillLabel}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <input
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 px-1 py-2 text-sm text-center bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <span className="pr-1 text-xs text-gray-400 whitespace-nowrap">
          {unit}
        </span>

        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          className="px-2.5 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
          aria-label={`Increase ${pillLabel}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

      </div>
    </div>
  )
}

// One editable "field bound" row — a pair of Floor/Ceiling steppers.
// ✅ CHANGED — generic over the field-key type so this same component can
// back both the global Attraction Validations form (FieldKey) and the new
// per-category Rider Categories forms (CategoryFieldKey) without a
// duplicate copy.
function BoundRow<K extends string>({ label, floorKey, ceilingKey, unit, form, onChange, disabled, error }: {
  label: string
  floorKey: K
  ceilingKey: K
  unit: string
  form: Record<K, string>
  onChange: (key: K, value: string) => void
  disabled?: boolean
  // ✅ NEW — optional live validation message (e.g. a Rider Category range
  // overlapping a sibling's) shown under the row with both steppers
  // outlined red, instead of only surfacing on Save.
  error?: string | null
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3">

      <div className="w-full sm:w-48 shrink-0">
        <div className="text-sm font-semibold text-gray-800">
          {label}
        </div>

        <div className="text-xs text-gray-400">
          Allowed range ({unit})
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-3">

          <StepperInput
            pillLabel="Lowest allowed"
            icon={<ArrowDownToLine className="w-3 h-3" />}
            tone="sky"
            value={form[floorKey]}
            unit={unit}
            onChange={v => onChange(floorKey, v)}
            disabled={disabled}
            invalid={!!error}
          />

          <span className="text-gray-300 mt-4">
            –
          </span>

          <StepperInput
            pillLabel="Highest allowed"
            icon={<ArrowUpToLine className="w-3 h-3" />}
            tone="rose"
            value={form[ceilingKey]}
            unit={unit}
            onChange={v => onChange(ceilingKey, v)}
            disabled={disabled}
            invalid={!!error}
          />

        </div>

        {error && (
          <p className="text-xs text-red-500 mt-1.5">{error}</p>
        )}
      </div>
    </div>
  )
}

// ── Accordion shell — reusable for future settings sections beyond Ride
// Validations (Booking rules, Notification defaults, etc.) ──────────────
function AccordionSection({ title, subtitle, icon, open, onToggle, children }: {
  title: string
  subtitle: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors"
      >

        <div className="flex items-center gap-3 min-w-0">

          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
            {icon}
          </div>

          <div className="text-left min-w-0">

            <div className="text-sm font-bold text-gray-900">
              {title}
            </div>

            <div className="text-xs text-gray-500">
              {subtitle}
            </div>

          </div>

        </div>

        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />

      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 sm:px-5 pb-5">
          {children}
        </div>
      )}

    </div>
  )
}

// ✅ NEW — skeleton placeholder while settings load, matching the same gray
// `animate-pulse` block pattern used on the other admin pages. Mirrors the
// collapsed AccordionSection shape (icon + title/subtitle + chevron), since
// that's the only thing visible on first load anyway (the accordion starts
// closed).
function SettingsAccordionSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-pulse">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <div className="h-3.5 bg-gray-200 rounded w-40" />
            <div className="h-2.5 bg-gray-100 rounded w-56 max-w-full" />
          </div>
        </div>
        <div className="w-5 h-5 rounded bg-gray-200 flex-shrink-0" />
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // Snapshot of the last loaded/saved values.
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM)

  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const hasChanges = (Object.keys(form) as FieldKey[]).some(
    key => form[key] !== savedForm[key]
  )

  // ✅ NEW — Rider Categories (Kid/Teen/Adult) state. Independent from the
  // Attraction Validations state above: its own loading flag, its own
  // per-category form/saved-snapshot/saving maps (keyed by category id),
  // and its own accordion open/close.
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [categories, setCategories] = useState<RiderCategoryPreset[]>([])
  const [categoryForms, setCategoryForms] = useState<Record<number, CategoryFormState>>({})
  const [savedCategoryForms, setSavedCategoryForms] = useState<Record<number, CategoryFormState>>({})
  const [categorySaving, setCategorySaving] = useState<Record<number, boolean>>({})

  const fetchSettings = async () => {
    setLoading(true)

    try {
      const res = await settingsApi.getRideValidation()

      const data: RideValidationSettings =
        res.data?.data ?? res.data

      const next = toForm(data)

      setForm(next)
      setSavedForm(next)
      setUpdatedAt(data.updatedAt ?? null)

    } catch (e: any) {
      toast.error(
        extractApiError(
          e,
          'Failed to load attraction validation settings.'
        )
      )
    } finally {
      setLoading(false)
    }
  }

  // ✅ NEW — loads the 3 rider category presets independently of
  // fetchSettings above, so a slow/failed categories call never blocks the
  // Attraction Validations section from showing.
  const fetchCategories = async () => {
    setCategoriesLoading(true)

    try {
      const res = await riderCategoryApi.getAll()

      const list: RiderCategoryPreset[] =
        res.data?.data ?? res.data ?? []

      const forms: Record<number, CategoryFormState> = {}
      list.forEach(c => { forms[c.id] = categoryToForm(c) })

      setCategories(list)
      setCategoryForms(forms)
      setSavedCategoryForms(forms)

    } catch (e: any) {
      toast.error(
        extractApiError(
          e,
          'Failed to load rider category presets.'
        )
      )
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchCategories()
  }, [])

  // Age/Height/Weight pairs, per category.
  const CATEGORY_FIELD_PAIRS: [CategoryFieldKey, CategoryFieldKey][] = [
    ['minAgeYears', 'maxAgeYears'],
    ['minHeightCm', 'maxHeightCm'],
    ['minWeightKg', 'maxWeightKg'],
  ]

  // ✅ NEW — Kid/Teen/Adult are meant to be mutually exclusive AGE buckets
  // (a rider falls into exactly one, by age), so one category's age range
  // can't creep into a sibling's — e.g. Kid's max age reaching 16 when Teen
  // already starts at 13. Height/weight are intentionally left OUT of this
  // check (only ever called with the age keys below) — real riders of
  // different ages can share the same height/weight range, so those are
  // allowed to overlap between categories. Checks the field currently being
  // edited against every OTHER saved category's range (siblings, from
  // `categories` — their last-saved values, not whatever they happen to be
  // mid-edit). Mirrors the same rule the backend enforces on Save, just
  // surfaced live instead of only after a round trip.
  const categoryOverlapError = (
    categoryId: number, minKey: CategoryFieldKey, maxKey: CategoryFieldKey
  ): string | null => {
    const form = categoryForms[categoryId] ?? EMPTY_CATEGORY_FORM
    if (form[minKey] === '' || form[maxKey] === '') return null
    const min = Number(form[minKey])
    const max = Number(form[maxKey])
    if (isNaN(min) || isNaN(max)) return null

    for (const sibling of categories) {
      if (sibling.id === categoryId) continue
      const sMin = (sibling as unknown as Record<CategoryFieldKey, number>)[minKey]
      const sMax = (sibling as unknown as Record<CategoryFieldKey, number>)[maxKey]
      if (min <= sMax && sMin <= max) {
        return `Overlaps with ${sibling.name}'s current range (${sMin}–${sMax}). Ranges can't cross.`
      }
    }
    return null
  }

  // Same live guard-rail behavior as onChange below, scoped to one
  // category's form (keyed by category id) instead of the single global
  // form.
  const onCategoryChange = (categoryId: number, key: CategoryFieldKey, value: string) => {
    setCategoryForms(prev => {
      const form = prev[categoryId] ?? EMPTY_CATEGORY_FORM
      const saved = savedCategoryForms[categoryId] ?? EMPTY_CATEGORY_FORM

      if (value !== '' && Number(value) < 1) {
        return { ...prev, [categoryId]: { ...form, [key]: saved[key] } }
      }

      const pair = CATEGORY_FIELD_PAIRS.find(
        ([min, max]) => min === key || max === key
      )

      if (pair && value !== '') {
        const [minKey, maxKey] = pair
        const isMin = key === minKey

        const minVal = Number(isMin ? value : form[minKey])
        const maxVal = Number(isMin ? form[maxKey] : value)

        if (
          form[minKey] !== '' &&
          form[maxKey] !== '' &&
          minVal > maxVal
        ) {
          return { ...prev, [categoryId]: { ...form, [key]: saved[key] } }
        }
      }

      return { ...prev, [categoryId]: { ...form, [key]: value } }
    })
  }

  const hasCategoryChanges = (categoryId: number) => {
    const form = categoryForms[categoryId] ?? EMPTY_CATEGORY_FORM
    const saved = savedCategoryForms[categoryId] ?? EMPTY_CATEGORY_FORM
    return (Object.keys(form) as CategoryFieldKey[]).some(k => form[k] !== saved[k])
  }

  const handleSaveCategory = async (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return

    const form = categoryForms[categoryId] ?? EMPTY_CATEGORY_FORM

    const pairs: [string, CategoryFieldKey, CategoryFieldKey][] = [
      ['age', 'minAgeYears', 'maxAgeYears'],
      ['height', 'minHeightCm', 'maxHeightCm'],
      ['weight', 'minWeightKg', 'maxWeightKg'],
    ]

    for (const [label, minKey, maxKey] of pairs) {
      const min = Number(form[minKey])
      const max = Number(form[maxKey])

      if (form[minKey] === '' || form[maxKey] === '' || isNaN(min) || isNaN(max)) {
        toast.error(`${category.name}: both the minimum and maximum ${label} are required.`)
        return
      }

      if (min < 1 || max < 1) {
        toast.error(`${category.name}: values must be at least 1.`)
        return
      }

      if (max <= min) {
        toast.error(`${category.name}: maximum ${label} must be greater than the minimum.`)
        return
      }
    }

    // Age only — height/weight are allowed to overlap between categories.
    const ageOverlapMsg = categoryOverlapError(categoryId, 'minAgeYears', 'maxAgeYears')
    if (ageOverlapMsg) {
      toast.error(`${category.name}: ${ageOverlapMsg}`)
      return
    }

    setCategorySaving(prev => ({ ...prev, [categoryId]: true }))

    try {
      const payload = {
        minAgeYears: Number(form.minAgeYears),
        maxAgeYears: Number(form.maxAgeYears),
        minHeightCm: Number(form.minHeightCm),
        maxHeightCm: Number(form.maxHeightCm),
        minWeightKg: Number(form.minWeightKg),
        maxWeightKg: Number(form.maxWeightKg),
      }

      const res = await riderCategoryApi.update(categoryId, payload)
      const data: RiderCategoryPreset = res.data?.data ?? res.data
      const next = categoryToForm(data)

      setCategoryForms(prev => ({ ...prev, [categoryId]: next }))
      setSavedCategoryForms(prev => ({ ...prev, [categoryId]: next }))
      setCategories(prev => prev.map(c => c.id === categoryId ? data : c))

      toast.success(`${category.name} rider category updated successfully.`)

    } catch (e: any) {
      toast.error(
        extractApiError(
          e,
          `Failed to update the ${category.name} rider category.`
        )
      )
    } finally {
      setCategorySaving(prev => ({ ...prev, [categoryId]: false }))
    }
  }

  // Floor/ceiling pairs.
  const FIELD_PAIRS: [FieldKey, FieldKey][] = [
    ['minHeightFloorCm', 'minHeightCeilingCm'],
    ['maxHeightFloorCm', 'maxHeightCeilingCm'],
    ['minAgeFloorYears', 'minAgeCeilingYears'],
    ['maxAgeFloorYears', 'maxAgeCeilingYears'],
    ['minWeightFloorKg', 'minWeightCeilingKg'],
    ['maxWeightFloorKg', 'maxWeightCeilingKg'],
  ]

  // Live guard rails.
  //
  // IMPORTANT:
  // - Empty string is still allowed temporarily while editing.
  // - 0 is rejected.
  // - Negative numbers are rejected.
  // - Minimum allowed value is 1.
  // - Floor cannot go above ceiling.
  // - Ceiling cannot go below floor.
  // - On an invalid edit, the field snaps back to its original (last
  //   saved) value instead of just freezing on the last valid keystroke —
  //   a clearer "bounce back" so it's obvious the edit didn't stick.
  const onChange = (key: FieldKey, value: string) => {
    setForm(prev => {

      // Do not allow 0 or negative numbers.
      if (value !== '' && Number(value) < 1) {
        return { ...prev, [key]: savedForm[key] }
      }

      const pair = FIELD_PAIRS.find(
        ([floor, ceil]) => floor === key || ceil === key
      )

      if (pair && value !== '') {

        const [floorKey, ceilKey] = pair

        const isFloor = key === floorKey

        const floorVal = Number(
          isFloor ? value : prev[floorKey]
        )

        const ceilVal = Number(
          isFloor ? prev[ceilKey] : value
        )

        if (
          prev[floorKey] !== '' &&
          prev[ceilKey] !== '' &&
          floorVal > ceilVal
        ) {
          return { ...prev, [key]: savedForm[key] }
        }
      }

      return {
        ...prev,
        [key]: value
      }
    })
  }

  const handleSave = async () => {

    // Client-side sanity check mirrors the backend's floor<ceiling rule.
    const pairs: [string, FieldKey, FieldKey][] = [
      [
        'Minimum height',
        'minHeightFloorCm',
        'minHeightCeilingCm'
      ],
      [
        'Maximum height',
        'maxHeightFloorCm',
        'maxHeightCeilingCm'
      ],
      [
        'Minimum age',
        'minAgeFloorYears',
        'minAgeCeilingYears'
      ],
      [
        'Maximum age',
        'maxAgeFloorYears',
        'maxAgeCeilingYears'
      ],
      [
        'Minimum weight',
        'minWeightFloorKg',
        'minWeightCeilingKg'
      ],
      [
        'Maximum weight',
        'maxWeightFloorKg',
        'maxWeightCeilingKg'
      ],
    ]

    for (const [label, floorKey, ceilingKey] of pairs) {

      const floor = Number(form[floorKey])
      const ceiling = Number(form[ceilingKey])

      if (
        form[floorKey] === '' ||
        form[ceilingKey] === '' ||
        isNaN(floor) ||
        isNaN(ceiling)
      ) {
        toast.error(
          `${label}: both the lowest and highest allowed values are required.`
        )
        return
      }

      // Extra protection: values must be at least 1.
      if (floor < 1 || ceiling < 1) {
        toast.error(
          `${label}: values must be at least 1.`
        )
        return
      }

      if (ceiling <= floor) {
        toast.error(
          `${label}: the highest allowed value must be greater than the lowest.`
        )
        return
      }
    }

    setSaving(true)

    try {

      const payload: Record<string, number> = {}

      for (const key of Object.keys(form) as FieldKey[]) {
        payload[key] = Number(form[key])
      }

      const res = await settingsApi.updateRideValidation(payload)

      const data: RideValidationSettings =
        res.data?.data ?? res.data

      const next = toForm(data)

      setForm(next)
      setSavedForm(next)
      setUpdatedAt(data.updatedAt ?? null)

      // ✅ NEW — the backend may have just auto-clamped a Kid/Teen/Adult
      // preset back inside these new bounds (see
      // RideValidationSettingsService.ClampCategoryPresetsToSettingsAsync),
      // so refetch the categories to reflect that immediately instead of
      // leaving the cards showing stale, now-invalid numbers until the
      // admin manually reloads the page.
      fetchCategories()

      toast.success(
        'Attraction validation settings updated successfully.'
      )

    } catch (e: any) {

      toast.error(
        extractApiError(
          e,
          'Failed to update attraction validation settings.'
        )
      )

    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">

        <div>

          <h1 className="text-2xl font-bold text-gray-900">
            Settings
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Admin-configurable system rules — no code changes or redeploys needed.
          </p>

        </div>

      </div>

      {loading ? (

        <SettingsAccordionSkeleton />

      ) : (

        <AccordionSection
          title="Attraction Validations"
          subtitle="Lowest and highest allowed values for each attraction restriction field"
          icon={<FerrisWheel className="w-5 h-5" />}
          open={open}
          onToggle={() => setOpen(p => !p)}
        >

          <div className="divide-y divide-gray-100">

            <BoundRow
              label="Minimum Height"
              unit="cm"
              floorKey="minHeightFloorCm"
              ceilingKey="minHeightCeilingCm"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

            <BoundRow
              label="Maximum Height"
              unit="cm"
              floorKey="maxHeightFloorCm"
              ceilingKey="maxHeightCeilingCm"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

            <BoundRow
              label="Minimum Age"
              unit="years"
              floorKey="minAgeFloorYears"
              ceilingKey="minAgeCeilingYears"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

            <BoundRow
              label="Maximum Age"
              unit="years"
              floorKey="maxAgeFloorYears"
              ceilingKey="maxAgeCeilingYears"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

            <BoundRow
              label="Minimum Weight"
              unit="kg"
              floorKey="minWeightFloorKg"
              ceilingKey="minWeightCeilingKg"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

            <BoundRow
              label="Maximum Weight"
              unit="kg"
              floorKey="maxWeightFloorKg"
              ceilingKey="maxWeightCeilingKg"
              form={form}
              onChange={onChange}
              disabled={saving}
            />

          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-1 border-t border-gray-100">

            <div className="text-xs text-gray-400">

              {updatedAt &&
                `Last updated ${new Date(updatedAt).toLocaleString('en-PH')}`}

            </div>

            <div className="flex items-center gap-2">

              {/* ✅ NEW — only shows once the form has unsaved edits,
                  letting the admin discard them and go back to the last
                  saved values without refreshing the page. */}
              {hasChanges && (
                <button
                  type="button"
                  onClick={() => setForm(savedForm)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  Undo changes
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >

                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}

                Save changes

              </button>

            </div>

          </div>

        </AccordionSection>

      )}

      {/* ✅ NEW — Rider Categories: the 3 fixed Kid/Teen/Adult presets.
          Loads independently of the Attraction Validations section above
          (own skeleton, own loading flag) so a slow categories fetch never
          blocks the first section from rendering. */}
      {categoriesLoading ? (

        <SettingsAccordionSkeleton />

      ) : (

        <AccordionSection
          title="Rider Categories"
          subtitle="Age, height, and weight ranges for Kid / Teen / Adult, plus General Admission — used to tag an attraction's restrictions"
          icon={<Layers className="w-5 h-5" />}
          open={categoriesOpen}
          onToggle={() => setCategoriesOpen(p => !p)}
        >

          <div className="divide-y divide-gray-200">

            {categories.map(cat => {
              const Icon = categoryIcon(cat.name)
              const form = categoryForms[cat.id] ?? EMPTY_CATEGORY_FORM
              const isSaving = categorySaving[cat.id] ?? false
              const changed = hasCategoryChanges(cat.id)

              // ✅ NEW — live overlap check, AGE only (height/weight are
              // allowed to overlap between categories), so a value that
              // crosses into a sibling category's age range shows red the
              // instant it's typed instead of only failing on Save.
              const ageOverlap = categoryOverlapError(cat.id, 'minAgeYears', 'maxAgeYears')
              const hasOverlap = !!ageOverlap

              return (
                <div key={cat.id} className="py-5 first:pt-3 last:pb-0">

                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                  </div>

                  <div className="divide-y divide-gray-100">

                    <BoundRow
                      label="Age"
                      unit="years"
                      floorKey="minAgeYears"
                      ceilingKey="maxAgeYears"
                      form={form}
                      onChange={(key, value) => onCategoryChange(cat.id, key, value)}
                      disabled={isSaving}
                      error={ageOverlap}
                    />

                    <BoundRow
                      label="Height"
                      unit="cm"
                      floorKey="minHeightCm"
                      ceilingKey="maxHeightCm"
                      form={form}
                      onChange={(key, value) => onCategoryChange(cat.id, key, value)}
                      disabled={isSaving}
                    />

                    <BoundRow
                      label="Weight"
                      unit="kg"
                      floorKey="minWeightKg"
                      ceilingKey="maxWeightKg"
                      form={form}
                      onChange={(key, value) => onCategoryChange(cat.id, key, value)}
                      disabled={isSaving}
                    />

                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3 pt-3 mt-1">

                    <div className="text-xs text-gray-400">
                      {cat.updatedAt &&
                        `Last updated ${new Date(cat.updatedAt).toLocaleString('en-PH')}`}
                    </div>

                    <div className="flex items-center gap-2">

                      {changed && (
                        <button
                          type="button"
                          onClick={() => setCategoryForms(prev => ({ ...prev, [cat.id]: savedCategoryForms[cat.id] ?? EMPTY_CATEGORY_FORM }))}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Undo
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSaveCategory(cat.id)}
                        disabled={isSaving || !changed || hasOverlap}
                        title={hasOverlap ? 'Fix the overlapping range before saving.' : undefined}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save
                      </button>

                    </div>

                  </div>

                </div>
              )
            })}

            {/* ✅ NEW — "General Admission" — not a real row in the
                database. Its Age/Height/Weight numbers always mirror the
                widest range the Attraction Validation Settings above
                allow (floor of the Min side through ceiling of the Max
                side), so it stays accurate the instant those settings are
                saved — no separate data to keep in sync, and nothing here
                to edit or delete. */}
            <div className="py-4 last:pb-0">

              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">General Admission</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  Auto
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-3">
                Open to every visitor — always matches the widest range allowed by Attraction Validation Settings above, and updates the moment those settings are saved.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-400 mb-0.5">Age</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {form.minAgeFloorYears || '—'}–{form.maxAgeCeilingYears || '—'} yrs
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-400 mb-0.5">Height</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {form.minHeightFloorCm || '—'}–{form.maxHeightCeilingCm || '—'} cm
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-400 mb-0.5">Weight</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {form.minWeightFloorKg || '—'}–{form.maxWeightCeilingKg || '—'} kg
                  </div>
                </div>

              </div>

            </div>

          </div>

        </AccordionSection>

      )}

    </div>
  )
}