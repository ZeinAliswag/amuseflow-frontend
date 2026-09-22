import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff, Sparkles, Shield, Ticket, CreditCard, Phone, PartyPopper, UserPlus, CheckCircle2, Circle, X, FileText, KeyRound, ArrowLeft, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/shared'
import toast from 'react-hot-toast'

// ✅ NEW — shared between the desktop right panel (always visible, lg+) and
// the mobile/tablet slide-in drawer (opened on demand) below, so the two
// never drift out of sync content-wise.
const LOGIN_FEATURES = [
  { icon: <Ticket className="w-4 h-4 text-rose-300" />, title: 'Book ride slots', sub: 'Reserve spots in advance. Skip the queue.' },
  { icon: <Shield className="w-4 h-4 text-blue-300" />, title: 'Role-based access', sub: 'One login serves all three roles automatically.' },
  { icon: <CreditCard className="w-4 h-4 text-amber-300" />, title: 'Pay at the ride', sub: 'Attendant collects payment on-site before boarding.' },
]

const LOGIN_ROLES = [
  { dot: 'bg-emerald-400', name: 'Visitor', desc: 'Browse rides, book slots, cancel reservations.' },
  { dot: 'bg-blue-400', name: 'Admin', desc: 'Manage rides, schedules, bookings, users and logs.' },
  { dot: 'bg-amber-400', name: 'Ride Attendant', desc: 'Verify codes, collect payment, complete rides.' },
]

// ✅ NEW — the "why AmuseFlow" pitch (badge, heading, feature list, role
// list). Rendered as-is inside the desktop panel, and again inside the
// mobile/tablet drawer, so both stay pixel-identical without copy-pasting.
function LoginInfoContent() {
  return (
    <>
      <div className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs px-3 py-1.5 rounded-full border border-white/20 mb-6">
        <Sparkles className="w-3.5 h-3.5" /> Welcome to the magic
      </div>
      <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
        Your adventure<br />starts here
      </h2>
      <p className="text-sm text-white/70 mb-8 leading-relaxed">
        One login for all roles. Your username and password determine which portal you access.
      </p>

      {/* Feature list */}
      <div className="space-y-4 mb-8">
        {LOGIN_FEATURES.map(item => (
          <div key={item.title} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-0.5">{item.title}</div>
              <div className="text-xs text-white/60">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Roles */}
      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">User roles</div>
      <div className="space-y-2">
        {LOGIN_ROLES.map(r => (
          <div key={r.name} className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.dot}`} />
            <div>
              <div className="text-xs font-semibold text-white">{r.name}</div>
              <div className="text-[10px] text-white/55">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Formats digits as the Filipino mobile style: 09XX XXX XXXX
function formatPHMobile(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean)
  return parts.join(' ')
}

// ✅ NEW — capitalizes the first letter of each word as the person types
// (e.g. "juan" -> "Juan", "dela cruz" -> "Dela Cruz"), without touching the
// rest of what they've typed so far.
function capitalizeName(raw: string) {
  return raw.replace(/(^|\s)([a-z])/g, (_, boundary, letter) => boundary + letter.toUpperCase())
}

// ✅ FIXED — was `e.response?.data?.message ?? fallback` everywhere in this
// file. That only covers OUR OWN `ApiResponse.Fail(...)` error shape
// (`{ message: "..." }`). It missed ASP.NET's automatic model-validation
// 400s (thrown before a controller/service ever runs, e.g. a password DTO's
// [RegularExpression] rejecting a character), which come back shaped as
// `{ errors: { NewPassword: ["..."] } }` with no `message` field at all —
// so those silently fell through to a useless generic fallback instead of
// the actual reason. Same helper already duplicated in MyBookings.tsx /
// VisitorDashboard.tsx / AttendantDashboard.tsx / admin/Bookings.tsx.
function getErrorMessage(e: any, fallback = 'Something went wrong. Please try again.') {
  const data = e?.response?.data
  if (!data) return fallback
  if (data.message) return data.message
  if (data.errors) {
    const firstKey = Object.keys(data.errors)[0]
    const firstVal = firstKey ? data.errors[firstKey] : null
    if (Array.isArray(firstVal) && firstVal.length) return firstVal[0]
  }
  return fallback
}

// ✅ CHANGED — Terms & Services content used to be hardcoded right here
// (TERMS_SECTIONS/TERMS_LAST_UPDATED constants). The "terms of service"
// link on the login card used to be a bare <span> with no onClick at all
// — fixed first by giving it a real document in a modal, and now made
// dynamic: an Admin can edit the content from Settings → Terms & Services
// without a code change or redeploy, and this modal fetches the current
// version from the backend every time it's opened.
//
// `content` uses a lightweight, human-editable convention rather than a
// nested JSON structure: a line starting with "## " begins a new numbered
// section (its title); everything after it up to the next "## " is that
// section's body, with a blank line splitting it into separate paragraphs.
// Same parsing logic is duplicated in admin/Settings.tsx (for its live
// preview) — matches this codebase's established per-file helper
// convention rather than a shared utils module.
function parseTermsContent(raw: string): { title: string; body: string[] }[] {
  const lines = raw.split(/\r?\n/)
  const sections: { title: string; body: string[] }[] = []
  let current: { title: string; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const paragraphs = current.lines
      .join('\n')
      .split(/\n\s*\n/)
      .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
    sections.push({ title: current.title, body: paragraphs })
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      current = { title: line.slice(3).trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()

  return sections
}

function TermsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sections, setSections] = useState<{ title: string; body: string[] }[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get('/api/termscontent')
      const payload = data?.data ?? data
      setSections(parseTermsContent(payload.content ?? ''))
      setUpdatedAt(payload.updatedAt ?? null)
    } catch (e: any) {
      setLoadError(getErrorMessage(e, 'Failed to load Terms & Services. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-[14px]">Terms & Services</div>
              <div className="text-[10px] text-gray-400">
                {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}` : ' '}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : loadError ? (
            <div className="text-center py-6">
              <p className="text-[12px] text-gray-500 mb-3">{loadError}</p>
              <button onClick={load}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 transition-colors">
                Try again
              </button>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                These Terms & Services govern your use of AmuseFlow, the online reservation system for Glorious Fantasyland. Please read them before booking a ride.
              </p>
              {sections.map(s => (
                <div key={s.title}>
                  <div className="text-[12.5px] font-bold text-gray-900 mb-1">{s.title}</div>
                  {s.body.map((p, i) => (
                    <p key={i} className="text-[12px] text-gray-600 leading-relaxed mb-1.5 last:mb-0">{p}</p>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ✅ NEW — Forgot Password. There's no email on file (this system uses
// Username + a PH mobile ContactNumber — see backend User entity), so
// there's no "check your inbox" step: identity is confirmed by matching
// Username + ContactNumber, then the visitor sets a new password right
// there in this same modal. Three internal steps: 'verify' -> 'reset' ->
// 'done'. Deliberately a modal (not a route) so it stays reachable from the
// login card without adding a public page.
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'verify' | 'reset' | 'done'>('verify')
  const [loading, setLoading] = useState(false)

  // Step 1 — identity
  const [fpUsername, setFpUsername] = useState('')
  const [fpContact, setFpContact] = useState('')
  const [verifyError, setVerifyError] = useState('')

  // Carried from step 1 into step 2
  const [resetToken, setResetToken] = useState('')
  const [fullName, setFullName] = useState('')

  // Step 2 — new password
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [resetError, setResetError] = useState('')

  // ✅ FIXED — the backend only accepts letters, numbers, and @$!%*?& in a
  // password (see ForgotPasswordResetRequest's [RegularExpression]). These
  // checks used to only confirm the required categories were PRESENT, never
  // that every character in the password was actually one of the allowed
  // ones — so something like "(MyPass@100)" showed 4/4 green checks here,
  // then got silently rejected server-side (ASP.NET's automatic model
  // validation, which returns a different error shape than our own API
  // responses — see getErrorMessage above) with an unhelpful generic error.
  // The new last check catches that before it's ever submitted.
  const pwChecks = [
    { label: '8+ characters', ok: newPw.length >= 8 },
    { label: '1 uppercase (A-Z)', ok: /[A-Z]/.test(newPw) },
    { label: '1 number (0-9)', ok: /[0-9]/.test(newPw) },
    { label: '1 special (@$!%*?&)', ok: /[@$!%*?&]/.test(newPw) },
    { label: 'Only letters, numbers, @$!%*?&', ok: /^[A-Za-z\d@$!%*?&]+$/.test(newPw) },
  ]

  const doVerify = async () => {
    setVerifyError('')
    if (!fpUsername.trim()) { setVerifyError('Username is required.'); return }
    const digits = fpContact.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(digits)) { setVerifyError('Enter a valid PH mobile number (e.g. 0912 345 6789).'); return }

    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/forgot-password/verify', {
        username: fpUsername.trim(),
        contactNumber: digits,
      })
      const payload = data?.data ?? data
      setResetToken(payload.resetToken)
      setFullName(payload.fullName)
      setStep('reset')
    } catch (e: any) {
      setVerifyError(getErrorMessage(e))
    } finally { setLoading(false) }
  }

  const doReset = async () => {
    setResetError('')
    if (!pwChecks.every(c => c.ok)) { setResetError('Password does not meet all requirements.'); return }
    if (newPw !== confirmPw) { setResetError('Passwords do not match.'); return }

    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password/reset', {
        resetToken,
        newPassword: newPw,
        confirmPassword: confirmPw,
      })
      setStep('done')
    } catch (e: any) {
      setResetError(getErrorMessage(e))
    } finally { setLoading(false) }
  }

  const startOver = () => {
    setStep('verify')
    setResetToken(''); setFullName('')
    setNewPw(''); setConfirmPw('')
    setVerifyError(''); setResetError('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              {step === 'done' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <KeyRound className="w-5 h-5 text-rose-600" />}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-[14px]">
                {step === 'verify' ? 'Forgot password' : step === 'reset' ? 'Set a new password' : 'Password reset'}
              </div>
              <div className="text-[10px] text-gray-400">
                {step === 'verify' ? 'Step 1 of 2 — confirm it\'s you' : step === 'reset' ? `Step 2 of 2 — resetting for ${fullName}` : 'All done'}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                AmuseFlow accounts don't have an email on file, so we confirm it's you using your username and the mobile number registered to your account.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                    placeholder="e.g. john01"
                    value={fpUsername}
                    onChange={e => { setFpUsername(e.target.value); if (verifyError) setVerifyError('') }}
                    onKeyDown={e => e.key === 'Enter' && doVerify()} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Registered contact number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                    placeholder="0912 345 6789" inputMode="numeric" maxLength={13}
                    value={fpContact}
                    onChange={e => { setFpContact(formatPHMobile(e.target.value)); if (verifyError) setVerifyError('') }}
                    onKeyDown={e => e.key === 'Enter' && doVerify()} />
                </div>
              </div>
              {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
              <button onClick={doVerify} disabled={loading}
                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
                {loading ? <Spinner className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />} Verify account
              </button>
            </div>
          )}

          {step === 'reset' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                    type={showNewPw ? 'text' : 'password'} placeholder="Min. 8 characters"
                    value={newPw} onChange={e => { setNewPw(e.target.value); if (resetError) setResetError('') }} />
                  <button type="button" onClick={() => setShowNewPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                    type={showConfirmPw ? 'text' : 'password'} placeholder="Re-enter new password"
                    value={confirmPw} onChange={e => { setConfirmPw(e.target.value); if (resetError) setResetError('') }} />
                  <button type="button" onClick={() => setShowConfirmPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-1.5 text-[10px]">
                {pwChecks.map(c => (
                  <span key={c.label} className={`flex items-center gap-1 transition-colors ${c.label.startsWith('Only') ? 'col-span-2' : ''} ${c.ok ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                    {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 flex-shrink-0" />} {c.label}
                  </span>
                ))}
              </div>
              {confirmPw && newPw !== confirmPw && <div className="text-[10px] text-red-500">⚠ Passwords do not match</div>}
              {resetError && <p className="text-xs text-red-500">{resetError}</p>}
              <button onClick={doReset} disabled={loading}
                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
                {loading ? <Spinner className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />} Reset password
              </button>
              <button type="button" onClick={startOver}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Start over
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-sm font-bold text-gray-900 mb-1">Password reset successfully</div>
              <div className="text-xs text-gray-500 mb-5">You can now sign in with your new password.</div>
              <button onClick={onClose}
                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-all shadow-sm">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const [mode, setMode]       = useState<'login'|'register'>('login')
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [loading, setLoading] = useState(false)
  // ✅ NEW — on mobile/tablet the rose "why AmuseFlow" panel doesn't fit
  // beside the form, so instead of just hiding it outright it moves into a
  // slide-in drawer the visitor can pull open on demand (see below).
  const [infoOpen, setInfoOpen] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [regUser, setRegUser]     = useState('')
  const [regContact, setRegContact] = useState('')
  const [regPw, setRegPw]         = useState('')
  const [regPw2, setRegPw2]       = useState('')

  const auth     = useAuth()
  const navigate = useNavigate()

  const doLogin = async () => {
    // ✅ CHANGED — was an inline red banner (setError); now toast, matching
    // every other form in the app.
    if (!username || !password) { toast.error('Username and password are required.'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { username, password })
      await auth.login(data.data ?? data)
      const me   = await api.get('/api/user/me')
      const role = me.data?.data?.role ?? me.data?.role
      toast.success(`Welcome back, ${me.data?.data?.firstName ?? me.data?.firstName}!`)
      if (role === 'Admin')               navigate('/admin')
      else if (role === 'Ride Attendant') navigate('/attendant')
      else                                navigate('/visitor')
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Invalid username or password.'))
    } finally { setLoading(false) }
  }

  const doRegister = async () => {
    if (!firstName || !lastName || !regUser || !regContact || !regPw || !regPw2) { toast.error('All fields are required.'); return }
    const contactDigits = regContact.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(contactDigits)) { toast.error('Enter a valid PH mobile number (e.g. 0912 345 6789).'); return }
    if (regPw.length < 8)             { toast.error('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(regPw))         { toast.error('Password must have at least 1 uppercase letter.'); return }
    if (!/[a-z]/.test(regPw))         { toast.error('Password must have at least 1 lowercase letter.'); return }
    if (!/[0-9]/.test(regPw))         { toast.error('Password must have at least 1 number.'); return }
    if (!/[@$!%*?&]/.test(regPw))     { toast.error('Password must have at least 1 special character (@$!%*?&).'); return }
    if (regPw !== regPw2)             { toast.error('Passwords do not match.'); return }
    setLoading(true)
    try {
      await api.post('/api/auth/register', {
        firstName, lastName, username: regUser,
        contactNumber: contactDigits,
        password: regPw, confirmPassword: regPw2
      })
      toast.success('Account created! You can now sign in.')
      setMode('login')
      setUsername(regUser)
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Registration failed.'))
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Left — form panel ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center -mb-2">
            <img src="/images__6_-removebg-preview.png" alt="Glorious Fantasyland" className="w-24 h-24 object-contain" />
          </div>
          <div className="text-xl font-bold text-gray-900">Glorious Fantasyland</div>
          <div className="text-xs text-gray-400 mt-0.5">AmuseFlow - Online Reservation System</div>
        </div>

        {/* ✅ CHANGED — dropped the constant animate-ping ring (read as
            distracting/nagging rather than inviting). The button now relies
            on direct interaction feedback instead of an idle animation:
            it grows slightly on hover and presses down on tap. */}
        <button type="button" onClick={() => setInfoOpen(true)} aria-label="Discover AmuseFlow — roles & features"
          className="lg:hidden fixed top-4 right-4 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all">
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-sm">
          {mode === 'login' ? (            <>
              <div className="mb-6">
              <div className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                Welcome back <PartyPopper className="w-5 h-5 text-rose-500" />
              </div>
                <div className="text-xs text-gray-400">Sign in to your account to continue.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                      placeholder="e.g. john01, admin"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doLogin()} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Your username was set when your account was created.</div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">Password</label>
                    <span className="text-[10px] text-rose-600 cursor-pointer font-medium hover:underline" onClick={() => setShowForgotPassword(true)}>Forgot password?</span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doLogin()} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={doLogin} disabled={loading}
                className="w-full mt-5 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
                {loading ? <Spinner className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Sign in
              </button>

              <div className="flex items-center gap-2 my-4 text-[10px] text-gray-400">
                <div className="flex-1 h-px bg-gray-200" />
                New to Glorious Fantasyland?
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button onClick={() => setMode('register')}
                className="w-full py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <User className="w-4 h-4" /> Create a visitor account
              </button>

              <div className="text-[10px] text-gray-400 text-center mt-4">
                By signing in you agree to our{' '}
                <span className="text-rose-600 cursor-pointer hover:underline" onClick={() => setShowTerms(true)}>terms of service.</span>
              </div>

              <div className="text-[11px] text-gray-500 text-center mt-3">
                In case of problems, please call <span className="font-medium text-gray-600">0909-407-8694</span>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  Create account <UserPlus className="w-5 h-5 text-rose-500" />
                </div>
                <div className="text-xs text-gray-400">Register as a visitor to start booking rides.</div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">First name *</label>
                    <input className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      placeholder="Juan" value={firstName} onChange={e => setFirstName(capitalizeName(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last name *</label>
                    <input className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      placeholder="Dela Cruz" value={lastName} onChange={e => setLastName(capitalizeName(e.target.value))} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      placeholder="juan01" value={regUser} onChange={e => setRegUser(e.target.value)} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Letters, numbers, dots and underscores only.</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      placeholder="0912 345 6789" inputMode="numeric" maxLength={13}
                      value={regContact} onChange={e => setRegContact(formatPHMobile(e.target.value))} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">PH mobile number, e.g. 0912 345 6789.</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      type={showPw ? 'text' : 'password'} placeholder="Min. 8 chars"
                      value={regPw} onChange={e => setRegPw(e.target.value)} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
                      type={showPw2 ? 'text' : 'password'} placeholder="Re-enter password"
                      value={regPw2} onChange={e => setRegPw2(e.target.value)} />
                    <button type="button" onClick={() => setShowPw2(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password strength */}
                <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-1.5 text-[10px]">
                  {[
                    { label: '8+ characters',      ok: regPw.length >= 8 },
                    { label: '1 uppercase (A-Z)',   ok: /[A-Z]/.test(regPw) },
                    { label: '1 number (0-9)',      ok: /[0-9]/.test(regPw) },
                    { label: '1 special (@$!%*?&)', ok: /[@$!%*?&]/.test(regPw) },
                  ].map(r => (
                    <span key={r.label} className={`flex items-center gap-1 transition-colors ${r.ok ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                      {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 flex-shrink-0" />} {r.label}
                    </span>
                  ))}
                </div>
                {regPw2 && regPw !== regPw2 && <div className="text-[10px] text-red-500">⚠ Passwords do not match</div>}
                {regPw2 && regPw === regPw2 && regPw2.length > 0 && <div className="text-[10px] text-emerald-600">✅ Passwords match</div>}
              </div>

              <button onClick={doRegister} disabled={loading}
                className="w-full mt-5 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
                {loading ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} Create account
              </button>

              <div className="text-xs text-gray-500 text-center mt-4">
                Already have an account?{' '}
                <span className="text-rose-600 cursor-pointer font-semibold hover:underline"
                  onClick={() => setMode('login')}>Sign in</span>
              </div>

              <div className="text-[11px] text-gray-500 text-center mt-3">
                In case of problems, please call <span className="font-medium text-gray-600">0909-407-8694</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right — info panel (desktop, lg+) ─────────────────────────── */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-rose-400 via-rose-500 to-rose-700 p-10 flex-col justify-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10">
          <LoginInfoContent />
        </div>
      </div>

      {/* ── Mobile/tablet — same content as a slide-in drawer, opened via
          the "Discover AmuseFlow" banner above the login card. Backdrop
          fades in, panel slides in from the right — both driven by
          `infoOpen` via CSS transitions (kept mounted so the transition
          actually animates instead of popping in/out). ── */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
          infoOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setInfoOpen(false)}
      />
      <div
        role="dialog" aria-modal="true" aria-label="About AmuseFlow"
        className={`lg:hidden fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 bg-gradient-to-br from-rose-400 via-rose-500 to-rose-700 p-8 pt-16 overflow-y-auto shadow-2xl transition-transform duration-300 ease-out ${
          infoOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Decorative circles, same as the desktop panel */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full bg-white/5" />

        <button type="button" onClick={() => setInfoOpen(false)} aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10">
          <LoginInfoContent />
        </div>
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
    </div>
  )
}
