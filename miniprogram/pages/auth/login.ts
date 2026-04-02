import { ensureWechatSession, loginWithPhoneCode } from '../../utils/wechat-login'

Page({
  data: {
    agreeProtocol: true,
    loading: false,
    redirectUrl: '/pages/planet/mine',
  },

  onLoad(options: Record<string, string>) {
    this.setData({
      redirectUrl: options.redirect ? decodeURIComponent(options.redirect) : '/pages/planet/mine',
    })
  },

  onToggleAgree() {
    this.setData({
      agreeProtocol: !this.data.agreeProtocol,
    })
  },

  async onSubmit() {
    const { agreeProtocol } = this.data

    if (!agreeProtocol) {
      wx.showToast({
        title: '请先同意协议',
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
      await ensureWechatSession(true)
      wx.hideLoading()
      wx.showToast({
        title: '登录成功',
        icon: 'success',
      })

      setTimeout(() => {
        const redirectUrl = this.data.redirectUrl || '/pages/planet/mine'

        if (redirectUrl === '/pages/profile/index') {
          wx.switchTab({
            url: redirectUrl,
          })
          return
        }

        wx.redirectTo({
          url: redirectUrl,
        })
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
        title: '手机号登录成功',
        icon: 'success',
      })

      setTimeout(() => {
        const redirectUrl = this.data.redirectUrl || '/pages/planet/mine'

        if (redirectUrl === '/pages/profile/index') {
          wx.switchTab({
            url: redirectUrl,
          })
          return
        }

        wx.redirectTo({
          url: redirectUrl,
        })
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
