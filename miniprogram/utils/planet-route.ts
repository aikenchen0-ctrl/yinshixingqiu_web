const LAST_ACTIVE_PLANET_ID_KEY = 'planet_last_active_id_v1'
const legacyPlanetIdMap: Record<string, string> = {
  planet_1: 'grp_datawhale_001',
  planet_2: 'grp_multi_admin_001',
  planet_3: 'grp_review_001',
  planet_4: 'grp_empty_001',
}

export const PLANET_INDEX_PAGE = '/pages/planet/index'

function safeGetStorage<T>(key: string, fallbackValue: T): T {
  try {
    const value = wx.getStorageSync(key)
    return value ? (value as T) : fallbackValue
  } catch {
    return fallbackValue
  }
}

function safeSetStorage(key: string, value: unknown) {
  try {
    wx.setStorageSync(key, value)
  } catch {}
}

export function normalizePlanetId(planetId?: string | null) {
  const normalizedPlanetId = String(planetId || '').trim()
  if (!normalizedPlanetId) {
    return ''
  }

  return legacyPlanetIdMap[normalizedPlanetId] || normalizedPlanetId
}

function parseSceneValue(scene?: string | null) {
  const normalizedScene = String(scene || '').trim()
  if (!normalizedScene) {
    return ''
  }

  let decodedScene = normalizedScene

  try {
    decodedScene = decodeURIComponent(normalizedScene)
  } catch {}

  const queryEntries = decodedScene.split('&')
  const sceneRecord = queryEntries.reduce<Record<string, string>>((result, entry) => {
    const [rawKey, ...restValue] = entry.split('=')
    const key = String(rawKey || '').trim()
    if (!key) {
      return result
    }

    result[key] = restValue.join('=').trim()
    return result
  }, {})

  return normalizePlanetId(sceneRecord.g || sceneRecord.groupId || sceneRecord.id || '')
}

export function getLastActivePlanetId() {
  return normalizePlanetId(safeGetStorage<string>(LAST_ACTIVE_PLANET_ID_KEY, ''))
}

export function rememberActivePlanetId(planetId?: string | null) {
  const normalizedPlanetId = normalizePlanetId(planetId)
  if (!normalizedPlanetId) {
    return ''
  }

  safeSetStorage(LAST_ACTIVE_PLANET_ID_KEY, normalizedPlanetId)
  return normalizedPlanetId
}

export function resolvePlanetIdFromOptions(
  options?: Record<string, string | undefined>,
  keys: string[] = ['id', 'planetId', 'groupId'],
  useLastActive = true,
) {
  if (options) {
    const scenePlanetId = parseSceneValue(options.scene)
    if (scenePlanetId) {
      return rememberActivePlanetId(scenePlanetId)
    }

    for (let index = 0; index < keys.length; index += 1) {
      const normalizedPlanetId = normalizePlanetId(options[keys[index]])
      if (normalizedPlanetId) {
        return rememberActivePlanetId(normalizedPlanetId)
      }
    }
  }

  if (!useLastActive) {
    return ''
  }

  return getLastActivePlanetId()
}

export function navigateToPlanetIndex(message?: string) {
  if (message) {
    wx.showToast({
      title: message,
      icon: 'none',
    })
  }

  wx.navigateTo({
    url: PLANET_INDEX_PAGE,
  })
}
