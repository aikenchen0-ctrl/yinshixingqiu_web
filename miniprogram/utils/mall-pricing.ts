export interface MallPricingItemInput {
  price: number | string
  publicPrice?: number | string
  quantity?: number | string
}

export interface MallPricingSummaryView {
  publicAmount: number
  publicAmountText: string
  orderAmount: number
  orderAmountText: string
  memberDiscountAmount: number
  memberDiscountAmountText: string
  memberDiscountApplied: boolean
  couponDiscountAmount: number
  couponDiscountAmountText: string
  couponDiscountApplied: boolean
  totalDiscountAmount: number
  totalDiscountAmountText: string
  payableAmount: number
  payableAmountText: string
  couponStackingApplied: boolean
  couponStackingRuleText: string
}

function toMoneyNumber(value: number | string) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

function formatPrice(value: number | string) {
  return `¥${toMoneyNumber(value).toFixed(2)}`
}

function buildMallCouponStackingRuleText(memberDiscountAmount: number) {
  return memberDiscountAmount > 0 ? '会员价商品可叠加商城券，优惠券按会员价后的订单金额计算' : ''
}

function buildMallPricingSummaryFromAmounts(input: {
  publicAmount: number
  orderAmount: number
  couponDiscountAmount?: number | string
  couponStackingRuleText?: string
}) {
  const orderAmount = Math.max(toMoneyNumber(input.orderAmount), 0)
  const publicAmount = Math.max(toMoneyNumber(input.publicAmount), orderAmount)
  const memberDiscountAmount = Math.max(toMoneyNumber(publicAmount - orderAmount), 0)
  const couponDiscountAmount = Math.min(Math.max(toMoneyNumber(input.couponDiscountAmount || 0), 0), orderAmount)
  const totalDiscountAmount = toMoneyNumber(memberDiscountAmount + couponDiscountAmount)
  const payableAmount = Math.max(toMoneyNumber(orderAmount - couponDiscountAmount), 0)
  const couponStackingRuleText =
    String(input.couponStackingRuleText || '').trim() || buildMallCouponStackingRuleText(memberDiscountAmount)

  return {
    publicAmount,
    publicAmountText: formatPrice(publicAmount),
    orderAmount,
    orderAmountText: formatPrice(orderAmount),
    memberDiscountAmount,
    memberDiscountAmountText: formatPrice(memberDiscountAmount),
    memberDiscountApplied: memberDiscountAmount > 0,
    couponDiscountAmount,
    couponDiscountAmountText: formatPrice(couponDiscountAmount),
    couponDiscountApplied: couponDiscountAmount > 0,
    totalDiscountAmount,
    totalDiscountAmountText: formatPrice(totalDiscountAmount),
    payableAmount,
    payableAmountText: formatPrice(payableAmount),
    couponStackingApplied: memberDiscountAmount > 0 && couponDiscountAmount > 0,
    couponStackingRuleText,
  } satisfies MallPricingSummaryView
}

export function buildMallCheckoutPricingSummary(input: {
  items?: MallPricingItemInput[]
  couponDiscountAmount?: number | string
  couponStackingRuleText?: string
}) {
  const items = Array.isArray(input.items) ? input.items : []
  const amounts = items.reduce(
    (result, item) => {
      const quantity = Math.max(Number(item.quantity || 1), 0)
      const orderUnitPrice = toMoneyNumber(item.price)
      const publicUnitPrice = Math.max(toMoneyNumber(item.publicPrice || orderUnitPrice), orderUnitPrice)

      return {
        publicAmount: result.publicAmount + publicUnitPrice * quantity,
        orderAmount: result.orderAmount + orderUnitPrice * quantity,
      }
    },
    {
      publicAmount: 0,
      orderAmount: 0,
    },
  )

  return buildMallPricingSummaryFromAmounts({
    publicAmount: amounts.publicAmount,
    orderAmount: amounts.orderAmount,
    couponDiscountAmount: input.couponDiscountAmount,
    couponStackingRuleText: input.couponStackingRuleText,
  })
}

export function buildMallOrderPricingSummary(input: {
  publicAmount?: number | string
  orderAmount: number | string
  couponDiscountAmount?: number | string
  couponStackingRuleText?: string
}) {
  return buildMallPricingSummaryFromAmounts({
    publicAmount: toMoneyNumber(input.publicAmount || input.orderAmount),
    orderAmount: toMoneyNumber(input.orderAmount),
    couponDiscountAmount: input.couponDiscountAmount,
    couponStackingRuleText: input.couponStackingRuleText,
  })
}

export function buildMallPricingAnalyticsSummary(summary: MallPricingSummaryView | null | undefined) {
  const safeSummary = summary || null

  return {
    pricingPublicAmount: safeSummary ? safeSummary.publicAmount : 0,
    pricingPublicAmountText: safeSummary ? safeSummary.publicAmountText : formatPrice(0),
    memberDiscountAmount: safeSummary ? safeSummary.memberDiscountAmount : 0,
    memberDiscountAmountText: safeSummary ? safeSummary.memberDiscountAmountText : formatPrice(0),
    memberDiscountApplied: Boolean(safeSummary && safeSummary.memberDiscountApplied),
    couponDiscountAmount: safeSummary ? safeSummary.couponDiscountAmount : 0,
    couponDiscountAmountText: safeSummary ? safeSummary.couponDiscountAmountText : formatPrice(0),
    totalDiscountAmount: safeSummary ? safeSummary.totalDiscountAmount : 0,
    totalDiscountAmountText: safeSummary ? safeSummary.totalDiscountAmountText : formatPrice(0),
    couponStackingApplied: Boolean(safeSummary && safeSummary.couponStackingApplied),
    couponStackingRuleText: safeSummary ? String(safeSummary.couponStackingRuleText || '') : '',
    payableAmount: safeSummary ? safeSummary.payableAmount : 0,
    payableAmountText: safeSummary ? safeSummary.payableAmountText : formatPrice(0),
  }
}
