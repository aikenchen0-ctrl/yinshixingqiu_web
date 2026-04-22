import { fetchMallConfig } from './store-api'
import { normalizeMallUserFacingErrorMessage } from './mall-error'

const MALL_STORE_STORAGE_KEY = 'xueyin_mall_store_id_v1'
const LEGACY_MALL_GROUP_STORAGE_KEY = 'xueyin_mall_group_id_v1'

function normalizeMallStoreId(storeId?: string | null) {
  return String(storeId || '').trim()
}

function readMallStoreStorage(key: string) {
  try {
    return normalizeMallStoreId(wx.getStorageSync(key))
  } catch {
    return ''
  }
}

export function getStoredMallStoreId() {
  const currentStoreId = readMallStoreStorage(MALL_STORE_STORAGE_KEY)
  if (currentStoreId) {
    return currentStoreId
  }

  const legacyStoreId = readMallStoreStorage(LEGACY_MALL_GROUP_STORAGE_KEY)
  if (!legacyStoreId) {
    return ''
  }

  saveMallStoreId(legacyStoreId)
  return legacyStoreId
}

export function saveMallStoreId(storeId?: string | null) {
  const normalizedStoreId = normalizeMallStoreId(storeId)

  try {
    if (normalizedStoreId) {
      wx.setStorageSync(MALL_STORE_STORAGE_KEY, normalizedStoreId)
      wx.setStorageSync(LEGACY_MALL_GROUP_STORAGE_KEY, normalizedStoreId)
      return normalizedStoreId
    }

    wx.removeStorageSync(MALL_STORE_STORAGE_KEY)
    wx.removeStorageSync(LEGACY_MALL_GROUP_STORAGE_KEY)
  } catch {}

  return normalizedStoreId
}

export async function resolveMallStoreIdFromConfig() {
  const response = await fetchMallConfig()
  const storeId = saveMallStoreId(response.data.storeId)

  if (!storeId) {
    throw new Error(normalizeMallUserFacingErrorMessage(new Error('商城没有明确数据源'), '商城数据源未确定'))
  }

  return storeId
}
