import { createPlanet } from '../../utils/planet'
import { request } from '../../utils/request'
import { getStoredSession } from '../../utils/auth'
import { ensureWechatSession } from '../../utils/wechat-login'

interface JoinTypeOption {
  key: 'rolling' | 'calendar'
  title: string
  desc: string
  checked: boolean
}

interface CreateResponse {
  ok: boolean
  message?: string
  data: {
    id: string
    name: string
    ownerName: string
  }
}

Page({
  data: {
    mode: 'paid',
    currentStep: 1,
    totalStep: 2,
    planetName: '',
    priceValue: '50',
    agreementChecked: true,
    joinTypes: [
      {
        key: 'rolling',
        title: '每个成员到期时间不同: 自加入日起 1 年',
        desc: '创建后不可修改',
        checked: true,
      },
      {
        key: 'calendar',
        title: '所有成员到期时间相同: 每年 3月31日',
        desc: '',
        checked: false,
      },
    ] as JoinTypeOption[],
    submitting: false,
  },

  async onLoad() {
    let session = getStoredSession()
    if (!session || !session.sessionToken) {
      try {
        wx.showLoading({
          title: '登录中',
          mask: true,
        })
        await ensureWechatSession()
        wx.hideLoading()
        session = getStoredSession()
      } catch {
        wx.hideLoading()
        wx.showModal({
          title: '提示',
          content: '创建星球需要先登录，是否前往登录？',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/planet/mine',
              })
            } else {
              wx.navigateBack()
            }
          },
        })
        return
      }
    }

    if (!session || !session.mobile) {
      wx.showModal({
        title: '提示',
        content: '创建星球前需要先完成手机号一键登录，是否前往我的页完成？',
        confirmText: '去完成',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/planet/mine',
            })
          } else {
            wx.navigateBack()
          }
        },
      })
    }
  },

  onNameInput(e: WechatMiniprogram.Input) {
    const planetName = e.detail.value.slice(0, 15)
    this.setData({
      planetName,
    })
  },

  onPriceInput(e: WechatMiniprogram.Input) {
    const priceValue = `${e.detail.value}`.replace(/[^\d]/g, '').slice(0, 4)
    this.setData({
      priceValue,
    })
  },

  goNextStep() {
    if (!this.data.planetName.trim()) {
      wx.showToast({
        title: '请输入星球名称',
        icon: 'none',
      })
      return
    }

    this.setData({
      currentStep: 2,
    })
  },

  goFreeMode() {
    this.setData({
      mode: 'free',
    })
  },

  goPaidMode() {
    this.setData({
      mode: 'paid',
      currentStep: 1,
    })
  },

  onSelectJoinType(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as JoinTypeOption['key']
    if (!key) return

    const joinTypes = this.data.joinTypes.map((item) => ({
      ...item,
      checked: item.key === key,
    }))

    this.setData({
      joinTypes,
    })
  },

  onToggleAgreement() {
    this.setData({
      agreementChecked: !this.data.agreementChecked,
    })
  },

  onSubmit() {
    const planetName = this.data.planetName.trim()
    const price = Number(this.data.priceValue || '0')
    const selectedJoinType = this.data.joinTypes.find((item) => item.checked)
    const joinType = selectedJoinType ? selectedJoinType.key : 'rolling'

    if (!planetName) {
      wx.showToast({
        title: '请输入星球名称',
        icon: 'none',
      })
      return
    }

    if (!price) {
      wx.showToast({
        title: '请输入加入价格',
        icon: 'none',
      })
      return
    }

    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先阅读并同意规则',
        icon: 'none',
      })
      return
    }

    const session = getStoredSession()
    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      wx.redirectTo({
        url: '/pages/planet/mine',
      })
      return
    }

    if (!session.mobile) {
      wx.showToast({
        title: '请先完成手机号一键登录',
        icon: 'none',
      })
      wx.redirectTo({
        url: '/pages/planet/mine',
      })
      return
    }

    this.setData({ submitting: true })

    wx.showLoading({ title: '创建中...' })

    request<CreateResponse>({
      url: '/api/planets/create',
      method: 'POST',
      sessionToken: session.sessionToken,
      data: {
        name: planetName,
        price,
        joinType,
      },
    })
      .then((res) => {
        wx.hideLoading()
        if (res.ok && res.data) {
          createPlanet(
            {
              name: planetName,
              price,
              joinType,
            },
            {
              id: res.data.id,
              ownerName: res.data.ownerName,
            }
          )
          wx.showToast({
            title: '创建成功',
            icon: 'success',
          })
          this.setData({
            submitting: false,
          })
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/planet/home?id=${res.data.id}&name=${encodeURIComponent(res.data.name)}&creator=${encodeURIComponent(res.data.ownerName)}`,
            })
          }, 1500)
        } else {
          this.setData({ submitting: false })
          wx.showToast({
            title: res.message || '创建失败',
            icon: 'none',
          })
        }
      })
      .catch((err: Error) => {
        wx.hideLoading()
        this.setData({ submitting: false })
        wx.showToast({
          title: err.message || '创建失败',
          icon: 'none',
        })
      })
  },
})
