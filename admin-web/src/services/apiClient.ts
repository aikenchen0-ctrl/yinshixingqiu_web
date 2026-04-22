import { env } from '../env'
import { clearStoredSessionToken, getStoredSessionToken } from './authStorage'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

type QueryValue = string | number | boolean | null | undefined

function buildUrl(pathname: string, query?: Record<string, QueryValue>) {
  const url = new URL(pathname, env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : `${env.apiBaseUrl}/`)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return
      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

function buildHeaders(initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (env.adminToken) {
    headers.set('Authorization', `Bearer ${env.adminToken}`)
  }

  const sessionToken = getStoredSessionToken()
  if (sessionToken) {
    headers.set('x-session-token', sessionToken)
  }

  return headers
}

function resolveFileName(contentDisposition: string | null, fallback = 'download.csv') {
  if (!contentDisposition) {
    return fallback
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return asciiMatch?.[1] || fallback
}

function handleAdminUnauthorized(pathname: string, status: number) {
  if (status !== 401 || typeof window === 'undefined') {
    return
  }

  if (!pathname.startsWith('/api/admin/')) {
    return
  }

  clearStoredSessionToken()

  if (window.location.pathname === '/login') {
    return
  }

  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const loginUrl = new URL('/login', window.location.origin)
  if (redirect && redirect !== '/login') {
    loginUrl.searchParams.set('redirect', redirect)
  }

  window.location.assign(`${loginUrl.pathname}${loginUrl.search}`)
}

export async function apiRequest<T>(
  pathname: string,
  init?: RequestInit & { query?: Record<string, QueryValue> },
) {
  const response = await fetch(buildUrl(pathname, init?.query), {
    ...init,
    headers: buildHeaders(init?.headers),
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`

    handleAdminUnauthorized(pathname, response.status)

    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}

export async function downloadApiFile(
  pathname: string,
  init?: RequestInit & { query?: Record<string, QueryValue>; fallbackFileName?: string },
) {
  const response = await fetch(buildUrl(pathname, init?.query), {
    ...init,
    headers: buildHeaders(init?.headers),
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`

    handleAdminUnauthorized(pathname, response.status)

    throw new ApiError(message, response.status, payload)
  }

  return {
    blob: await response.blob(),
    fileName: resolveFileName(response.headers.get('content-disposition'), init?.fallbackFileName),
  }
}
