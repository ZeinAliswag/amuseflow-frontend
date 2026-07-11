import axios from 'axios'

const BASE_URL = 'https://localhost:7263'

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