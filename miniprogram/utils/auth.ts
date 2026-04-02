import type { UserSession } from './auth-api'

const SESSION_KEY = 'xueyin_user_session'

export type { UserSession } from './auth-api'

export function getStoredSession(): UserSession | null {
  try {
    const session = wx.getStorageSync(SESSION_KEY)
    return session || null
  } catch {
    return null
  }
}

export function saveSession(session: UserSession) {
  wx.setStorageSync(SESSION_KEY, session)
}

export function clearSession() {
  wx.removeStorageSync(SESSION_KEY)
}
