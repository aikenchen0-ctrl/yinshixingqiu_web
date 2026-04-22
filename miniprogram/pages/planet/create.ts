import { upsertRemotePlanets } from '../../utils/planet'
import { clearSession, getStoredSession, shouldClearSessionByError } from '../../utils/auth'
import { createPlanet as createPlanetRequest } from '../../utils/planet-api'
import { ensureWechatSession } from '../../utils/wechat-login'

interface JoinTypeOption {
  key: 'rolling' | 'calendar'
  title: string
  desc: string
  checked: boolean
}

Page({
  data: {
    currentStep: 1,
    totalStep: 2,
    planetName: '',
    priceValue: '',
    lastPaidPriceValue: '',
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
    const session = getStoredSession()
    if (!session || !session.sessionToken) {
      try {
        await ensureWechatSession()
      } catch {
        // 进入页面时不阻断，提交时再提示明确错误
      }
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
    if (priceValue && priceValue !== '0') {
      this.setData({
        priceValue,
        lastPaidPriceValue: priceValue,
      })
      return
    }

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
    const currentPriceValue = `${this.data.priceValue || ''}`.trim()
    if (currentPriceValue && currentPriceValue !== '0') {
      this.setData({
        priceValue: '0',
        lastPaidPriceValue: currentPriceValue,
      })
      return
    }

    this.setData({
      priceValue: '0',
    })
  },

  goPaidMode() {
    this.setData({
      priceValue: this.data.lastPaidPriceValue || '',
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

  async onSubmit() {
    const planetName = this.data.planetName.trim()
    const priceText = `${this.data.priceValue || ''}`.trim()
    const price = Number(priceText || '0')
    const selectedJoinType = this.data.joinTypes.find((item) => item.checked)
    const joinType = selectedJoinType ? selectedJoinType.key : 'rolling'
    const effectiveJoinType = price === 0 ? 'rolling' : joinType

    if (!planetName) {
      wx.showToast({
        title: '请输入星球名称',
        icon: 'none',
      })
      return
    }

    if (!priceText) {
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

    this.setData({ submitting: true })

    wx.showLoading({ title: '创建中...' })

    try {
      let session = getStoredSession()
      if (!session || !session.sessionToken) {
        session = await ensureWechatSession()
      }

      let res: Awaited<ReturnType<typeof createPlanetRequest>>

      try {
        res = await createPlanetRequest({
          name: planetName,
          price,
          joinType: effectiveJoinType,
          sessionToken: session.sessionToken,
        })
      } catch (error) {
        if (!shouldClearSessionByError(error)) {
          throw error
        }

        clearSession()
        const app = getApp<IAppOption>()
        app.globalData.userSession = null

        session = await ensureWechatSession(true)
        res = await createPlanetRequest({
          name: planetName,
          price,
          joinType: effectiveJoinType,
          sessionToken: session.sessionToken,
        })
      }

      if (!res.ok || !res.data) {
        throw new Error(res.message || '创建失败，未写入服务器')
      }

      upsertRemotePlanets([
        {
          ...res.data,
          joined: true,
        },
      ])

      const targetPlanetId = res.data.id
      const targetPlanetName = res.data.name
      const creatorName = String(res.data.ownerName || '')

      wx.hideLoading()

      wx.showToast({
        title: '创建成功',
        icon: 'success',
      })
      this.setData({
        submitting: false,
      })
      setTimeout(() => {
        if (!targetPlanetId) {
          return
        }

        wx.redirectTo({
          url: `/pages/planet/home?id=${targetPlanetId}&name=${encodeURIComponent(targetPlanetName)}&creator=${encodeURIComponent(creatorName)}`,
        })
      }, 800)
    } catch (err) {
      console.error('[planet/create] create failed', err)
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({
        title: err instanceof Error ? err.message : '创建失败，未写入服务器',
        icon: 'none',
      })
    }
  },
})
