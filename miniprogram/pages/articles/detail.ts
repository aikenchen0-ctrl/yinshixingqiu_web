import { getArticleById, getArticleReadPresentation } from '../../utils/article-data'
import {
  buildRemoteArticleDetail,
  buildStaticArticleDetail,
  createEmptyArticleDetailViewModel,
  type ArticleDetailViewModel,
} from '../../utils/article-view'
import { clearSession, getStoredSession, shouldClearSessionByError } from '../../utils/auth'
import { createArticleUnlockOrder, fetchArticleDetail, fetchOrderDetail, mockArticleUnlockPayment } from '../../utils/planet-api'
import { rememberActivePlanetId } from '../../utils/planet-route'
import { ensureWechatSession } from '../../utils/wechat-login'

type ContentSource = 'wechat' | 'planet'
type ArticleUnlockWechatPaymentRequest = {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

const waitFor = (duration = 0) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), duration)
  })

const requestWechatPayment = (paymentRequest: ArticleUnlockWechatPaymentRequest) =>
  new Promise<void>((resolve, reject) => {
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

const isPaymentCancelled = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const errMsg = 'errMsg' in error ? String((error as { errMsg?: string }).errMsg || '') : ''
  return errMsg.indexOf('cancel') >= 0
}

const isDevelopEnv = () => {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const miniProgram = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram : null
    return !miniProgram || miniProgram.envVersion === 'develop'
  } catch {
    return true
  }
}

Page({
  data: {
    article: createEmptyArticleDetailViewModel() as ArticleDetailViewModel,
    articleId: '',
    source: 'wechat' as ContentSource,
    loading: true,
    error: '',
    unlocking: false,
  },

  onLoad(options: Record<string, string>) {
    const articleId = String(options.id || '').trim() || 'a1'
    const source = options.source === 'planet' ? 'planet' : 'wechat'

    this.setData({
      articleId,
      source,
    })

    void this.loadArticle(articleId, source)
  },

  async loadArticle(articleId: string, source: ContentSource) {
    this.setData({
      loading: true,
      error: '',
    })

    if (source === 'planet') {
      const storedSession = getStoredSession()
      const sessionToken = storedSession && storedSession.sessionToken ? storedSession.sessionToken : ''

      try {
        let response

        try {
          response = await fetchArticleDetail(articleId, true, sessionToken || undefined)
        } catch (error) {
          if (sessionToken) {
            if (shouldClearSessionByError(error)) {
              clearSession()
            }
            response = await fetchArticleDetail(articleId, true)
          } else {
            throw error
          }
        }

        this.setData({
          article: buildRemoteArticleDetail(response.data),
          loading: false,
          error: '',
        })
        return
      } catch (error) {
        this.setData({
          loading: false,
          error: error instanceof Error ? error.message : '加载文章详情失败',
        })
        return
      }
    }

    const article = buildStaticArticleDetail(getArticleById(articleId))
    this.setData({
      article,
      loading: false,
      error: '',
    })
  },

  onReload() {
    if (!this.data.articleId) {
      return
    }

    void this.loadArticle(this.data.articleId, this.data.source)
  },

  onOpenMoreContent() {
    void this.openMoreContent()
  },

  async openMoreContent() {
    const presentation = getArticleReadPresentation({
      access: this.data.article.access,
      updated: false,
    })

    if (this.data.unlocking) {
      return
    }

    if (presentation.canReadFull) {
      wx.showToast({
        title: '当前已可阅读全文',
        icon: 'none',
      })
      return
    }

    if (this.data.source !== 'planet' || this.data.article.access.accessType !== 'paid') {
      wx.showToast({
        title: '当前文章无需解锁',
        icon: 'none',
      })
      return
    }

    this.setData({
      unlocking: true,
    })

    try {
      wx.showLoading({
        title: '创建支付订单',
        mask: true,
      })

      const session = await ensureWechatSession()
      const orderResponse = await createArticleUnlockOrder({
        articleId: this.data.articleId,
        userId: session.id,
        paymentChannel: 'WECHAT',
        sessionToken: session.sessionToken,
      })

      if (!orderResponse.ok || !orderResponse.data || !orderResponse.data.order) {
        throw new Error(orderResponse.message || '创建文章解锁订单失败')
      }

      const orderNo = orderResponse.data.order.orderNo
      const payment = orderResponse.data.payment
      const paymentRequest = payment && payment.request ? payment.request : null
      const alreadyUnlocked = !!(orderResponse.data.unlock && orderResponse.data.unlock.isUnlocked)

      if (alreadyUnlocked || orderResponse.data.idempotent) {
        const latestArticle = await fetchArticleDetail(this.data.articleId, false, session.sessionToken)
        this.setData({
          article: buildRemoteArticleDetail(latestArticle.data),
          error: '',
        })
        wx.hideLoading()
        wx.showToast({
          title: '已解锁全文',
          icon: 'success',
        })
        return
      }

      if (payment && payment.required) {
        if (!paymentRequest) {
          throw new Error('未获取到微信支付参数，请稍后重试')
        }

        wx.hideLoading()

        try {
          await requestWechatPayment(paymentRequest)
        } catch (error) {
          if (isPaymentCancelled(error)) {
            wx.showToast({
              title: '已取消支付',
              icon: 'none',
            })
            return
          }

          if (!isDevelopEnv()) {
            throw new Error('微信支付未完成，请稍后重试')
          }

          wx.showLoading({
            title: '开发态模拟支付',
            mask: true,
          })

          await mockArticleUnlockPayment({
            orderNo,
            transactionNo: `MOCK_ARTICLE_${Date.now()}`,
            success: true,
          })
        }
      }

      wx.showLoading({
        title: '确认解锁结果',
        mask: true,
      })

      let unlockedDetail = null as Awaited<ReturnType<typeof fetchArticleDetail>> | null
      for (let index = 0; index < 15; index += 1) {
        try {
          await fetchOrderDetail({
            orderNo,
            sessionToken: session.sessionToken,
            userId: session.id,
          })
        } catch {}

        try {
          const response = await fetchArticleDetail(this.data.articleId, false, session.sessionToken)
          if (response.data && response.data.canReadFull) {
            unlockedDetail = response
            break
          }
        } catch {}

        await waitFor(index < 4 ? 600 : 1000)
      }

      if (!unlockedDetail || !unlockedDetail.data || !unlockedDetail.data.canReadFull) {
        throw new Error('支付结果确认中，请稍后刷新页面查看')
      }

      this.setData({
        article: buildRemoteArticleDetail(unlockedDetail.data),
        error: '',
      })

      wx.hideLoading()
      wx.showToast({
        title: '已解锁全文',
        icon: 'success',
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error instanceof Error ? error.message : '解锁全文失败',
        icon: 'none',
      })
    } finally {
      this.setData({
        unlocking: false,
      })
    }
  },

  onPlanetCardTap(e: WechatMiniprogram.TouchEvent) {
    const id = rememberActivePlanetId(String(e.currentTarget.dataset.id || ''))
    if (!id) {
      return
    }

    const name = e.currentTarget.dataset.name || '知识星球'
    const creator = e.currentTarget.dataset.creator || ''

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}`,
    })
  },
})
