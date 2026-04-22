function getEnvValue(key: keyof ImportMetaEnv, fallback = '') {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function parseBoolean(value: string, fallback = false) {
  if (!value) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

function isLocalHostname(hostname: string) {
  const normalizedHostname = String(hostname || '').trim().toLowerCase()
  if (!normalizedHostname) {
    return false
  }

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === '::1' ||
    normalizedHostname === '[::1]'
  ) {
    return true
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalizedHostname)) {
    return true
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalizedHostname)) {
    return true
  }

  const matched = normalizedHostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (!matched) {
    return false
  }

  const secondOctet = Number(matched[1])
  return secondOctet >= 16 && secondOctet <= 31
}

function resolveApiBaseUrl() {
  const configuredApiBaseUrl = getEnvValue('VITE_API_BASE_URL')
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl
  }

  if (typeof window !== 'undefined' && window.location && !isLocalHostname(window.location.hostname)) {
    return window.location.origin
  }

  return 'http://127.0.0.1:3000'
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  requireAuth: parseBoolean(getEnvValue('VITE_ADMIN_REQUIRE_AUTH'), false),
  adminToken: getEnvValue('VITE_ADMIN_TOKEN'),
}
