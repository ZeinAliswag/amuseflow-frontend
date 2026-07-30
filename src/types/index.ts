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
  // ✅ NEW — optional restrictions enforced per guest at booking time.
  // Height can now be a range (e.g. 100–180) instead of just a floor.
  minHeightCm?: number
  maxHeightCm?: number
  minAgeYears?: number
  // ✅ NEW — age can now be a range (e.g. 24–50) instead of just a floor.
  maxAgeYears?: number
  // ✅ NEW — optional weight range restriction, same min/max pattern as age.
  minWeightKg?: number
  maxWeightKg?: number
  isDeleted: boolean
  // ✅ NEW — true while this ride has at least one Open or Full schedule
  // (upcoming, still-open-today, or currently in progress). Backend also
  // enforces this on delete (RideService.DeleteAsync) — this just lets the
  // UI disable the button proactively instead of surfacing a toast error.
  hasActiveSchedule: boolean
  // ✅ NEW — aggregated from every OPTIONAL review left on a completed +
  // paid booking for this ride. 0/0 when the ride has no reviews yet.
  averageRating: number
  reviewCount: number
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
  scheduleType: string  // ✅ NEW — 'Regular' | 'Promo', fully separate pools
}

// ── Ride Promo ────────────────────────────────────────────────
// A bundle of 2+ rides sold together with its own price/photo/date window.
// ✅ CHANGED — each included ride now has a schedule LOCKED IN by the admin
// at promo-creation time (no more visitor schedule choice at booking time).
export interface PromoRideItem {
  rideId: number
  rideName: string
  rideDescription?: string
  rideImagePath?: string
  ridePrice: number
  scheduleId: number
  scheduleDate: string
  callTime?: string
  startTime: string
  endTime: string
  availableSlots: number
  maxSlots: number
  scheduleStatus: string

  // ✅ NEW — this ride's own optional restrictions, carried along so a
  // promo booking can be validated against EVERY ride bundled in it (a
  // guest must qualify for all of them, not just one). Same fields as Ride.
  minHeightCm?: number
  maxHeightCm?: number
  minAgeYears?: number
  maxAgeYears?: number
  minWeightKg?: number
  maxWeightKg?: number
}

export interface RidePromo {
  id: number
  name: string
  description?: string
  price: number
  imagePath?: string
  // ✅ CHANGED — single-day promos only. Every ride bundled into this promo
  // must have its locked schedule on this exact date.
  promoDate: string
  // ✅ NEW — "Active" while promoDate hasn't passed yet, "Completed" the
  // day after. Flips automatically on the backend.
  status: 'Active' | 'Completed'
  isDeleted: boolean
  // ✅ NEW — aggregated from every OPTIONAL review left on a completed +
  // paid promo booking (one review per promo booking, not per included
  // ride). 0/0 when the promo has no reviews yet.
  averageRating: number
  reviewCount: number
  createdAt: string
  updatedAt: string
  rides: PromoRideItem[]
}

// One included ride within a promo BOOKING — each keeps its own chosen
// schedule even though the whole thing is a single booking.
export interface BookingPromoItem {
  rideId: number
  rideName: string
  rideDescription?: string
  rideImagePath?: string
  scheduleId: number
  scheduleDate: string
  callTime?: string
  startTime: string
  endTime: string
}

// One guest/seat included in a booking (group bookings) — a plain
// single-seat booking still has exactly one of these, defaulting to the
// visitor's own name.
export interface BookingGuest {
  id: number
  guestName: string
  ageYears?: number
  heightCm?: number
  // ✅ NEW — validated against the ride's optional Min/MaxWeightKg range.
  weightKg?: number
}

// A visitor's OPTIONAL rating/comment left on a completed + paid booking.
// ✅ CHANGED — rideId is now optional: null for a Ride Promo booking's
// review (one review for the whole bundle, no single ride to attach it to).
export interface Review {
  id: number
  bookingId: number
  rideId?: number
  rideName?: string
  visitorId: number
  visitorName?: string
  visitorUsername?: string
  rating: number
  comment?: string
  createdAt: string
}

// ── Booking ───────────────────────────────────────────────────
export interface Booking {
  id: number
  visitorId: number
  visitorName?: string
  visitorUsername?: string
  visitorContactNumber?: string
  scheduleId?: number       // ✅ CHANGED — optional: absent/null for promo bookings
  // ✅ NEW — the ride this booking is for (regular bookings only, null for
  // promo bookings) — backs the optional review feature.
  rideId?: number
  rideName?: string
  rideDescription?: string  // ✅ NEW
  ridePrice?: number
  rideImagePath?: string   // ✅ NEW
  scheduleDate?: string
  callTime?: string        // ✅ NEW — from the booking's schedule
  startTime?: string
  endTime?: string

  // ✅ NEW — populated only when this booking is for a Ride Promo
  promoId?: number
  promoName?: string
  promoImagePath?: string
  includedRides?: BookingPromoItem[]

  // ✅ NEW — group bookings: one entry per guest/seat under this booking.
  guests?: BookingGuest[]

  // ✅ NEW — null until the visitor optionally leaves a rating/comment on
  // this booking (only possible once it's Completed + Paid, and only for
  // regular, non-promo bookings).
  review?: Review

  bookingCode: string
  status: string
  paymentStatus: string
  paymentAmount: number
  paidAt?: string
  bookedAt: string
  notes?: string

  // ✅ NEW — false until the admin views/clicks this booking (or its latest
  // status/payment change) in the Admin Bookings list.
  isRead: boolean
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

// ── Notification (per-user, IsRead-tracked) ────────────────────
// Created directly by the backend services (Booking/Schedule) — distinct
// from ActivityLog: scoped to one recipient, and tracked read/unread
// instead of being a shared audit trail everyone can see.
export interface Notification {
  id: number
  module: string        // Booking | Schedule
  title: string
  message: string
  relatedId?: number     // BookingId or ScheduleId
  isRead: boolean
  createdAt: string

  // ✅ NEW — populated only on the admin-wide list (GET /api/notification/all).
  recipientName?: string
  recipientUsername?: string
  recipientRole?: string
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
