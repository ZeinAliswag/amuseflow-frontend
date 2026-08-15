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

// ✅ NEW — the backend's [Range]/[Required] DataAnnotations validation
// failures (e.g. on Ride's MinHeightCm/MaxHeightCm/etc.) come back as
// ASP.NET Core's default ValidationProblemDetails shape:
//   { title: "...", errors: { MaxHeightCm: ["Maximum height must be..."] } }
// which has no top-level `.message` — so callers checking only
// `e.response?.data?.message` silently swallow the real per-field text.
// This pulls every message out of `.errors` (all fields, not just the
// first) and joins them into one readable string; falls back to
// `.message`/`.title`/the caller-supplied default for any other shape.
export function extractApiError(e: any, fallback: string): string {
  const data = e?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors as Record<string, string[]>).flat()
    if (messages.length > 0) return messages.join(' ')
  }
  return data?.message ?? data?.title ?? fallback
}

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
  // ✅ CHANGED — group bookings: an optional guest list travels alongside
  // promoId, same shape/rules as a regular ride booking. Omit/empty
  // defaults to one guest named after the visitor (handled server-side).
  bookPromo: (payload: { promoId: number; guests?: { guestName: string; ageYears?: number; heightCm?: number; weightKg?: number }[] }) =>
    api.post('/api/booking/promo', payload),
}

// ── Reviews (OPTIONAL rating/comment on a completed + paid booking) ──
export const reviewApi = {
  create: (payload: { bookingId: number; rating: number; comment?: string }) =>
    api.post('/api/review', payload),

  getByRide: (rideId: number) =>
    api.get(`/api/review/ride/${rideId}`),
}

// ── Notifications (per-user, IsRead-tracked) ────────────────────
export const notificationApi = {
  getAll: (params: { page?: number; pageSize?: number }) =>
    api.get('/api/notification', { params }),

  getUnreadCount: () =>
    api.get('/api/notification/unread-count'),

  markAsRead: (id: number) =>
    api.put(`/api/notification/${id}/read`),

  markAllAsRead: () =>
    api.put('/api/notification/read-all'),

  // ✅ NEW — admin-wide Notifications module (Admin only): every recipient,
  // not just the caller's own.
  getAllAdmin: (params: Record<string, unknown>) =>
    api.get('/api/notification/all', { params }),

  // ✅ CHANGED — cancelledOnly lets a caller scope this to just "Booking
  // cancelled" entries, matching the admin Notifications page's own
  // cancellations-only feed (bug fix: this used to always be a true
  // system-wide count, mismatching what the page actually displayed).
  getTotalUnreadCount: (params?: { cancelledOnly?: boolean }) =>
    api.get('/api/notification/all/unread-count', { params }),

  markAllAsReadGlobal: (params?: { cancelledOnly?: boolean }) =>
    api.put('/api/notification/all/mark-all-read', null, { params }),
}

// ── Settings (admin-configurable Ride restriction bounds) ───────
// Backs the Admin "Settings" page's Ride Validations accordion section —
// replaces what used to be hardcoded [Range] limits on the Ride form.
export const settingsApi = {
  getRideValidation: () =>
    api.get('/api/ridevalidationsettings'),

  updateRideValidation: (payload: Record<string, number>) =>
    api.put('/api/ridevalidationsettings', payload),
}

// ✅ NEW — the Kid/Teen/Adult rider category presets, backing the Settings
// page's "Rider Categories" accordion section and Rides.tsx's quick-select.
export const riderCategoryApi = {
  getAll: () =>
    api.get('/api/ridercategorypresets'),

  update: (id: number, payload: Record<string, number>) =>
    api.put(`/api/ridercategorypresets/${id}`, payload),
}

// ── Reports (admin-only rating analytics) ────────────────────────
// Backs the Admin "Reports" page — monthly average-rating trend, scoped to
// every Attraction, every Attraction Bundle, everything combined, or one
// specific Attraction/Bundle, plus a per-entity breakdown table.
// ✅ CHANGED — the report period is now an explicit picked date range
// (fromDate/toDate, 'YYYY-MM-DD') instead of a trailing-months count.
// Both are optional: omit them and the backend defaults to "this month".
export const reportApi = {
  getRatingTrend: (params: { scope: 'Ride' | 'Promo' | 'All'; id?: number; fromDate?: string; toDate?: string }) =>
    api.get('/api/reports/ratings/trend', { params }),

  getRatingBreakdown: (params: { fromDate?: string; toDate?: string }) =>
    api.get('/api/reports/ratings/breakdown', { params }),
}