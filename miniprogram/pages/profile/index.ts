import { clearSession, getStoredSession, type UserSession } from '../../utils/auth'
import { fetchSessionProfile, logoutSession } from '../../utils/auth-api'

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
    nickname: '立即登录',
    mobile: '登录后查看你的会员与星球权益',
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
    }
  },

  async refreshSession(sessionToken: string) {
    try {
      const response = await fetchSessionProfile(sessionToken)
      const session = response.data
      wx.setStorageSync('xueyin_user_session', session)

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
      nickname: session ? session.nickname : '立即登录',
      mobile: session ? session.mobile : '登录后查看你的会员与星球权益',
      avatarUrl:
        session && session.avatarUrl
          ? session.avatarUrl
          : 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=240&q=80',
    })
  },

  onLoginTap() {
    if (this.data.isLoggedIn) {
      return
    }

    wx.navigateTo({
      url: '/pages/auth/login',
    })
  },

  async onLogout() {
    const session = getStoredSession()

    if (session && session.sessionToken) {
      try {
        await logoutSession(session.sessionToken)
      } catch {
        // 退出失败时仍然清本地，避免卡死
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
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/auth/login',
      })
      return
    }

    const id = e.currentTarget.dataset.id

    if (id === 'balance') {
      wx.navigateTo({
        url: '/pages/planet/beans',
      })
      return
    }

    if (id === 'about') {
      wx.navigateTo({
        url: '/pages/planet/index',
      })
    }
  },
})
