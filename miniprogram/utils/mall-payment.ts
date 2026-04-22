import {
  fetchMallOrderDetail,
  type MallOrderApiItem,
  type MallOrderPaymentRequest,
} from './store-api'

const waitFor = (duration = 0) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), duration)
  })

export function requestMallWechatPayment(paymentRequest: MallOrderPaymentRequest) {
  return new Promise<void>((resolve, reject) => {
    const { timeStamp, nonceStr, package: packageValue, signType, paySign } = paymentRequest

    wx.requestPayment({
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: signType as WechatMiniprogram.RequestPaymentOption['signType'],
      paySign,
      success: () => resolve(),
      fail: reject,
    })
  })
}

export function isMallPaymentCancelled(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const errMsg = 'errMsg' in error ? String((error as { errMsg?: string }).errMsg || '') : ''
  return errMsg.indexOf('cancel') >= 0
}

export async function pollMallOrderPaymentResult(payload: {
  sessionToken: string
  orderId: string
  maxAttempts?: number
}) {
  const maxAttempts = Math.max(1, Number(payload.maxAttempts || 15))
  let lastOrder: MallOrderApiItem | null = null

  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetchMallOrderDetail({
        sessionToken: payload.sessionToken,
        orderId: payload.orderId,
      })

      lastOrder = response.data
      if (response.data.status === 'PAID' || response.data.status === 'CLOSED') {
        return response.data
      }
    } catch {}

    await waitFor(index < 4 ? 600 : 1000)
  }

  return lastOrder
}
