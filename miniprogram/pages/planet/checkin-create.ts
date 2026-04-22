import { getStoredSession } from '../../utils/auth'
import { createLocalCheckinChallenge } from '../../utils/checkin'
import { createPlanetCheckinChallenge } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

type HeroColor = 'teal' | 'mint'
const MAX_DAY_COUNT = 365

Page({
  data: {
    groupId: '',
    title: '',
    description: '',
    dayCount: '21',
    heroColor: 'teal' as HeroColor,
    submitting: false,
    colorOptions: [
      { key: 'teal', label: '青绿' },
      { key: 'mint', label: '薄荷' },
    ],
  },

  onLoad(options: Record<string, string | undefined>) {
    const groupId = resolvePlanetIdFromOptions(options, ['groupId', 'planetId'])
    if (!groupId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    this.setData({
      groupId,
    })
  },

  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      title: String(e.detail.value || '').slice(0, 30),
    })
  },

  onDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({
      description: String(e.detail.value || '').slice(0, 300),
    })
  },

  onDayCountInput(e: WechatMiniprogram.Input) {
    const nextValue = String(e.detail.value || '').replace(/[^\d]/g, '').slice(0, 3)
    this.setData({
      dayCount: nextValue,
    })
  },

  onColorTap(e: WechatMiniprogram.TouchEvent) {
    const heroColor = String(e.currentTarget.dataset.key || 'teal') as HeroColor
    this.setData({
      heroColor: heroColor === 'mint' ? 'mint' : 'teal',
    })
  },

  async onSubmit() {
    if (this.data.submitting) {
      return
    }

    const title = this.data.title.trim()
    const description = this.data.description.trim()
    const dayCount = Number(this.data.dayCount || 0)

    if (!this.data.groupId) {
      wx.showToast({
        title: '缺少星球信息，请返回重试',
        icon: 'none',
      })
      return
    }

    if (!title) {
      wx.showToast({
        title: '请先填写挑战标题',
        icon: 'none',
      })
      return
    }

    if (!description) {
      wx.showToast({
        title: '请先填写挑战说明',
        icon: 'none',
      })
      return
    }

    if (!dayCount || dayCount < 1 || dayCount > MAX_DAY_COUNT) {
      wx.showToast({
        title: '打卡天数需在1到365之间',
        icon: 'none',
      })
      return
    }

    const session = getStoredSession()

    this.setData({
      submitting: true,
    })

    try {
      wx.showLoading({
        title: '创建中',
        mask: true,
      })

      let targetId = ''
      let targetGroupId = this.data.groupId

      try {
        if (!session || !session.id || !session.sessionToken) {
          throw new Error('使用本地挑战创建')
        }

        const response = await createPlanetCheckinChallenge({
          groupId: this.data.groupId,
          title,
          description,
          dayCount,
          heroColor: this.data.heroColor,
          sessionToken: session.sessionToken,
          userId: session.id,
        })

        if (!response || !response.ok || !response.data) {
          throw new Error('创建打卡挑战失败')
        }

        targetId = response.data.id
        targetGroupId = response.data.groupId
      } catch {
        const localChallenge = createLocalCheckinChallenge({
          groupId: this.data.groupId,
          title,
          description,
          dayCount,
          heroColor: this.data.heroColor,
          creatorAvatarUrl: session && session.avatarUrl ? session.avatarUrl : '',
        })

        targetId = localChallenge.id
        targetGroupId = localChallenge.groupId || this.data.groupId
      }

      wx.hideLoading()

      wx.showToast({
        title: '挑战已创建',
        icon: 'success',
      })

      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/planet/checkin-detail?id=${targetId}&groupId=${targetGroupId}`,
        })
      }, 240)
    } catch (error) {
      wx.hideLoading()

      wx.showToast({
        title: error instanceof Error ? error.message : '创建打卡挑战失败',
        icon: 'none',
      })
    } finally {
      this.setData({
        submitting: false,
      })
    }
  },
})
