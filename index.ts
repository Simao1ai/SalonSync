// SalonSync — Shared TypeScript Types

export type Role = 'ADMIN' | 'STAFF' | 'CLIENT'
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type PaymentStatus = 'UNPAID' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type ServiceCategory = 'STANDARD' | 'HIGH_VALUE'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: Role
  avatarUrl?: string
  locationId?: string
  stripeCustomerId?: string
  specialties?: string[]
  bio?: string
}

export interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone?: string
  cancellationWindowHours: number
  standardCancelFeePercent: number
  highValueCancelFeePercent: number
}

export interface Service {
  id: string
  name: string
  description?: string
  category: ServiceCategory
  basePrice: number
  durationMinutes: number
  depositPercent: number
  requiresFullPrepay: boolean
  locationId: string
}

export interface Appointment {
  id: string
  startTime: Date
  endTime: Date
  status: AppointmentStatus
  isHighValue: boolean
  riskScore: RiskLevel
  riskFactors: string[]
  totalPrice: number
  depositAmount: number
  paymentStatus: PaymentStatus
  staffId: string
  clientId: string
  locationId: string
  staff?: User
  client?: User
  services?: Service[]
}

export interface Review {
  id: string
  rating: number
  comment?: string
  sentimentScore?: number
  sentimentTags?: string[]
  isPublished: boolean
  clientId: string
  staffId: string
  appointmentId: string
}

export interface Analytics {
  date: Date
  totalRevenue: number
  totalAppointments: number
  cancelledCount: number
  noShowCount: number
  newClients: number
  returningClients: number
  cancelFeeRevenue: number
  avgAppointmentValue: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RiskAssessment {
  riskLevel: RiskLevel
  riskScore: number
  factors: string[]
  recommendation: string
}

export interface ProductRecommendation {
  productId: string
  reason: string
}
