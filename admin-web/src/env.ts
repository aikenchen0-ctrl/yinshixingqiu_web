function getEnvValue(key: keyof ImportMetaEnv, fallback = '') {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function parseBoolean(value: string, fallback = false) {
  if (!value) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

export const env = {
  apiBaseUrl: getEnvValue('VITE_API_BASE_URL', 'http://127.0.0.1:3000'),
  requireAuth: parseBoolean(getEnvValue('VITE_ADMIN_REQUIRE_AUTH'), false),
  adminToken: getEnvValue('VITE_ADMIN_TOKEN'),
}
