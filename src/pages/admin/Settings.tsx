import { useEffect, useState } from 'react'
import {
  ChevronDown, Save, Loader2, FerrisWheel,
  ArrowDownToLine, ArrowUpToLine, Minus, Plus
} from 'lucide-react'
import type { RideValidationSettings } from '../../types'
import { settingsApi, extractApiError } from '../../services/api'
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
    minHeightFloorCm: String(s.minHeightFloorCm),
    minHeightCeilingCm: String(s.minHeightCeilingCm),
    maxHeightFloorCm: String(s.maxHeightFloorCm),
    maxHeightCeilingCm: String(s.maxHeightCeilingCm),
    minAgeFloorYears: String(s.minAgeFloorYears),
    minAgeCeilingYears: String(s.minAgeCeilingYears),
    maxAgeFloorYears: String(s.maxAgeFloorYears),
    maxAgeCeilingYears: String(s.maxAgeCeilingYears),
    minWeightFloorKg: String(s.minWeightFloorKg),
    minWeightCeilingKg: String(s.minWeightCeilingKg),
    maxWeightFloorKg: String(s.maxWeightFloorKg),
    maxWeightCeilingKg: String(s.maxWeightCeilingKg),
  }
}

// ── Stepper input — a labeled pill (Floor/Ceiling, with a directional icon)
// sitting on top of a −/+ stepper, instead of a bare number box with a plain
// text label. Clicking −/+ nudges the value by 1; the number itself is still
// directly editable/selectable. ──────────────────────────────────────────
function StepperInput({ pillLabel, icon, tone, value, unit, onChange, disabled }: {
  pillLabel: string
  icon: React.ReactNode
  tone: 'sky' | 'rose'
  value: string
  unit: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const step = (delta: number) => {
    const current = Number(value) || 0
    onChange(String(current + delta))
  }

  const toneClasses = tone === 'sky'
    ? 'bg-sky-50 text-sky-700 border-sky-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'

  return (
    <div className="flex-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold mb-1.5 ${toneClasses}`}>
        {icon} {pillLabel}
      </span>
      <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-300 transition-shadow">
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
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 px-1 py-2 text-sm text-center bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-1 text-xs text-gray-400 whitespace-nowrap">{unit}</span>
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
function BoundRow({ label, floorKey, ceilingKey, unit, form, onChange, disabled }: {
  label: string
  floorKey: FieldKey
  ceilingKey: FieldKey
  unit: string
  form: FormState
  onChange: (key: FieldKey, value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3">
      <div className="w-full sm:w-48 shrink-0">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-400">Allowed range ({unit})</div>
      </div>
      <div className="flex items-center gap-3 flex-1">
        <StepperInput
          pillLabel="Lowest allowed"
          icon={<ArrowDownToLine className="w-3 h-3" />}
          tone="sky"
          value={form[floorKey]}
          unit={unit}
          onChange={v => onChange(floorKey, v)}
          disabled={disabled}
        />
        <span className="text-gray-300 mt-4">–</span>
        <StepperInput
          pillLabel="Highest allowed"
          icon={<ArrowUpToLine className="w-3 h-3" />}
          tone="rose"
          value={form[ceilingKey]}
          unit={unit}
          onChange={v => onChange(ceilingKey, v)}
          disabled={disabled}
        />
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
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
            {icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">{title}</div>
            <div className="text-xs text-gray-500">{subtitle}</div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  // ✅ NEW — a snapshot of the last loaded/saved values, so the Save button
  // can stay disabled until the admin has actually changed something. Kept
  // in sync with `form` right after every successful fetch/save.
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const hasChanges = (Object.keys(form) as FieldKey[]).some(key => form[key] !== savedForm[key])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await settingsApi.getRideValidation()
      const data: RideValidationSettings = res.data?.data ?? res.data
      const next = toForm(data)
      setForm(next)
      setSavedForm(next)
      setUpdatedAt(data.updatedAt ?? null)
    } catch (e: any) {
      toast.error(extractApiError(e, 'Failed to load ride validation settings.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  const onChange = (key: FieldKey, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    // Client-side sanity check mirrors the backend's floor<ceiling rule —
    // fails fast with the same message instead of round-tripping first.
    const pairs: [string, FieldKey, FieldKey][] = [
      ['Minimum height', 'minHeightFloorCm', 'minHeightCeilingCm'],
      ['Maximum height', 'maxHeightFloorCm', 'maxHeightCeilingCm'],
      ['Minimum age', 'minAgeFloorYears', 'minAgeCeilingYears'],
      ['Maximum age', 'maxAgeFloorYears', 'maxAgeCeilingYears'],
      ['Minimum weight', 'minWeightFloorKg', 'minWeightCeilingKg'],
      ['Maximum weight', 'maxWeightFloorKg', 'maxWeightCeilingKg'],
    ]

    for (const [label, floorKey, ceilingKey] of pairs) {
      const floor = Number(form[floorKey])
      const ceiling = Number(form[ceilingKey])
      if (form[floorKey] === '' || form[ceilingKey] === '' || isNaN(floor) || isNaN(ceiling)) {
        toast.error(`${label}: both the lowest and highest allowed values are required.`)
        return
      }
      if (ceiling <= floor) {
        toast.error(`${label}: the highest allowed value must be greater than the lowest.`)
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
      const data: RideValidationSettings = res.data?.data ?? res.data
      const next = toForm(data)
      setForm(next)
      setSavedForm(next)
      setUpdatedAt(data.updatedAt ?? null)
      toast.success('Ride validation settings updated successfully.')
    } catch (e: any) {
      toast.error(extractApiError(e, 'Failed to update ride validation settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Admin-configurable system rules — no code changes or redeploys needed.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <AccordionSection
          title="Ride Validations"
          subtitle="Lowest and highest allowed values for each ride restriction field"
          icon={<FerrisWheel className="w-5 h-5" />}
          open={open}
          onToggle={() => setOpen(p => !p)}
        >
          <div className="divide-y divide-gray-100">
            <BoundRow label="Minimum Height" unit="cm" floorKey="minHeightFloorCm" ceilingKey="minHeightCeilingCm" form={form} onChange={onChange} disabled={saving} />
            <BoundRow label="Maximum Height" unit="cm" floorKey="maxHeightFloorCm" ceilingKey="maxHeightCeilingCm" form={form} onChange={onChange} disabled={saving} />
            <BoundRow label="Minimum Age" unit="years" floorKey="minAgeFloorYears" ceilingKey="minAgeCeilingYears" form={form} onChange={onChange} disabled={saving} />
            <BoundRow label="Maximum Age" unit="years" floorKey="maxAgeFloorYears" ceilingKey="maxAgeCeilingYears" form={form} onChange={onChange} disabled={saving} />
            <BoundRow label="Minimum Weight" unit="kg" floorKey="minWeightFloorKg" ceilingKey="minWeightCeilingKg" form={form} onChange={onChange} disabled={saving} />
            <BoundRow label="Maximum Weight" unit="kg" floorKey="maxWeightFloorKg" ceilingKey="maxWeightCeilingKg" form={form} onChange={onChange} disabled={saving} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-1 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              {updatedAt && `Last updated ${new Date(updatedAt).toLocaleString('en-PH')}`}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </AccordionSection>
      )}
    </div>
  )
}
