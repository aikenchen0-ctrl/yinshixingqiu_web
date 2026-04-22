import { request } from './request'

export interface UserSession {
  id: string
  nickname: string
  mobile: string
  avatarUrl: string
  sessionToken: string
  registeredAt: number
  lastLoginAt: number
  expiresAt: number
}

interface LoginResponse {
  ok: boolean
  data: UserSession
}

interface SessionResponse {
  ok: boolean
  data: UserSession
}

interface UpdateSessionProfileResponse {
  ok: boolean
  data: UserSession
}

interface LogoutResponse {
  ok: boolean
  message: string
}

interface HealthResponse {
  ok: boolean
  service: string
  time: string
}

export function loginByWechat(payload: {
  loginCode: string
  nickname?: string
  mobile?: string
  avatarUrl?: string
}) {
  return request<LoginResponse>({
    url: '/api/auth/login',
    method: 'POST',
    data: payload,
  })
}

export function loginByPhoneNumber(payload: {
  loginCode: string
  phoneCode: string
  requestId: string
}) {
  return request<LoginResponse>({
    url: '/api/auth/phone-login',
    method: 'POST',
    data: payload,
  })
}

export function fetchSessionProfile(sessionToken: string) {
  return request<SessionResponse>({
    url: '/api/auth/session',
    sessionToken,
  })
}

export function updateSessionProfile(payload: {
  sessionToken: string
  nickname?: string
  avatarUrl?: string
}) {
  return request<UpdateSessionProfileResponse>({
    url: '/api/auth/profile',
    method: 'PUT',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function logoutSession(sessionToken: string) {
  return request<LogoutResponse>({
    url: '/api/auth/logout',
    method: 'POST',
    data: {
      sessionToken,
    },
  })
}

export function pingBackend(baseUrl?: string) {
  return request<HealthResponse>({
    url: '/health',
    baseUrl,
  })
}
