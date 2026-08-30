import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'

// ── Print preview — a REAL route of this app (not a blob:/about:blank tab
// we try to fake a favicon onto). "Print report" on Reports.tsx opens a
// blank tab, stashes the already-generated PDF's blob URL on the ORIGINAL
// window (window.opener from here), then navigates that new tab to this
// route. Because the tab is now genuinely at our own /print-preview URL,
// it loads through index.html like any other page — so it picks up the
// real Fantasyland favicon the normal way, instead of relying on browsers
// (inconsistently) honoring a <link rel="icon"> injected into a blob:/
// about:blank document.
//
// Ctrl/Cmd+P is still blocked (by the inline script in index.html) — the
// <embed> below is Chrome's own built-in PDF viewer running in a separate
// process, and the moment the user clicks/scrolls inside it, THAT process
// (not our page) owns keyboard focus, so a page-level Ctrl+P block alone
// can't reliably catch it. pointer-events: none keeps every click/scroll
// from ever reaching the plugin, so focus (and Ctrl+P) always stays with
// our own page — Prev/Next buttons below jump pages via the PDF viewer's
// #page= URL fragment instead of relying on the plugin's own scrolling.
//
// The one deliberate way to print is the Print button: it explicitly
// focuses the plugin itself, then calls window.print() — the only
// combination that gets Chrome to print the actual PDF instead of a blank
// page — so printing only ever happens as a real, intentional click. ──
export default function ReportPrintPreview() {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [ready, setReady] = useState(false)
  const embedRef = useRef<HTMLEmbedElement>(null)

  useEffect(() => {
    const opener = window.opener as (Window & {
      __amuseflowPrintPdfUrl?: string
      __amuseflowPrintTitle?: string
      __amuseflowPrintPageCount?: number
    }) | null

    if (opener?.__amuseflowPrintPdfUrl) {
      setSrc(opener.__amuseflowPrintPdfUrl)
      if (opener.__amuseflowPrintTitle) document.title = opener.__amuseflowPrintTitle
      if (opener.__amuseflowPrintPageCount) setPageCount(opener.__amuseflowPrintPageCount)
    } else {
      setMissing(true)
    }
  }, [])

  useEffect(() => {
    if (!src) return
    // Backstop in case the <embed> 'load' event never fires — don't leave
    // the Print button disabled forever.
    const fallback = setTimeout(() => setReady(true), 1800)
    return () => clearTimeout(fallback)
  }, [src])

  const triggerPrint = () => {
    if (!ready) return
    embedRef.current?.focus()
    requestAnimationFrame(() => window.print())
  }

  if (missing) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-sm px-6 text-center">
        No report to preview here — open this from the Reports page's "Print report" button.
      </div>
    )
  }

  if (!src) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#525659' }}>
      <embed
        ref={embedRef}
        src={`${src}#page=${page}&toolbar=0&navpanes=0`}
        type="application/pdf"
        tabIndex={-1}
        onLoad={() => setTimeout(() => setReady(true), 500)}
        style={{
          position: 'fixed', inset: 0, width: '100vw', height: '100vh', border: 'none',
          pointerEvents: 'none', // ← the crux of the Ctrl+P fix; see comment above
        }}
      />
      {pageCount > 1 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-gray-900/90 text-white text-sm shadow-lg">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="disabled:opacity-30 hover:text-emerald-400 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {page} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="disabled:opacity-30 hover:text-emerald-400 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={triggerPrint}
        disabled={!ready}
        title="Print"
        className="fixed bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg hover:bg-gray-800 active:scale-95 transition disabled:opacity-40"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
    </div>
  )
}
