import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff, Sparkles, Shield, Ticket, CreditCard, Phone, PartyPopper, UserPlus, CheckCircle2, Circle } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/shared'
import toast from 'react-hot-toast'

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

export default function Login() {
  const [mode, setMode]       = useState<'login'|'register'>('login')
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    setError('')
    if (!username || !password) { setError('Username and password are required.'); return }
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
      setError(e.response?.data?.message ?? 'Invalid username or password.')
    } finally { setLoading(false) }
  }

  const doRegister = async () => {
    setError('')
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
      setError(e.response?.data?.message ?? 'Registration failed.')
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

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-sm">
          {mode === 'login' ? (            <>
              <div className="mb-6">
              <div className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                Welcome back <PartyPopper className="w-5 h-5 text-rose-500" />
              </div>
                <div className="text-xs text-gray-400">Sign in to your account to continue.</div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                  ⚠ {error}
                </div>
              )}

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
                    <span className="text-[10px] text-rose-600 cursor-pointer font-medium hover:underline">Forgot password?</span>
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

              <button onClick={() => { setMode('register'); setError('') }}
                className="w-full py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <User className="w-4 h-4" /> Create a visitor account
              </button>

              <div className="text-[10px] text-gray-400 text-center mt-4">
                By signing in you agree to our{' '}
                <span className="text-rose-600 cursor-pointer hover:underline">terms of service.</span>
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

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                  ⚠ {error}
                </div>
              )}

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
                  onClick={() => { setMode('login'); setError('') }}>Sign in</span>
              </div>

              <div className="text-[11px] text-gray-500 text-center mt-3">
                In case of problems, please call <span className="font-medium text-gray-600">0909-407-8694</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right — info panel ─────────────────────────────── */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-rose-400 via-rose-500 to-rose-700 p-10 flex-col justify-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10">
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
            {[
              { icon: <Ticket className="w-4 h-4 text-rose-300" />, title: 'Book ride slots', sub: 'Reserve spots in advance. Skip the queue.' },
              { icon: <Shield className="w-4 h-4 text-blue-300" />,    title: 'Role-based access', sub: 'One login serves all three roles automatically.' },
              { icon: <CreditCard className="w-4 h-4 text-amber-300" />, title: 'Pay at the ride', sub: 'Attendant collects payment on-site before boarding.' },
            ].map(item => (
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
            {[
              { dot: 'bg-emerald-400', name: 'Visitor',        desc: 'Browse rides, book slots, cancel reservations.' },
              { dot: 'bg-blue-400',    name: 'Admin',           desc: 'Manage rides, schedules, bookings, users and logs.' },
              { dot: 'bg-amber-400',   name: 'Ride Attendant', desc: 'Verify codes, collect payment, complete rides.' },
            ].map(r => (
              <div key={r.name} className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.dot}`} />
                <div>
                  <div className="text-xs font-semibold text-white">{r.name}</div>
                  <div className="text-[10px] text-white/55">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
