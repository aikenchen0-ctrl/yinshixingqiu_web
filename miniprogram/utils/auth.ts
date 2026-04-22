import type { UserSession } from './auth-api'

const SESSION_KEY = 'xueyin_user_session'
const LOGIN_REDIRECT_KEY = 'xueyin_login_redirect'
const INVALID_SESSION_MESSAGES = ['缺少登录态', '登录态无效', '登录态已过期']

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

export function savePendingLoginRedirect(redirectUrl: string) {
  try {
    const normalizedRedirectUrl = String(redirectUrl || '').trim()
    if (!normalizedRedirectUrl || normalizedRedirectUrl.indexOf('/pages/') !== 0) {
      return
    }

    wx.setStorageSync(LOGIN_REDIRECT_KEY, normalizedRedirectUrl)
  } catch {}
}

export function getPendingLoginRedirect() {
  try {
    const redirectUrl = wx.getStorageSync(LOGIN_REDIRECT_KEY)
    const normalizedRedirectUrl = String(redirectUrl || '').trim()
    return normalizedRedirectUrl && normalizedRedirectUrl.indexOf('/pages/') === 0 ? normalizedRedirectUrl : ''
  } catch {
    return ''
  }
}

export function clearPendingLoginRedirect() {
  try {
    wx.removeStorageSync(LOGIN_REDIRECT_KEY)
  } catch {}
}

export function shouldClearSessionByError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return INVALID_SESSION_MESSAGES.some((message) => error.message.indexOf(message) >= 0)
}
