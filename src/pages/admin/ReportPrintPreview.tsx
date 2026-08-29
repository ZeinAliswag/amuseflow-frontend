import { useEffect, useState } from 'react'

// ── Print preview — a REAL route of this app (not a blob:/about:blank tab
// we try to fake a favicon onto). "Print report" on Reports.tsx opens a
// blank tab, stashes the already-generated PDF's blob URL on the ORIGINAL
// window (window.opener from here), then navigates that new tab to this
// route. Because the tab is now genuinely at our own /print-preview URL,
// it loads through index.html like any other page — so it picks up the
// real Fantasyland favicon the normal way, instead of relying on browsers
// (inconsistently) honoring a <link rel="icon"> injected into a blob:/
// about:blank document. ──
export default function ReportPrintPreview() {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const opener = window.opener as (Window & {
      __amuseflowPrintPdfUrl?: string
      __amuseflowPrintTitle?: string
    }) | null

    if (opener?.__amuseflowPrintPdfUrl) {
      setSrc(opener.__amuseflowPrintPdfUrl)
      if (opener.__amuseflowPrintTitle) document.title = opener.__amuseflowPrintTitle
    } else {
      setMissing(true)
    }
  }, [])

  if (missing) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-sm px-6 text-center">
        No report to preview here — open this from the Reports page's "Print report" button.
      </div>
    )
  }

  if (!src) return null

  return (
    <embed
      src={src}
      type="application/pdf"
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', border: 'none' }}
    />
  )
}
