import { type MallShippingAddressApiItem } from './store-api'

export interface MallShippingAddressView {
  id: string
  recipientName: string
  phone: string
  fullAddress: string
  isDefault: boolean
}

export interface MallAddressFormValue {
  recipientName: string
  phone: string
  region: string[]
  detailAddress: string
}

export interface MallAddressFormState extends MallAddressFormValue {
  hasAddress: boolean
  regionText: string
  hasRegion: boolean
}

const DEFAULT_MALL_ADDRESS_REDIRECT_URL = '/pages/store/index'
const MALL_CHECKOUT_SELECTED_ADDRESS_ID_KEY = 'xueyin_mall_checkout_selected_address_id'

export function saveMallCheckoutSelectedAddressId(addressId?: string) {
  const normalizedAddressId = String(addressId || '')

  try {
    if (normalizedAddressId) {
      wx.setStorageSync(MALL_CHECKOUT_SELECTED_ADDRESS_ID_KEY, normalizedAddressId)
      return
    }

    wx.removeStorageSync(MALL_CHECKOUT_SELECTED_ADDRESS_ID_KEY)
  } catch {}
}

export function peekMallCheckoutSelectedAddressId() {
  try {
    return String(wx.getStorageSync(MALL_CHECKOUT_SELECTED_ADDRESS_ID_KEY) || '')
  } catch {
    return ''
  }
}

export function consumeMallCheckoutSelectedAddressId() {
  const addressId = peekMallCheckoutSelectedAddressId()

  if (addressId) {
    try {
      wx.removeStorageSync(MALL_CHECKOUT_SELECTED_ADDRESS_ID_KEY)
    } catch {}
  }

  return addressId
}

export function normalizeMallAddressRedirectUrl(rawRedirectUrl?: string, fallbackRedirectUrl = DEFAULT_MALL_ADDRESS_REDIRECT_URL) {
  const redirectUrl = rawRedirectUrl ? decodeURIComponent(rawRedirectUrl) : fallbackRedirectUrl
  return redirectUrl && redirectUrl.indexOf('/pages/') === 0 ? redirectUrl : fallbackRedirectUrl
}

export function normalizeMallAddressAutoBack(rawValue?: string | boolean) {
  if (typeof rawValue === 'boolean') {
    return rawValue
  }

  const normalizedValue = String(rawValue || '').trim().toLowerCase()
  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes'
}

export function buildMallAddressManagerUrl(input?: {
  redirectUrl?: string
  autoBack?: boolean
  fallbackRedirectUrl?: string
}) {
  const redirectUrl = normalizeMallAddressRedirectUrl(
    input && input.redirectUrl ? input.redirectUrl : '',
    input && input.fallbackRedirectUrl ? input.fallbackRedirectUrl : DEFAULT_MALL_ADDRESS_REDIRECT_URL,
  )
  const autoBack = Boolean(input && input.autoBack)
  return `/pages/store/address?redirect=${encodeURIComponent(redirectUrl)}${autoBack ? '&autoback=1' : ''}`
}

export function buildMallAddressRegionValue(address?: MallShippingAddressApiItem | null) {
  if (!address) {
    return [] as string[]
  }

  return [String(address.province || ''), String(address.city || ''), String(address.district || '')].filter(Boolean)
}

export function buildMallAddressRegionText(region: string[]) {
  return region.filter(Boolean).join(' ')
}

export function buildMallShippingAddressView(address?: MallShippingAddressApiItem | null): MallShippingAddressView | null {
  if (!address) {
    return null
  }

  return {
    id: String(address.id || ''),
    recipientName: String(address.recipientName || ''),
    phone: String(address.phone || ''),
    fullAddress: String(address.fullAddress || '').trim(),
    isDefault: Boolean(address.isDefault),
  }
}

export function buildMallShippingAddressViews(addresses?: MallShippingAddressApiItem[] | null) {
  return Array.isArray(addresses) ? addresses.map((item) => buildMallShippingAddressView(item)).filter(Boolean) as MallShippingAddressView[] : []
}

export function buildMallAddressFormState(address?: MallShippingAddressApiItem | null): MallAddressFormState {
  const region = buildMallAddressRegionValue(address)

  return {
    hasAddress: Boolean(address),
    recipientName: address ? String(address.recipientName || '') : '',
    phone: address ? String(address.phone || '') : '',
    region,
    regionText: buildMallAddressRegionText(region),
    hasRegion: region.length === 3,
    detailAddress: address ? String(address.detailAddress || '') : '',
  }
}

export function normalizeMallAddressFormValue(value: Partial<MallAddressFormValue>): MallAddressFormState {
  const region = Array.isArray(value.region) ? value.region.map((item) => String(item || '').trim()).filter(Boolean) : []

  return {
    hasAddress: false,
    recipientName: String(value.recipientName || '').trim(),
    phone: String(value.phone || '').replace(/[^\d]/g, '').slice(0, 11),
    region,
    regionText: buildMallAddressRegionText(region),
    hasRegion: region.length === 3,
    detailAddress: String(value.detailAddress || '').trim(),
  }
}

export function validateMallAddressForm(value: Partial<MallAddressFormValue>) {
  const normalizedValue = normalizeMallAddressFormValue(value)

  if (!normalizedValue.recipientName) {
    return '请填写收货人'
  }

  if (!/^1\d{10}$/.test(normalizedValue.phone)) {
    return '请填写正确的手机号'
  }

  if (normalizedValue.region.length !== 3 || !normalizedValue.region[0] || !normalizedValue.region[1] || !normalizedValue.region[2]) {
    return '请完整选择省市区'
  }

  if (!normalizedValue.detailAddress) {
    return '请填写详细地址'
  }

  return ''
}
