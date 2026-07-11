// ── Auth ──────────────────────────────────────────────────────
export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  firstName: string
  lastName: string
  username: string
  contactNumber: string
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  token: string
  role: string        // ← non-optional, matches your API
  fullName: string
  userId: number
  expiresAt: string
}
export interface MeResponse {
  id: number
  firstName: string
  lastName: string
  fullName: string
  username: string
  initials: string
  role: string
  contactNumber: string
  isActive: boolean
  createdAt: string
}

// ── Generic API wrappers ───────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PagedResponse<T> {
  success: boolean
  message: string
  data: T[]
  pagination: PaginationMeta
}

export interface PaginationMeta {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginationRequest {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDirection?: 'ASC' | 'DESC'
}

// ── Ride ──────────────────────────────────────────────────────
export interface Ride {
  id: number
  name: string
  description?: string
  maxCapacity: number
  durationMinutes: number
  price: number
  imagePath?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

// ── Schedule ──────────────────────────────────────────────────
export interface Schedule {
  id: number
  rideId: number
  rideName?: string
  rideImagePath?: string
  attendantId?: number
  attendantName?: string
  scheduleDate: string
  callTime?: string        // ✅ NEW — must be earlier than startTime
  startTime: string
  endTime: string
  maxSlots: number
  availableSlots: number
  status: string
}

// ── Booking ───────────────────────────────────────────────────
export interface Booking {
  id: number
  visitorId: number
  visitorName?: string
  visitorUsername?: string
  visitorContactNumber?: string
  scheduleId: number
  rideName?: string
  ridePrice?: number
  rideImagePath?: string   // ✅ NEW
  scheduleDate?: string
  callTime?: string        // ✅ NEW — from the booking's schedule
  startTime?: string
  endTime?: string
  bookingCode: string
  status: string
  paymentStatus: string
  paymentAmount: number
  paidAt?: string
  bookedAt: string
  notes?: string
}

// ── User ──────────────────────────────────────────────────────
export interface User {
  id: number
  firstName: string
  lastName: string
  fullName: string
  username: string
  role: string
  contactNumber: string
  isActive: boolean
  createdAt: string
}

export interface UserResponse extends MeResponse {}

// ── Activity Log ──────────────────────────────────────────────
export interface ActivityLog {
  id: number
  userId?: number
  userName?: string
  module: string
  action: string
  details?: string
  createdAt: string
  // ✅ NEW — role of the user who performed the action (Admin / Ride
  // Attendant / Visitor). Populated automatically by the backend on every
  // log entry; used by the admin Logs page's role filter/badges and by
  // the Visitor/Ride Attendant portal's "Activity logs" panel.
  role?: string
}

// ── Dashboard ─────────────────────────────────────────────────
export interface AdminDashboard {
  totalRides: number
  totalBookings: number
  pendingBookings: number
  approvedBookings: number
  rejectedBookings: number
  completedBookings: number
  cancelledBookings: number
  totalVisitors: number
  todaySchedules: number
  recentPendingBookings: Booking[]
}
