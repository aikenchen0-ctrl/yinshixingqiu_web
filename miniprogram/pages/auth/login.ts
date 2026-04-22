import { clearPendingLoginRedirect, getPendingLoginRedirect } from '../../utils/auth'
import { ensureWechatSession, loginWithPhoneCode } from '../../utils/wechat-login'

interface LoginSceneConfig {
  sceneBadge: string
  heroMark: string
  sceneTitle: string
  sceneSubtitle: string
  panelTitle: string
  panelDesc: string
  footerTitle: string
  footerDesc: string
  successText: string
  benefits: string[]
}

const DEFAULT_REDIRECT_URL = '/pages/planet/mine'
const TAB_PAGE_PATHS = [
  '/pages/index/index',
  '/pages/course/list',
  '/pages/articles/index',
  '/pages/store/index',
  '/pages/profile/index',
]

function normalizeRedirectUrl(rawRedirectUrl?: string, fallbackUrl = DEFAULT_REDIRECT_URL) {
  const redirectUrl = rawRedirectUrl ? decodeURIComponent(rawRedirectUrl) : ''
  return redirectUrl && redirectUrl.indexOf('/pages/') === 0 ? redirectUrl : fallbackUrl
}

function resolveRedirectUrl(rawRedirectUrl?: string) {
  const redirectUrlFromQuery = normalizeRedirectUrl(rawRedirectUrl, '')
  if (redirectUrlFromQuery) {
    return redirectUrlFromQuery
  }

  const redirectUrlFromStorage = getPendingLoginRedirect()
  if (redirectUrlFromStorage) {
    return redirectUrlFromStorage
  }

  return DEFAULT_REDIRECT_URL
}

function buildLoginSceneConfig(redirectUrl: string): LoginSceneConfig {
  if (redirectUrl.indexOf('/pages/store') === 0) {
    return {
      sceneBadge: '商城账号登录',
      heroMark: '商城',
      sceneTitle: '先登录再下单',
      sceneSubtitle: '商城里的下单、评价和订单记录都要先绑定你的账号，登录成功后会直接回到当前商城页面。',
      panelTitle: '商城需要这一层登录',
      panelDesc: '这样后端才能把购物车、订单和商品评价稳定挂到同一个用户上，第一版先把主链路做顺。',
      footerTitle: '登录后你能继续做什么',
      footerDesc: '继续浏览商品、提交订单、写评价，商城页会按你刚才所在的位置继续。',
      successText: '登录成功，正在返回商城',
      benefits: ['购物车和订单会跟账号同步', '评价会直接挂在当前商品下', '登录成功后回到你刚才的商城页面'],
    }
  }

  if (redirectUrl.indexOf('/pages/profile') === 0) {
    return {
      sceneBadge: '账号登录',
      heroMark: '账号',
      sceneTitle: '连接你的微信账号',
      sceneSubtitle: '登录后可以继续管理个人资料、查看账号信息，并同步你在小程序内的使用记录。',
      panelTitle: '这一步会做什么',
      panelDesc: '先用微信建立身份，再按需补充手机号，用于关键操作校验和后续账号找回。',
      footerTitle: '为什么还需要手机号',
      footerDesc: '手机号只做账号确认和高风险操作校验，不需要手动输入，点一次授权即可。',
      successText: '登录成功',
      benefits: ['自动建立微信登录态', '可一键补充手机号', '登录完成后返回我的页面'],
    }
  }

  return {
    sceneBadge: '饮视星球登录',
    heroMark: '星球',
    sceneTitle: '手机号一键登录',
    sceneSubtitle: '进入饮视星球会先静默建立微信身份，这里用于一键补充手机号，完成统一登录。',
    panelTitle: '这一步会做什么',
    panelDesc: '星球、资料页和商城都共用同一个账号体系，登录完成后会自动回到你刚才的页面。',
    footerTitle: '登录后可以继续什么',
    footerDesc: '继续创建星球、查看我的资料、进入商城和使用后续需要登录的功能。',
    successText: '登录成功',
    benefits: ['先用微信身份建立登录态', '点击按钮后一键授权手机号', '登录成功后回到刚才的页面'],
  }
}

Page({
  data: {
    navOffset: 72,
    agreeProtocol: true,
    loading: false,
    redirectUrl: DEFAULT_REDIRECT_URL,
    sceneBadge: '饮视星球登录',
    heroMark: '星球',
    sceneTitle: '手机号一键登录',
    sceneSubtitle: '进入饮视星球会先静默建立微信身份，这里用于一键补充手机号，完成统一登录。',
    panelTitle: '这一步会做什么',
    panelDesc: '星球、资料页和商城都共用同一个账号体系，登录完成后会自动回到你刚才的页面。',
    footerTitle: '登录后可以继续什么',
    footerDesc: '继续创建星球、查看我的资料、进入商城和使用后续需要登录的功能。',
    successText: '登录成功',
    benefits: [
      '先用微信身份建立登录态',
      '点击按钮后一键授权手机号',
      '登录成功后回到刚才的页面',
    ],
  },

  onLoad(options: Record<string, string>) {
    const navOffset = (() => {
      try {
        const systemInfo = wx.getSystemInfoSync()
        const statusBarHeight = systemInfo.statusBarHeight || 28
        const navBarHeight = systemInfo.platform === 'android' || systemInfo.platform === 'devtools' ? 48 : 44
        return statusBarHeight + navBarHeight
      } catch {
        return 72
      }
    })()
    const redirectUrl = resolveRedirectUrl(options.redirect)
    const sceneConfig = buildLoginSceneConfig(redirectUrl)

    this.setData({
      navOffset,
      redirectUrl,
      ...sceneConfig,
    })
  },

  onUnload() {
    clearPendingLoginRedirect()
  },

  onToggleAgree() {
    this.setData({
      agreeProtocol: !this.data.agreeProtocol,
    })
  },

  ensureAgreementAccepted() {
    if (this.data.agreeProtocol) {
      return true
    }

    wx.showToast({
      title: '请先同意协议',
      icon: 'none',
    })
    return false
  },

  navigateAfterLogin() {
    const redirectUrl = this.data.redirectUrl || DEFAULT_REDIRECT_URL
    const redirectPath = redirectUrl.split('?')[0]
    clearPendingLoginRedirect()

    if (TAB_PAGE_PATHS.indexOf(redirectPath) >= 0) {
      wx.switchTab({
        url: redirectPath,
      })
      return
    }

    wx.redirectTo({
      url: redirectUrl,
    })
  },

  async onSubmit() {
    if (!this.ensureAgreementAccepted()) {
      return
    }

    this.setData({ loading: true })
    wx.showLoading({
      title: '登录中',
      mask: true,
    })

    try {
      await ensureWechatSession(true)
      wx.hideLoading()
      wx.showToast({
        title: this.data.successText,
        icon: 'success',
      })

      setTimeout(() => {
        this.navigateAfterLogin()
      }, 300)
    } catch (error) {
      console.error('[auth] login failed', error)
      wx.hideLoading()
      wx.showToast({
        title: error instanceof Error ? error.message : '微信登录失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onGetPhoneNumber(e: WechatMiniprogram.CustomEvent) {
    if (!this.ensureAgreementAccepted()) {
      return
    }

    const detail = e.detail as { code?: string; errMsg?: string }
    const phoneCode = detail && detail.code ? String(detail.code) : ''
    const errMsg = detail && detail.errMsg ? String(detail.errMsg) : ''

    if (!phoneCode) {
      wx.showToast({
        title: errMsg && errMsg.indexOf('fail') >= 0 ? '你已取消手机号授权' : '手机号授权失败',
        icon: 'none',
      })
      return
    }

    this.setData({ loading: true })
    wx.showLoading({
      title: '登录中',
      mask: true,
    })

    try {
      await loginWithPhoneCode(phoneCode)
      wx.hideLoading()
      wx.showToast({
        title: this.data.successText,
        icon: 'success',
      })

      setTimeout(() => {
        this.navigateAfterLogin()
      }, 300)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error instanceof Error ? error.message : '手机号登录失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },
})
