import { getArticleReadPresentation } from '../../utils/article-data'
import {
  buildRemoteArticleDetail,
  createEmptyArticleDetailViewModel,
  type ArticleContentBlock,
  type ArticleDetailViewModel,
} from '../../utils/article-view'
import { clearSession, getStoredSession, shouldClearSessionByError } from '../../utils/auth'
import { createArticleShareLink, createArticleUnlockOrder, fetchArticleDetail, fetchArticles, fetchOrderDetail, mockArticleUnlockPayment } from '../../utils/planet-api'
import { ensureWechatSession } from '../../utils/wechat-login'
import {
  buildArticleDetailShareLinkValue,
  buildArticleDetailShareOptions,
  buildArticleSharePickerState,
  buildArticleShareScrollRetryDelays,
  resolveArticleShareTargetIndex,
  shouldRetryArticleShareScrollAfterMeasure,
} from './shared'

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

const normalizeComparableTitle = (value: string) => String(value || '').replace(/\s+/g, '').trim()

const normalizeComparableUrl = (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return ''
  }

  return normalizedValue.replace(/#.*$/, '')
}

const isWechatCardBlock = (
  block: ArticleContentBlock | undefined
): block is Extract<ArticleContentBlock, { type: 'wechat-card' }> => Boolean(block && block.type === 'wechat-card')

let shareScrollRetryTimerIds: number[] = []
let shareScrollCurrentAnchorId = ''
let shareScrollCurrentImageKey = ''
let shareScrollLastMeasuredAnchorTop = Number.NaN
let shareScrollMeasureRetryCount = 0
let shareScrollImageLoadRetryCount = 0

const MAX_SHARE_SCROLL_MEASURE_RETRY_COUNT = 3
const MAX_SHARE_SCROLL_IMAGE_LOAD_RETRY_COUNT = 2

const clearArticleShareScrollRetryTimers = () => {
  shareScrollRetryTimerIds.forEach((timerId) => {
    clearTimeout(timerId)
  })
  shareScrollRetryTimerIds = []
}

const resetArticleShareScrollRuntimeState = () => {
  clearArticleShareScrollRetryTimers()
  shareScrollCurrentAnchorId = ''
  shareScrollCurrentImageKey = ''
  shareScrollLastMeasuredAnchorTop = Number.NaN
  shareScrollMeasureRetryCount = 0
  shareScrollImageLoadRetryCount = 0
}

Page({
  data: {
    article: createEmptyArticleDetailViewModel() as ArticleDetailViewModel,
    articleId: '',
    source: 'wechat' as ContentSource,
    loading: true,
    error: '',
    unlocking: false,
    sharePreparing: false,
    sharePickerVisible: false,
    sharePickerItems: [] as Array<{ id: string; imageUrl: string; imageKey: string; imageIndex: number }>,
    selectedShareImage: '',
    selectedShareImageKey: '',
    selectedShareImageIndex: -1,
    pendingShareImageKey: '',
    pendingShareImageIndex: -1,
    scrollIntoViewId: '',
  },

  onLoad(options: Record<string, string>) {
    const articleId = String(options.id || '').trim()
    const source = options.source === 'planet' ? 'planet' : 'wechat'
    const pendingShareImageKey = String(options.shareImageKey || '').trim()
    const rawShareImageIndex = Number(options.shareImageIndex)
    const pendingShareImageIndex = Number.isInteger(rawShareImageIndex) && rawShareImageIndex >= 0 ? rawShareImageIndex : -1

    this.setData({
      articleId,
      source,
      pendingShareImageKey,
      pendingShareImageIndex,
    })

    if (!articleId) {
      this.setData({
        loading: false,
        error: '缺少文章ID',
      })
      return
    }

    void this.loadArticle(articleId)
  },

  onUnload() {
    resetArticleShareScrollRuntimeState()
  },

  async loadArticle(articleId: string) {
    this.setData({
      loading: true,
      error: '',
    })

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

      const article = buildRemoteArticleDetail(response.data)
      this.setData({
        article,
        source: article.contentSource,
        loading: false,
        error: '',
      }, () => {
        this.scrollToPendingSharedImage()
      })
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '加载文章详情失败',
      })
    }
  },

  onShareAppMessage() {
    if (this.data.sharePickerVisible) {
      this.setData({
        sharePickerVisible: false,
        sharePickerItems: [],
      })
    }

    return buildArticleDetailShareOptions(this.buildSelectedShareCardPayload())
  },

  buildSelectedShareCardPayload() {
    const selectedShareImage = String(this.data.selectedShareImage || '').trim()
    const selectedShareImageKey = String(this.data.selectedShareImageKey || '').trim()
    const selectedShareImageIndex = Number(this.data.selectedShareImageIndex)
    const hasSelectedShareImage = Boolean(selectedShareImage) && Number.isInteger(selectedShareImageIndex) && selectedShareImageIndex >= 0

    return {
      articleId: this.data.articleId,
      source: this.data.source,
      shareImageKey: hasSelectedShareImage ? selectedShareImageKey : '',
      shareImageIndex: hasSelectedShareImage ? selectedShareImageIndex : -1,
      article: {
        title: this.data.article.title,
        coverImage: this.data.article.coverImage,
        shareImageCandidates: hasSelectedShareImage ? [selectedShareImage] : this.data.article.shareImageCandidates,
      },
    }
  },

  onTapShare() {
    void this.openShareFlow()
  },

  noop() {},

  onArticleVisualAssetLoad() {
    if (!shareScrollCurrentAnchorId || shareScrollImageLoadRetryCount >= MAX_SHARE_SCROLL_IMAGE_LOAD_RETRY_COUNT) {
      return
    }

    shareScrollImageLoadRetryCount += 1
    this.runPendingShareScrollAttempt({
      targetAnchorId: shareScrollCurrentAnchorId,
      targetImageKey: shareScrollCurrentImageKey,
      reason: 'image-load',
    })
  },

  onCloseSharePicker() {
    if (this.data.sharePreparing) {
      return
    }

    this.setData({
      sharePickerVisible: false,
      sharePickerItems: [],
      selectedShareImage: '',
      selectedShareImageKey: '',
      selectedShareImageIndex: -1,
    })
  },

  onSelectShareImage(event: WechatMiniprogram.BaseEvent<{ imageUrl?: string; imageKey?: string; imageIndex?: number | string }>) {
    const imageUrl = String(event.currentTarget.dataset.imageUrl || '').trim()
    const imageKey = String(event.currentTarget.dataset.imageKey || '').trim()
    const imageIndex = Number(event.currentTarget.dataset.imageIndex)
    if (!imageUrl) {
      return
    }

    this.setData({
      selectedShareImage: imageUrl,
      selectedShareImageKey: imageKey,
      selectedShareImageIndex: Number.isInteger(imageIndex) && imageIndex >= 0 ? imageIndex : -1,
    })
  },

  onPrepareShareCard() {
    if (!this.data.selectedShareImage || this.data.selectedShareImageIndex < 0) {
      return
    }

    this.setData({
      sharePickerVisible: false,
      sharePickerItems: [],
    })
  },

  onCopyShareLink() {
    if (!this.data.selectedShareImage || this.data.selectedShareImageIndex < 0) {
      return
    }

    const sharePath = buildArticleDetailShareLinkValue(this.buildSelectedShareCardPayload())
    if (!sharePath) {
      wx.showToast({
        title: '分享链接生成失败',
        icon: 'none',
      })
      return
    }

    wx.showLoading({
      title: '生成链接中',
      mask: true,
    })

    void createArticleShareLink({
      path: sharePath,
    })
      .then((response) => {
        const shareLinkValue = response && response.data ? String(response.data.openlink || '').trim() : ''
        if (!shareLinkValue) {
          throw new Error('微信分享链接返回为空')
        }

        wx.hideLoading()
        wx.setClipboardData({
          data: shareLinkValue,
          success: () => {
            wx.showToast({
              title: '分享链接已复制',
              icon: 'none',
            })
          },
          fail: () => {
            wx.showToast({
              title: '复制失败，请重试',
              icon: 'none',
            })
          },
        })
      })
      .catch((error: unknown) => {
        wx.hideLoading()
        wx.showToast({
          title: error instanceof Error ? error.message : '生成分享链接失败',
          icon: 'none',
        })
      })
  },

  onReload() {
    if (!this.data.articleId) {
      return
    }

    void this.loadArticle(this.data.articleId)
  },

  onOpenMoreContent() {
    void this.openMoreContent()
  },

  onTapWechatArticleCard(event: WechatMiniprogram.BaseEvent<{ index?: number | string }>) {
    const blockIndex = Number(event.currentTarget.dataset.index)
    if (!Number.isInteger(blockIndex) || blockIndex < 0) {
      return
    }

    void this.openWechatArticleCard(blockIndex)
  },

  async openWechatArticleCard(blockIndex: number) {
    const block = this.data.article.bodyBlocks[blockIndex]
    if (!isWechatCardBlock(block)) {
      return
    }

    if (block.linkedArticleId) {
      wx.navigateTo({
        url: `/pages/articles/detail?id=${encodeURIComponent(block.linkedArticleId)}&source=wechat`,
      })
      return
    }

    const linkedArticleId = await this.resolveWechatCardArticleId(block)
    if (linkedArticleId) {
      const nextBlocks = this.data.article.bodyBlocks.slice()
      nextBlocks[blockIndex] = {
        ...block,
        linkedArticleId,
        buttonText: '进入小程序阅读',
      }

      this.setData({
        'article.bodyBlocks': nextBlocks,
      })

      wx.navigateTo({
        url: `/pages/articles/detail?id=${encodeURIComponent(linkedArticleId)}&source=wechat`,
      })
      return
    }

    const sourceUrl = String(block.sourceUrl || '').trim()
    if (!sourceUrl) {
      wx.showToast({
        title: '暂未找到卡片链接',
        icon: 'none',
      })
      return
    }

    wx.setClipboardData({
      data: sourceUrl,
      success: () => {
        wx.showToast({
          title: '原文链接已复制',
          icon: 'none',
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制链接失败',
          icon: 'none',
        })
      },
    })
  },

  async resolveWechatCardArticleId(block: Extract<ArticleContentBlock, { type: 'wechat-card' }>) {
    const targetUrl = normalizeComparableUrl(block.sourceUrl)
    const targetTitle = normalizeComparableTitle(block.title)

    if (!targetTitle) {
      return ''
    }

    try {
      const response = await fetchArticles({
        contentSource: 'wechat',
        status: 'PUBLISHED',
        search: block.title,
        page: 1,
        pageSize: 20,
      })

      const items = response.data && Array.isArray(response.data.items) ? response.data.items : []
      const matchedBySourceUrl = items.find((item) => {
        const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
        const itemSourceUrl =
          typeof metadata.sourceUrl === 'string'
            ? metadata.sourceUrl
            : typeof metadata.url === 'string'
              ? metadata.url
              : ''

        return Boolean(targetUrl) && normalizeComparableUrl(itemSourceUrl) === targetUrl
      })

      if (matchedBySourceUrl && matchedBySourceUrl.id) {
        return String(matchedBySourceUrl.id)
      }

      const matchedByTitle = items.find(
        (item) => normalizeComparableTitle(item.title || '') === targetTitle && String(item.id || '').trim(),
      )

      return matchedByTitle && matchedByTitle.id ? String(matchedByTitle.id) : ''
    } catch {
      return ''
    }
  },

  async openShareFlow() {
    if (this.data.sharePreparing || this.data.loading || !this.data.articleId || this.data.source !== 'wechat') {
      return
    }

    const shareImageCandidates = Array.isArray(this.data.article.shareImageCandidates)
      ? this.data.article.shareImageCandidates.map((item) => String(item || '').trim()).filter(Boolean)
      : []

    if (!shareImageCandidates.length) {
      wx.showToast({
        title: '文章里没有可分享的图片',
        icon: 'none',
      })
      return
    }

    this.setData({
      sharePickerVisible: true,
      sharePickerItems: buildArticleSharePickerState(shareImageCandidates).items,
      selectedShareImage: '',
      selectedShareImageKey: '',
      selectedShareImageIndex: -1,
    })
  },

  scrollToPendingSharedImage() {
    const pendingShareImageKey = String(this.data.pendingShareImageKey || '').trim()
    const pendingShareImageIndex = Number(this.data.pendingShareImageIndex)
    const imageKeys = Array.isArray(this.data.article.shareImageKeys)
      ? this.data.article.shareImageKeys.map((item) => String(item || '').trim())
      : []
    const targetImageIndex = resolveArticleShareTargetIndex({
      shareImageKey: pendingShareImageKey,
      shareImageIndex: pendingShareImageIndex,
      imageKeys,
    })

    if (targetImageIndex < 0) {
      return
    }

    const targetAnchors = Array.isArray(this.data.article.shareImageTargetAnchorIds)
      ? this.data.article.shareImageTargetAnchorIds
      : []
    const targetAnchorId = String(targetAnchors[targetImageIndex] || '').trim()

    if (!targetAnchorId) {
      return
    }

    clearArticleShareScrollRetryTimers()
    shareScrollCurrentAnchorId = targetAnchorId
    shareScrollCurrentImageKey = String(imageKeys[targetImageIndex] || pendingShareImageKey || '').trim()
    shareScrollLastMeasuredAnchorTop = Number.NaN
    shareScrollMeasureRetryCount = 0
    shareScrollImageLoadRetryCount = 0

    const retryDelays = buildArticleShareScrollRetryDelays()
    retryDelays.forEach((delay, attemptIndex) => {
      const timerId = setTimeout(() => {
        this.runPendingShareScrollAttempt({
          targetAnchorId,
          targetImageKey: shareScrollCurrentImageKey,
          reason: attemptIndex === 0 ? 'page-ready' : 'delayed-retry',
          finalizePending: attemptIndex === retryDelays.length - 1,
        })
      }, delay) as unknown as number

      shareScrollRetryTimerIds.push(timerId)
    })
  },

  runPendingShareScrollAttempt(input: {
    targetAnchorId: string
    targetImageKey: string
    finalizePending?: boolean
  }) {
    const targetAnchorId = String(input.targetAnchorId || '').trim()
    if (!targetAnchorId || targetAnchorId !== shareScrollCurrentAnchorId) {
      return
    }

    const targetImageKey = String(input.targetImageKey || '').trim()
    const finalizePending = input.finalizePending === true

    this.setData({
      scrollIntoViewId: '',
    }, () => {
      this.setData({
        scrollIntoViewId: targetAnchorId,
        pendingShareImageKey: finalizePending ? '' : this.data.pendingShareImageKey,
        pendingShareImageIndex: finalizePending ? -1 : this.data.pendingShareImageIndex,
      })
    })

    const timerId = setTimeout(() => {
      this.measurePendingSharedImageAnchor({
        targetAnchorId,
        targetImageKey,
      })
    }, 260) as unknown as number

    shareScrollRetryTimerIds.push(timerId)
  },

  measurePendingSharedImageAnchor(input: {
    targetAnchorId: string
    targetImageKey: string
  }) {
    const targetAnchorId = String(input.targetAnchorId || '').trim()
    if (!targetAnchorId || targetAnchorId !== shareScrollCurrentAnchorId) {
      return
    }

    const targetImageKey = String(input.targetImageKey || '').trim()
    const query = wx.createSelectorQuery()

    query.select(`#${targetAnchorId}`).boundingClientRect()
    query.exec((result) => {
      const rect = Array.isArray(result) ? result[0] : null
      const currentAnchorTop = rect && typeof rect.top === 'number' ? rect.top : Number.NaN
      const previousAnchorTop = shareScrollLastMeasuredAnchorTop

      if (!Number.isFinite(currentAnchorTop)) {
        return
      }

      shareScrollLastMeasuredAnchorTop = currentAnchorTop

      const shouldRetry = shouldRetryArticleShareScrollAfterMeasure({
        previousAnchorTop,
        currentAnchorTop,
      })
      const retryReason =
        Number.isFinite(previousAnchorTop) && Math.abs(currentAnchorTop - previousAnchorTop) >= 32
          ? 'anchor-shift'
          : currentAnchorTop >= 160
            ? 'anchor-below-threshold'
            : 'stable'

      if (!shouldRetry) {
        return
      }

      if (shareScrollMeasureRetryCount >= MAX_SHARE_SCROLL_MEASURE_RETRY_COUNT) {
        return
      }

      shareScrollMeasureRetryCount += 1
      this.runPendingShareScrollAttempt({
        targetAnchorId,
        targetImageKey,
        reason: retryReason,
      })
    })
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

    if (this.data.article.access.accessType !== 'paid') {
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
        const article = buildRemoteArticleDetail(latestArticle.data)
        this.setData({
          article,
          source: article.contentSource,
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

      const article = buildRemoteArticleDetail(unlockedDetail.data)
      this.setData({
        article,
        source: article.contentSource,
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
})
