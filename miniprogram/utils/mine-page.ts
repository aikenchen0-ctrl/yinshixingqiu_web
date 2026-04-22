import {
  clearSession,
  getStoredSession,
  saveSession,
  shouldClearSessionByError,
  type UserSession,
} from './auth'
import { fetchSessionProfile, logoutSession, updateSessionProfile } from './auth-api'
import { uploadPlanetImage } from './planet-api'
import { normalizeAssetUrl } from './request'
import { ensureWechatSession, loginWithPhoneCode } from './wechat-login'

interface ProfileMenuItem {
  id: string
  title: string
  value: string
  iconType: 'wallet' | 'planet'
  actionText: string
}

interface ProfilePanelState {
  panelCompact: boolean
  panelTitle: string
  panelDesc: string
  panelButtonText: string
  panelButtonOpenType: string
  panelButtonGhost: boolean
  showTipCard: boolean
}

interface RegisterMinePageOptions {
  showTipCard?: boolean
  tipTitle?: string
  tipDesc?: string
  showPlanetBottomNav?: boolean
  menuMode?: 'profile' | 'planet'
}

type MineMenuMode = 'profile' | 'planet'

interface MinePageCopyConfig {
  guestSubtitle: string
  guestPanelTitle: string
  guestPanelDesc: string
  autologinFallbackSubtitle: string
  loggedInPanelDesc: string
}

function buildMinePageCopy(menuMode: MineMenuMode): MinePageCopyConfig {
  if (menuMode === 'planet') {
    return {
      guestSubtitle: '进入饮视星球后会自动登录，无需填写手机号',
      guestPanelTitle: '先连接微信身份',
      guestPanelDesc: '进入饮视星球会先自动登录，失败时可点击按钮手动重试。',
      autologinFallbackSubtitle: '自动登录未完成，可点击下方按钮重试',
      loggedInPanelDesc: '现在可以继续创建星球、查看余额和使用你的饮视星球功能。',
    }
  }

  return {
    guestSubtitle: '登录后可管理账号资料和星球相关权益',
    guestPanelTitle: '先连接微信身份',
    guestPanelDesc: '登录后可继续使用你的饮视星球功能。',
    autologinFallbackSubtitle: '自动登录未完成，可点击下方按钮重试',
    loggedInPanelDesc: '现在可以继续创建星球和使用你的饮视星球功能。',
  }
}

const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
  {
    id: 'about',
    title: '关于饮视星球',
    value: '',
    iconType: 'planet',
    actionText: '',
  },
]

const PLANET_MENU_ITEMS: ProfileMenuItem[] = [
  {
    id: 'balance',
    title: '星球豆余额',
    value: '0',
    iconType: 'wallet',
    actionText: '明细',
  },
  {
    id: 'refundApproval',
    title: '退款审批',
    value: '',
    iconType: 'planet',
    actionText: '查看',
  },
  {
    id: 'about',
    title: '关于饮视星球',
    value: '',
    iconType: 'planet',
    actionText: '',
  },
]

function cloneMenuItems(menuMode: MineMenuMode) {
  const source = menuMode === 'planet' ? PLANET_MENU_ITEMS : PROFILE_MENU_ITEMS
  return source.map((item) => ({ ...item }))
}

export function registerMinePage(options: RegisterMinePageOptions = {}) {
  const showTipCard = options.showTipCard === true
  const tipTitle = String(options.tipTitle || '')
  const tipDesc = String(options.tipDesc || '')
  const showPlanetBottomNav = options.showPlanetBottomNav === true
  const menuMode: MineMenuMode = options.menuMode === 'planet' ? 'planet' : 'profile'
  const copy = buildMinePageCopy(menuMode)
  const pageBottomPadding = showPlanetBottomNav ? 'calc(120rpx + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)'

  Page({
    data: {
      statusBarHeight: 28,
      isLoggedIn: false,
      loginLoading: false,
      avatarUpdating: false,
      mobile: '',
      nickname: '微信用户',
      subtitle: copy.guestSubtitle,
      avatarUrl: '',
      panelCompact: false,
      panelTitle: copy.guestPanelTitle,
      panelDesc: copy.guestPanelDesc,
      panelButtonText: '微信快速登录',
      panelButtonOpenType: '',
      panelButtonGhost: false,
      showTipCard,
      tipTitle,
      tipDesc,
      showPlanetBottomNav,
      pageBottomPadding,
      menuItems: cloneMenuItems(menuMode),
    },

    onLoad() {
      const statusBarHeight = (() => {
        try {
          return wx.getSystemInfoSync().statusBarHeight || 28
        } catch {
          return 28
        }
      })()

      this.setData({
        statusBarHeight,
      })
    },

    onShow() {
      const session = getStoredSession()
      this.applySession(session)

      if (session && session.sessionToken) {
        void this.refreshSession(session.sessionToken)
        return
      }

      void this.ensureSessionSilently()
    },

    async refreshSession(sessionToken: string) {
      try {
        const response = await fetchSessionProfile(sessionToken)
        const session = response.data
        saveSession(session)

        const app = getApp<IAppOption>()
        app.globalData.userSession = session

        this.applySession(session)
      } catch (error) {
        if (!shouldClearSessionByError(error)) {
          return
        }

        clearSession()

        const app = getApp<IAppOption>()
        app.globalData.userSession = null

        this.applySession(null)
      }
    },

    buildPanelState(session: UserSession | null): ProfilePanelState {
      if (!session) {
        return {
          panelCompact: false,
          panelTitle: copy.guestPanelTitle,
          panelDesc: copy.guestPanelDesc,
          panelButtonText: '微信快速登录',
          panelButtonOpenType: '',
          panelButtonGhost: false,
          showTipCard,
        }
      }

      if (!session.mobile) {
        return {
          panelCompact: true,
          panelTitle: '补充手机号完成一键登录',
          panelDesc: '手机号将用于关键操作校验，点一次即可完成，不需要手动输入。',
          panelButtonText: '手机号一键登录',
          panelButtonOpenType: 'getPhoneNumber',
          panelButtonGhost: false,
          showTipCard: false,
        }
      }

      return {
        panelCompact: true,
        panelTitle: '已连接微信账号',
        panelDesc: copy.loggedInPanelDesc,
        panelButtonText: '退出登录',
        panelButtonOpenType: '',
        panelButtonGhost: true,
        showTipCard: false,
      }
    },

    applySession(session: UserSession | null) {
      this.setData({
        isLoggedIn: Boolean(session),
        loginLoading: false,
        avatarUpdating: false,
        mobile: session ? session.mobile : '',
        nickname: session ? session.nickname : '微信用户',
        subtitle: session
          ? session.mobile
            ? `已绑定手机号 ${session.mobile}`
            : '微信身份已接入，补充手机号后可继续关键操作'
          : copy.guestSubtitle,
        avatarUrl: session && session.avatarUrl ? normalizeAssetUrl(session.avatarUrl) : '',
        ...this.buildPanelState(session),
      })
    },

    onHeroTap() {
      if (!this.data.isLoggedIn) {
        this.onLoginTap()
        return
      }

      void this.onEditAvatarTap()
    },

    onAvatarError() {
      const session = getStoredSession()
      if (session && session.avatarUrl) {
        const nextSession = {
          ...session,
          avatarUrl: '',
        }
        saveSession(nextSession)
        const app = getApp<IAppOption>()
        app.globalData.userSession = nextSession
      }

      this.setData({
        avatarUrl: '',
      })
    },

    async onEditAvatarTap() {
      if (!this.data.isLoggedIn || this.data.avatarUpdating) {
        return
      }

      const session = getStoredSession()
      if (!session || !session.sessionToken) {
        this.onLoginTap()
        return
      }

      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          if (!file || !file.tempFilePath) {
            return
          }

          this.setData({
            avatarUpdating: true,
          })

          wx.showLoading({
            title: '上传头像中',
            mask: true,
          })

          try {
            const uploadResult = await uploadPlanetImage(file.tempFilePath, session.sessionToken)
            const avatarUrl = normalizeAssetUrl(uploadResult.data.url)
            const response = await updateSessionProfile({
              sessionToken: session.sessionToken,
              avatarUrl,
            })
            const nextSession = response.data

            saveSession(nextSession)
            const app = getApp<IAppOption>()
            app.globalData.userSession = nextSession

            wx.hideLoading()
            this.applySession(nextSession)
            wx.showToast({
              title: '头像已更新',
              icon: 'success',
            })
          } catch (error) {
            wx.hideLoading()
            this.setData({
              avatarUpdating: false,
            })
            wx.showToast({
              title: error instanceof Error ? error.message : '头像更新失败',
              icon: 'none',
            })
          }
        },
      })
    },

    async ensureSessionSilently() {
      if (this.data.loginLoading || this.data.isLoggedIn) {
        return
      }

      this.setData({
        loginLoading: true,
        subtitle: '正在连接微信身份...',
      })

      try {
        const session = await ensureWechatSession()
        this.applySession(session)
      } catch {
        this.setData({
          loginLoading: false,
          subtitle: copy.autologinFallbackSubtitle,
        })
      }
    },

    onLoginTap() {
      if (this.data.isLoggedIn && this.data.mobile) {
        return
      }

      if (this.data.loginLoading) {
        return
      }

      void this.handleWechatLogin()
    },

    onPanelAction() {
      if (!this.data.isLoggedIn) {
        this.onLoginTap()
        return
      }

      void this.onLogoutTap()
    },

    async handleWechatLogin() {
      this.setData({
        loginLoading: true,
      })
      wx.showLoading({
        title: '登录中',
        mask: true,
      })

      try {
        const session = await ensureWechatSession(true)
        this.applySession(session)
        wx.hideLoading()

        wx.showToast({
          title: '登录成功',
          icon: 'success',
        })
      } catch (error) {
        wx.hideLoading()
        this.setData({
          loginLoading: false,
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '微信登录失败',
          icon: 'none',
        })
      }
    },

    async onGetPhoneNumber(e: WechatMiniprogram.CustomEvent) {
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

      this.setData({
        loginLoading: true,
      })

      wx.showLoading({
        title: '绑定中',
        mask: true,
      })

      try {
        const session = await loginWithPhoneCode(phoneCode)
        this.applySession(session)
        wx.hideLoading()
        wx.showToast({
          title: '手机号登录成功',
          icon: 'success',
        })
      } catch (error) {
        wx.hideLoading()
        this.setData({
          loginLoading: false,
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '手机号登录失败',
          icon: 'none',
        })
      }
    },

    async onLogoutTap() {
      const session = getStoredSession()

      if (session && session.sessionToken) {
        try {
          await logoutSession(session.sessionToken)
        } catch {
          // ignore remote logout errors and still clear local session
        }
      }

      clearSession()

      const app = getApp<IAppOption>()
      app.globalData.userSession = null

      this.applySession(null)

      wx.showToast({
        title: '已退出登录',
        icon: 'success',
      })
    },

    onMenuTap(e: WechatMiniprogram.CustomEvent<{ id?: string }>) {
      const id = String((e.detail && e.detail.id) || '')

      if (id === 'refundApproval') {
        wx.navigateTo({
          url: '/pages/planet/refunds',
        })
        return
      }

      if (id === 'about') {
        wx.showToast({
          title: '饮视星球是一款内容社群产品',
          icon: 'none',
        })
        return
      }

      if (id === 'balance') {
        wx.navigateTo({
          url: '/pages/planet/beans',
        })
      }
    },

    onPlanetTabChange(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
      const key = String((e.detail && e.detail.key) || '')

      if (!key || key === 'mine') {
        return
      }

      if (key === 'planet') {
        wx.redirectTo({
          url: '/pages/planet/index',
        })
        return
      }

      if (key === 'discover') {
        wx.redirectTo({
          url: '/pages/planet/lobby',
        })
        return
      }

      if (key === 'debug') {
        wx.redirectTo({
          url: '/pages/planet/debug',
        })
      }
    },
  })
}
