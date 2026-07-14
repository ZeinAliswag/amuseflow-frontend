import axios from 'axios'

// ✅ FIXED — was hardcoded to 'https://localhost:7263', which only exists on
// your own machine. Now reads from Vite's env system: set VITE_API_BASE_URL
// in a .env.local file for local dev, and in Vercel's Project Settings →
// Environment Variables for production. Throwing loudly if it's missing is
// intentional — a silent fallback to localhost would "work" locally and then
// fail mysteriously in production, which is worse than failing at build/start.
const BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!BASE_URL) {
  throw new Error(
    'VITE_API_BASE_URL is not set. Add it to .env.local for local dev, or to Vercel → Project Settings → Environment Variables for production.'
  )
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 — clear token and redirect to login
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

export const userApi = {
  getAll: (params: { page?: number; pageSize?: number; search?: string; role?: string; isActive?: boolean }) =>
    api.get('/api/user', { params }),

  createStaff: (payload: Record<string, unknown>) =>
    api.post('/api/user/create-staff', payload),

  changeRole: (payload: { userId: number; role: string }) =>
    api.put(`/api/user/${payload.userId}/role`, {
      userId: payload.userId,
      role: payload.role
    }),

  changePassword: (payload: { userId: number; newPassword: string; confirmPassword: string }) =>
    api.put(`/api/user/${payload.userId}/password`, payload),

  activate: (id: number) =>
    api.put(`/api/user/${id}/active`, null, { params: { isActive: true } }),

  deactivate: (id: number) =>
    api.put(`/api/user/${id}/active`, null, { params: { isActive: false } }),
}
// ── Multipart helper (for ride image upload) ──────────────────
export const apiForm = axios.create({ baseURL: BASE_URL })
apiForm.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Ride Promos (bundle of 2+ rides, own price/photo/date window) ──
export const promoApi = {
  getAll: (params: { page?: number; pageSize?: number; search?: string; includeDeleted?: boolean }) =>
    api.get('/api/ridepromo', { params }),

  getById: (id: number) =>
    api.get(`/api/ridepromo/${id}`),

  // fd must include: name, description, price, startDate, endDate,
  // rideIds (appended once per selected ride id), file
  create: (fd: FormData) =>
    apiForm.post('/api/ridepromo', fd),

  update: (id: number, fd: FormData) =>
    apiForm.put(`/api/ridepromo/${id}`, fd),

  delete: (id: number) =>
    api.delete(`/api/ridepromo/${id}`),

  restore: (id: number) =>
    api.put(`/api/ridepromo/${id}/restore`),
}

// ── Promo booking (visitor books a promo as a SINGLE booking) ──
// ✅ CHANGED — schedules are now locked in by the admin at promo-creation
// time, so booking a promo only needs the promoId.
export const bookingApi = {
  bookPromo: (payload: { promoId: number }) =>
    api.post('/api/booking/promo', payload),
}