import { env } from '../env'

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
  headers.set('Accept', 'application/json')

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (env.adminToken) {
    headers.set('Authorization', `Bearer ${env.adminToken}`)
  }

  return headers
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

    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}
