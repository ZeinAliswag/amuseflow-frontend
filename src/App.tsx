import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Spinner } from './components/shared'
import Login from './pages/Login'
import AdminLayout from './components/layout/AdminLayout'
import { VisitorLayout, AttendantLayout } from './components/layout/PortalLayouts'
import AdminDashboardPage from './pages/admin/Dashboard'
import AdminRidesPage from './pages/admin/Rides'
import AdminPromosPage from './pages/admin/Promos'
import AdminSchedulesPage from './pages/admin/Schedules'
import AdminBookingsPage from './pages/admin/Bookings'
import AdminUsersPage from './pages/admin/Users'
import AdminLogsPage from './pages/admin/Logs'
import { VisitorDashboard } from './pages/visitor/VisitorDashboard'
import { AttendantDashboard } from './pages/attendant/AttendantDashboard'

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner className="w-10 h-10" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner className="w-10 h-10" />
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={
        user ? (
          user.role === 'Admin' ? <Navigate to="/admin" replace /> :
          user.role === 'Ride Attendant' ? <Navigate to="/attendant" replace /> :
          <Navigate to="/visitor" replace />
        ) : <Login />
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminDashboardPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/rides" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminRidesPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/promos" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminPromosPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/schedules" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminSchedulesPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/bookings" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminBookingsPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminUsersPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/logs" element={
        <ProtectedRoute roles={['Admin']}>
          <AdminLayout><AdminLogsPage /></AdminLayout>
        </ProtectedRoute>
      } />

      {/* Visitor routes */}
      <Route path="/visitor" element={
        <ProtectedRoute roles={['Visitor']}>
          <VisitorLayout><VisitorDashboard /></VisitorLayout>
        </ProtectedRoute>
      } />

      {/* Attendant routes */}
      <Route path="/attendant" element={
        <ProtectedRoute roles={['Ride Attendant']}>
          <AttendantLayout><AttendantDashboard /></AttendantLayout>
        </ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '14px',
              padding: '12px 16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
