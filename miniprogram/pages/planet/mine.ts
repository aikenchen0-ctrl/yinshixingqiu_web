import { clearSession, getStoredSession, saveSession, type UserSession } from '../../utils/auth'
import { fetchSessionProfile, logoutSession } from '../../utils/auth-api'
import { ensureWechatSession, loginWithPhoneCode } from '../../utils/wechat-login'

interface ProfileMenuItem {
  id: string
  title: string
  value: string
  iconType: 'wallet' | 'planet'
  actionText: string
}

Page({
  data: {
    isLoggedIn: false,
    loginLoading: false,
    mobile: '',
    nickname: '微信用户',
    subtitle: '进入知识星球后会自动登录，无需填写手机号',
    avatarUrl: 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=240&q=80',
    menuItems: [
      {
        id: 'balance',
        title: '星球豆余额',
        value: '0',
        iconType: 'wallet',
        actionText: '明细',
      },
      {
        id: 'about',
        title: '关于知识星球',
        value: '',
        iconType: 'planet',
        actionText: '',
      },
    ] as ProfileMenuItem[],
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
    } catch {
      clearSession()
      this.applySession(null)
    }
  },

  applySession(session: UserSession | null) {
    this.setData({
      isLoggedIn: Boolean(session),
      loginLoading: false,
      mobile: session ? session.mobile : '',
      nickname: session ? session.nickname : '微信用户',
      subtitle: session
        ? session.mobile
          ? `已绑定手机号 ${session.mobile}`
          : '微信身份已接入，补充手机号后可继续关键操作'
        : '进入知识星球后会自动登录，无需填写手机号',
      avatarUrl:
        session && session.avatarUrl
          ? session.avatarUrl
          : 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=240&q=80',
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
        subtitle: '自动登录未完成，可点击下方按钮重试',
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
        // 退出失败时仍然清理本地，避免页面卡死
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

  onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id

    if (!this.data.isLoggedIn) {
      this.onLoginTap()
      return
    }

    if (id === 'balance') {
      wx.navigateTo({
        url: '/pages/planet/beans',
      })
      return
    }

    if (id === 'about') {
      wx.showToast({
        title: '知识星球是一款内容社群产品',
        icon: 'none',
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
