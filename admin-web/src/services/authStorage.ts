const SESSION_TOKEN_KEY = 'xueyin_admin_web_session_token'

export function getStoredSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(SESSION_TOKEN_KEY) || ''
}

export function setStoredSessionToken(sessionToken: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
}

export function clearStoredSessionToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_TOKEN_KEY)
}
