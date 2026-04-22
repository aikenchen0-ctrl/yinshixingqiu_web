import { addMallCartItem } from './store-api'

const GUEST_CART_STORAGE_KEY = 'xueyin_guest_mall_cart'
const LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY = 'xueyin_guest_mall_cart_initialized'
const LEGACY_DEMO_GUEST_CART: Record<string, number> = {
  mall_prod_mask_001: 1,
  mall_prod_coffee_001: 1,
}

let guestCartSyncPromise: Promise<boolean> | null = null
let guestCartSyncToken = ''

export function loadGuestMallCartQuantities() {
  try {
    const storedValue = wx.getStorageSync(GUEST_CART_STORAGE_KEY)
    const quantities = storedValue && typeof storedValue === 'object' ? (storedValue as Record<string, number>) : {}
    const quantityKeys = Object.keys(quantities)
    const legacyKeys = Object.keys(LEGACY_DEMO_GUEST_CART)
    const hasLegacyInitializedFlag = wx.getStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY) === true
    const matchesLegacyDemoCart =
      hasLegacyInitializedFlag &&
      quantityKeys.length === legacyKeys.length &&
      legacyKeys.every((key) => Number(quantities[key] || 0) === LEGACY_DEMO_GUEST_CART[key])

    if (matchesLegacyDemoCart) {
      wx.removeStorageSync(GUEST_CART_STORAGE_KEY)
      wx.removeStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY)
      return {}
    }

    if (!quantityKeys.length) {
      wx.removeStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY)
    }

    return quantities
  } catch {
    return {}
  }
}

export function saveGuestMallCartQuantities(quantities: Record<string, number>) {
  try {
    const normalizedQuantities = Object.keys(quantities).reduce<Record<string, number>>((result, key) => {
      const quantity = Number(quantities[key] || 0)
      if (key && quantity > 0) {
        result[key] = quantity
      }
      return result
    }, {})

    if (Object.keys(normalizedQuantities).length) {
      wx.setStorageSync(GUEST_CART_STORAGE_KEY, normalizedQuantities)
      wx.removeStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY)
      return
    }

    wx.removeStorageSync(GUEST_CART_STORAGE_KEY)
    wx.removeStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY)
  } catch {}
}

export function clearGuestMallCartQuantities() {
  try {
    wx.removeStorageSync(GUEST_CART_STORAGE_KEY)
    wx.removeStorageSync(LEGACY_GUEST_CART_INITIALIZED_STORAGE_KEY)
  } catch {}
}

export function countGuestMallCartItems(quantities: Record<string, number>) {
  return Object.keys(quantities).reduce((sum, key) => sum + Number(quantities[key] || 0), 0)
}

async function syncGuestMallCartToSessionInternal(sessionToken: string) {
  const quantities = loadGuestMallCartQuantities()
  const entries = Object.keys(quantities)
    .map((productId) => ({
      productId,
      quantity: Number(quantities[productId] || 0),
    }))
    .filter((item) => item.productId && item.quantity > 0)

  if (!entries.length) {
    clearGuestMallCartQuantities()
    return false
  }

  let synced = false

  for (const item of entries) {
    await addMallCartItem({
      sessionToken,
      productId: item.productId,
      quantity: item.quantity,
    })

    delete quantities[item.productId]
    saveGuestMallCartQuantities(quantities)
    synced = true
  }

  clearGuestMallCartQuantities()
  return synced
}

export function syncGuestMallCartToSession(sessionToken: string) {
  const normalizedSessionToken = String(sessionToken || '').trim()
  if (!normalizedSessionToken) {
    return Promise.resolve(false)
  }

  if (guestCartSyncPromise && guestCartSyncToken === normalizedSessionToken) {
    return guestCartSyncPromise
  }

  guestCartSyncToken = normalizedSessionToken
  guestCartSyncPromise = syncGuestMallCartToSessionInternal(normalizedSessionToken).finally(() => {
    guestCartSyncPromise = null
    guestCartSyncToken = ''
  })

  return guestCartSyncPromise
}
