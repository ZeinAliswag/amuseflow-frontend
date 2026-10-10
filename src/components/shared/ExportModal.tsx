import { FileSpreadsheet, Loader2, X } from 'lucide-react'

export type ExportFormat = 'xlsx' | 'csv'

// Confirm-before-export dialog shared by the Admin Bookings, Users and Logs
// pages. Exports are Excel-only (formatted report with park logo/letterhead);
// the download starts only once the admin confirms.
export function ExportModal({ open, entityLabel, filtersSummary, fileBase, loading, onConfirm, onCancel }: {
  open: boolean
  /** e.g. "bookings" */
  entityLabel: string
  /** e.g. "Status: Pending · Payment: Paid" */
  filtersSummary: string
  /** filename without extension */
  fileBase: string
  loading: boolean
  onConfirm: (format: ExportFormat) => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-gray-900">Export {entityLabel} to Excel?</div>
              <div className="text-[12px] text-gray-500">Are you sure you want to download this file?</div>
            </div>
          </div>
          <button onClick={onCancel} disabled={loading} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[11px] text-gray-600 space-y-1">
            <div><span className="font-semibold text-gray-700">Includes:</span> every {entityLabel.replace(/s$/, '')} matching your current filters — all pages, not just the one on screen.</div>
            <div><span className="font-semibold text-gray-700">Filters:</span> {filtersSummary}</div>
            <div><span className="font-semibold text-gray-700">Format:</span> Excel report with park logo, address, styled headings and Prepared by / Verified by.</div>
            <div className="break-all"><span className="font-semibold text-gray-700">File:</span> {fileBase}.xlsx</div>
          </div>
        </div>

        <div className="flex gap-2.5 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-[12px] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onConfirm('xlsx')} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</> : 'Yes, download'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportModal
