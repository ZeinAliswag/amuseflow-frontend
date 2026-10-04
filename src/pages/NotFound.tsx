import { Compass, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ✅ NEW — dedicated 404 page. Any unmatched route used to silently redirect
// to /login (even for a logged-in user who just mistyped a URL or followed a
// stale link), which looked like the app had logged them out. Now shows a
// real "not found" screen with a role-aware "go home" link back to whichever
// portal the current user actually belongs to (or /login if signed out).
export default function NotFoundPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const homePath =
    user?.role === 'Admin' ? '/admin' :
    user?.role === 'Ride Attendant' ? '/attendant' :
    user?.role === 'Visitor' ? '/visitor' :
    '/login'

  const homeLabel =
    user?.role === 'Admin' ? 'Go to Admin dashboard' :
    user?.role === 'Ride Attendant' ? 'Go to Attendant dashboard' :
    user?.role === 'Visitor' ? 'Go to my dashboard' :
    'Go to login'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-6">
          <Compass className="w-10 h-10" />
        </div>
        <div className="text-6xl font-black text-gray-900 mb-2 tracking-tight">404</div>
        <h1 className="text-lg font-bold text-gray-900 mb-1.5">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <button onClick={() => navigate(homePath, { replace: true })}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            {homeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
