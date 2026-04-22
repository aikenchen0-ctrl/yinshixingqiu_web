import { apiRequest } from './apiClient'
import { clearStoredSessionToken, getStoredSessionToken, setStoredSessionToken } from './authStorage'

export interface SessionProfile {
  id: string
  nickname: string
  mobile: string
  avatarUrl: string
  sessionToken: string
  registeredAt: number
  lastLoginAt: number
  expiresAt: number
}

interface SessionResponse {
  ok: boolean
  data: SessionProfile
}

export async function loginForWeb(account: string) {
  const response = await apiRequest<SessionResponse>('/api/auth/web-login', {
    method: 'POST',
    body: JSON.stringify({ account }),
  })

  setStoredSessionToken(response.data.sessionToken)
  return response.data
}

export async function getCurrentSession() {
  const sessionToken = getStoredSessionToken()
  if (!sessionToken) return null

  try {
    const response = await apiRequest<SessionResponse>('/api/auth/session', {
      query: {
        sessionToken,
      },
    })

    return response.data
  } catch {
    clearStoredSessionToken()
    return null
  }
}

export async function logoutCurrentSession() {
  const sessionToken = getStoredSessionToken()
  if (!sessionToken) {
    clearStoredSessionToken()
    return
  }

  try {
    await apiRequest<{ ok: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    })
  } finally {
    clearStoredSessionToken()
  }
}
