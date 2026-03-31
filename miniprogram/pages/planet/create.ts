import { createPlanet } from '../../utils/planet'

interface JoinTypeOption {
  key: 'rolling' | 'calendar'
  title: string
  desc: string
  checked: boolean
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

    const planet = createPlanet({
      name: planetName,
      price,
      joinType,
    })

    wx.redirectTo({
      url: `/pages/planet/home?id=${planet.id}&name=${encodeURIComponent(planet.name)}&creator=${encodeURIComponent(planet.ownerName)}`,
    })
  },
})
