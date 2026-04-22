import type { MallCouponApiItem } from './store-api'

export type MallCouponSelectionMode = 'AUTO' | 'MANUAL' | 'NONE'

const MALL_COUPON_ACTION_SHEET_MAX_ITEMS = 6
const MALL_COUPON_ACTION_SHEET_FIXED_ITEMS = 2
const MALL_COUPON_ACTION_SHEET_COUPON_LIMIT =
  MALL_COUPON_ACTION_SHEET_MAX_ITEMS - MALL_COUPON_ACTION_SHEET_FIXED_ITEMS

export interface MallCouponSummaryView {
  availableCount: number
  couponCode: string
  couponName: string
  stage: string
  stageLabel: string
  selectionMode: MallCouponSelectionMode
  orderAmount: number
  orderAmountText: string
  discountAmount: number
  discountAmountText: string
  payableAmount: number
  payableAmountText: string
  hintText: string
  loginRequired: boolean
}

export interface MallCouponAnalyticsSummary {
  couponVisible: boolean
  couponAvailableCount: number
  couponApplied: boolean
  couponAutoApplied: boolean
  couponManualSelected: boolean
  couponSelectionMode: MallCouponSelectionMode
  couponCode: string
  couponName: string
  couponStage: string
  couponStageLabel: string
  couponOrderAmount: number
  couponOrderAmountText: string
  couponDiscountAmount: number
  couponDiscountAmountText: string
  couponPayableAmount: number
  couponPayableAmountText: string
  couponHintText: string
  couponLoginRequired: boolean
}

export interface MallCouponSelectorOptionView {
  id: string
  optionType: 'AUTO' | 'NONE' | 'COUPON'
  couponCode: string
  title: string
  caption: string
  discountAmount: number
  discountAmountText: string
  selected: boolean
  recommended: boolean
  badgeText: string
  selectionMode: MallCouponSelectionMode
}

function toMoneyNumber(value: number | string) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

function formatPrice(value: number | string) {
  return `¥${toMoneyNumber(value).toFixed(2)}`
}

function formatMallCouponValidDate(value?: string | null) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return ''
  }

  return normalizedValue.slice(0, 10).replace(/-/g, '.')
}

export function getMallCouponDiscountAmount(coupon: MallCouponApiItem | null, orderAmount: number) {
  if (!coupon) {
    return 0
  }

  return Math.min(Math.max(toMoneyNumber(coupon.amount), 0), Math.max(toMoneyNumber(orderAmount), 0))
}

function findMallCouponByCode(coupons: MallCouponApiItem[], couponCode: string) {
  const normalizedCouponCode = String(couponCode || '').trim()
  if (!normalizedCouponCode) {
    return null
  }

  return coupons.find((coupon) => String(coupon.code || '').trim() === normalizedCouponCode) || null
}

function compareMallCouponByDiscount(leftCoupon: MallCouponApiItem, rightCoupon: MallCouponApiItem, orderAmount: number) {
  const discountDifference =
    getMallCouponDiscountAmount(rightCoupon, orderAmount) - getMallCouponDiscountAmount(leftCoupon, orderAmount)
  if (discountDifference !== 0) {
    return discountDifference
  }

  const couponAmountDifference = toMoneyNumber(rightCoupon.amount) - toMoneyNumber(leftCoupon.amount)
  if (couponAmountDifference !== 0) {
    return couponAmountDifference
  }

  return String(leftCoupon.code || '').localeCompare(String(rightCoupon.code || ''))
}

function sortMallCouponsByPriority(
  coupons: MallCouponApiItem[] = [],
  orderAmount: number,
  currentCouponCode = '',
  selectionMode: MallCouponSelectionMode = 'AUTO',
) {
  const normalizedCurrentCouponCode = selectionMode === 'MANUAL' ? String(currentCouponCode || '').trim() : ''

  return (Array.isArray(coupons) ? coupons.slice() : []).sort((leftCoupon, rightCoupon) => {
    const leftIsCurrentCoupon =
      Boolean(normalizedCurrentCouponCode) && String(leftCoupon.code || '').trim() === normalizedCurrentCouponCode
    const rightIsCurrentCoupon =
      Boolean(normalizedCurrentCouponCode) && String(rightCoupon.code || '').trim() === normalizedCurrentCouponCode

    if (leftIsCurrentCoupon !== rightIsCurrentCoupon) {
      return leftIsCurrentCoupon ? -1 : 1
    }

    return compareMallCouponByDiscount(leftCoupon, rightCoupon, orderAmount)
  })
}

export function pickMallCouponActionSheetCoupons(
  coupons: MallCouponApiItem[] = [],
  orderAmount: number,
  currentCouponCode = '',
) {
  const sortedCoupons = sortMallCouponsByPriority(coupons, orderAmount, currentCouponCode, 'MANUAL')
  if (!sortedCoupons.length) {
    return []
  }

  if (sortedCoupons.length <= MALL_COUPON_ACTION_SHEET_COUPON_LIMIT) {
    return sortedCoupons
  }

  const normalizedCurrentCouponCode = String(currentCouponCode || '').trim()
  const currentCoupon = normalizedCurrentCouponCode ? findMallCouponByCode(sortedCoupons, normalizedCurrentCouponCode) : null
  const selectedCoupons: MallCouponApiItem[] = currentCoupon ? [currentCoupon] : []

  sortedCoupons.forEach((coupon) => {
    if (selectedCoupons.length >= MALL_COUPON_ACTION_SHEET_COUPON_LIMIT) {
      return
    }

    if (currentCoupon && String(coupon.code || '').trim() === String(currentCoupon.code || '').trim()) {
      return
    }

    selectedCoupons.push(coupon)
  })

  return selectedCoupons
}

export function buildMallCouponSelectorOptions(input: {
  coupons?: MallCouponApiItem[]
  orderAmount: number
  currentCouponCode?: string
  selectionMode?: MallCouponSelectionMode
}): MallCouponSelectorOptionView[] {
  const safeOrderAmount = toMoneyNumber(input.orderAmount)
  const selectionMode = input.selectionMode === 'MANUAL' || input.selectionMode === 'NONE' ? input.selectionMode : 'AUTO'
  const currentCouponCode = String(input.currentCouponCode || '').trim()
  const sortedCoupons = sortMallCouponsByPriority(input.coupons || [], safeOrderAmount, currentCouponCode, selectionMode)
  const bestCoupon = pickBestMallCoupon(sortedCoupons, safeOrderAmount)
  const bestCouponCode = String((bestCoupon && bestCoupon.code) || '').trim()
  const bestCouponDiscountAmount = getMallCouponDiscountAmount(bestCoupon, safeOrderAmount)

  const options: MallCouponSelectorOptionView[] = [
    {
      id: 'auto',
      optionType: 'AUTO',
      couponCode: bestCouponCode,
      title: '自动匹配最优券',
      caption: bestCoupon
        ? `${String(bestCoupon.name || bestCoupon.code || '当前最优券').trim()} · 预计减${formatPrice(bestCouponDiscountAmount)} · 金额变化时自动更新`
        : '当前暂无可自动匹配的优惠券',
      discountAmount: bestCouponDiscountAmount,
      discountAmountText: formatPrice(bestCouponDiscountAmount),
      selected: selectionMode === 'AUTO',
      recommended: Boolean(bestCoupon),
      badgeText: selectionMode === 'AUTO' ? '当前使用' : '省心推荐',
      selectionMode: 'AUTO',
    },
    {
      id: 'none',
      optionType: 'NONE',
      couponCode: '',
      title: '本次不使用优惠券',
      caption: sortedCoupons.length ? '按当前金额直接支付，后续仍可回来重新切换' : '当前暂无可用优惠券',
      discountAmount: 0,
      discountAmountText: formatPrice(0),
      selected: selectionMode === 'NONE',
      recommended: false,
      badgeText: selectionMode === 'NONE' ? '当前选择' : '不抵扣',
      selectionMode: 'NONE',
    },
  ]

  sortedCoupons.forEach((coupon, index) => {
    const couponCode = String(coupon.code || '').trim()
    const discountAmount = getMallCouponDiscountAmount(coupon, safeOrderAmount)
    const stageLabel = String(coupon.stageLabel || '').trim()
    const validDate = formatMallCouponValidDate(coupon.validTo)
    const selected = selectionMode === 'MANUAL' && Boolean(couponCode) && couponCode === currentCouponCode
    const recommended = Boolean(bestCouponCode) && couponCode === bestCouponCode

    options.push({
      id: `coupon_${couponCode || index + 1}`,
      optionType: 'COUPON',
      couponCode,
      title: String(coupon.name || coupon.code || '优惠券').trim() || '优惠券',
      caption: [
        stageLabel ? `适用 ${stageLabel}` : '商城可用',
        discountAmount > 0 ? `预计减${formatPrice(discountAmount)}` : '当前金额下不可抵扣',
        validDate ? `有效期至 ${validDate}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      discountAmount,
      discountAmountText: formatPrice(discountAmount),
      selected,
      recommended,
      badgeText: selected ? '当前使用' : recommended ? '最优推荐' : stageLabel || '可用',
      selectionMode: 'MANUAL',
    })
  })

  return options
}

export function pickBestMallCoupon(coupons: MallCouponApiItem[] = [], orderAmount: number) {
  const safeOrderAmount = toMoneyNumber(orderAmount)
  if (safeOrderAmount <= 0 || !Array.isArray(coupons) || !coupons.length) {
    return null
  }

  return coupons.reduce<MallCouponApiItem | null>((bestCoupon, currentCoupon) => {
    if (!bestCoupon) {
      return currentCoupon
    }

    const currentDiscountAmount = getMallCouponDiscountAmount(currentCoupon, safeOrderAmount)
    const bestDiscountAmount = getMallCouponDiscountAmount(bestCoupon, safeOrderAmount)

    if (currentDiscountAmount > bestDiscountAmount) {
      return currentCoupon
    }

    if (currentDiscountAmount < bestDiscountAmount) {
      return bestCoupon
    }

    return toMoneyNumber(currentCoupon.amount) > toMoneyNumber(bestCoupon.amount) ? currentCoupon : bestCoupon
  }, null)
}

export function buildMallCouponSummary(input: {
  coupons?: MallCouponApiItem[]
  orderAmount: number
  loggedIn: boolean
  loginHintText?: string
  emptyHintText?: string
  selectionMode?: MallCouponSelectionMode
  preferredCouponCode?: string
}) {
  const safeOrderAmount = toMoneyNumber(input.orderAmount)
  if (safeOrderAmount <= 0) {
    return null
  }

  const coupons = Array.isArray(input.coupons) ? input.coupons : []
  const requestedSelectionMode = input.selectionMode === 'MANUAL' || input.selectionMode === 'NONE' ? input.selectionMode : 'AUTO'
  const preferredCouponCode = String(input.preferredCouponCode || '').trim()
  if (!input.loggedIn) {
    return {
      availableCount: 0,
      couponCode: '',
      couponName: '',
      stage: '',
      stageLabel: '',
      selectionMode: 'AUTO' as MallCouponSelectionMode,
      orderAmount: safeOrderAmount,
      orderAmountText: formatPrice(safeOrderAmount),
      discountAmount: 0,
      discountAmountText: formatPrice(0),
      payableAmount: safeOrderAmount,
      payableAmountText: formatPrice(safeOrderAmount),
      hintText: input.loginHintText || '登录后可自动匹配或手动选择优惠券',
      loginRequired: true,
    }
  }

  let selectedCoupon: MallCouponApiItem | null = null
  let resolvedSelectionMode: MallCouponSelectionMode = 'AUTO'
  let hintText = input.emptyHintText || '当前暂无可用优惠券'

  if (requestedSelectionMode === 'NONE') {
    resolvedSelectionMode = 'NONE'
    hintText = coupons.length ? `当前可用 ${coupons.length} 张，本次不使用优惠券，点此可切换` : input.emptyHintText || '当前暂无可用优惠券'
  } else if (requestedSelectionMode === 'MANUAL') {
    selectedCoupon = findMallCouponByCode(coupons, preferredCouponCode)
    if (selectedCoupon) {
      resolvedSelectionMode = 'MANUAL'
      hintText = `当前可用 ${coupons.length} 张，已手动选择优惠券，点此可切换`
    } else {
      selectedCoupon = pickBestMallCoupon(coupons, safeOrderAmount)
      resolvedSelectionMode = 'AUTO'
      hintText = selectedCoupon
        ? '手动选择的优惠券已不可用，已恢复自动匹配最优券'
        : input.emptyHintText || '当前暂无可用优惠券'
    }
  } else {
    selectedCoupon = pickBestMallCoupon(coupons, safeOrderAmount)
    hintText = selectedCoupon
      ? `当前可用 ${coupons.length} 张，已自动匹配最优券，点此可切换`
      : input.emptyHintText || '当前暂无可用优惠券'
  }

  const discountAmount = getMallCouponDiscountAmount(selectedCoupon, safeOrderAmount)
  const payableAmount = Math.max(safeOrderAmount - discountAmount, 0)

  return {
    availableCount: coupons.length,
    couponCode: String((selectedCoupon && selectedCoupon.code) || ''),
    couponName: String((selectedCoupon && selectedCoupon.name) || ''),
    stage: String((selectedCoupon && selectedCoupon.stage) || ''),
    stageLabel: String((selectedCoupon && selectedCoupon.stageLabel) || ''),
    selectionMode: resolvedSelectionMode,
    orderAmount: safeOrderAmount,
    orderAmountText: formatPrice(safeOrderAmount),
    discountAmount,
    discountAmountText: formatPrice(discountAmount),
    payableAmount,
    payableAmountText: formatPrice(payableAmount),
    hintText,
    loginRequired: false,
  }
}

export function hasAutoAppliedMallCoupon(summary: MallCouponSummaryView | null | undefined) {
  return Boolean(summary && summary.selectionMode === 'AUTO' && summary.couponCode && summary.discountAmount > 0)
}

export function buildMallCouponAnalyticsSummary(summary: MallCouponSummaryView | null | undefined): MallCouponAnalyticsSummary {
  const safeSummary = summary || null
  const couponApplied = Boolean(safeSummary && safeSummary.couponCode && toMoneyNumber(safeSummary.discountAmount) > 0)
  const couponAutoApplied = Boolean(couponApplied && safeSummary && safeSummary.selectionMode === 'AUTO')
  const couponManualSelected = Boolean(couponApplied && safeSummary && safeSummary.selectionMode === 'MANUAL')

  return {
    couponVisible: Boolean(safeSummary),
    couponAvailableCount: safeSummary ? Number(safeSummary.availableCount || 0) : 0,
    couponApplied,
    couponAutoApplied,
    couponManualSelected,
    couponSelectionMode: safeSummary ? safeSummary.selectionMode : 'AUTO',
    couponCode: safeSummary ? String(safeSummary.couponCode || '') : '',
    couponName: safeSummary ? String(safeSummary.couponName || '') : '',
    couponStage: safeSummary ? String(safeSummary.stage || '') : '',
    couponStageLabel: safeSummary ? String(safeSummary.stageLabel || '') : '',
    couponOrderAmount: safeSummary ? toMoneyNumber(safeSummary.orderAmount) : 0,
    couponOrderAmountText: safeSummary ? String(safeSummary.orderAmountText || formatPrice(0)) : formatPrice(0),
    couponDiscountAmount: safeSummary ? toMoneyNumber(safeSummary.discountAmount) : 0,
    couponDiscountAmountText: safeSummary ? String(safeSummary.discountAmountText || formatPrice(0)) : formatPrice(0),
    couponPayableAmount: safeSummary ? toMoneyNumber(safeSummary.payableAmount) : 0,
    couponPayableAmountText: safeSummary ? String(safeSummary.payableAmountText || formatPrice(0)) : formatPrice(0),
    couponHintText: safeSummary ? String(safeSummary.hintText || '') : '',
    couponLoginRequired: Boolean(safeSummary && safeSummary.loginRequired),
  }
}

export function buildMallCouponAnalyticsDedupKey(input: {
  mallPage: string
  mallSource: string
  targetId?: string
  summary: MallCouponSummaryView | null | undefined
  extraKey?: string
}) {
  const analyticsSummary = buildMallCouponAnalyticsSummary(input.summary)

  return [
    String(input.mallPage || '').trim(),
    String(input.mallSource || '').trim(),
    String(input.targetId || '').trim(),
    String(input.extraKey || '').trim(),
    String(analyticsSummary.couponAvailableCount),
    analyticsSummary.couponCode || 'none',
    analyticsSummary.couponStage || 'none',
    analyticsSummary.couponSelectionMode,
    analyticsSummary.couponDiscountAmount.toFixed(2),
    analyticsSummary.couponOrderAmount.toFixed(2),
    analyticsSummary.couponPayableAmount.toFixed(2),
    analyticsSummary.couponLoginRequired ? 'login' : 'ready',
  ].join(':')
}
