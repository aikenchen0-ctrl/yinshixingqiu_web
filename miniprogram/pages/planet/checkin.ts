import { getStoredSession } from '../../utils/auth'
import { getCheckinChallengeList } from '../../utils/checkin'
import { fetchCheckinChallenges } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

type CheckinTabKey = 'ongoing' | 'ended' | 'closed'

Page({
  data: {
    groupId: '',
    pageTitle: '全部打卡挑战',
    canCreateChallenge: false,
    activeTab: 'ongoing' as CheckinTabKey,
    tabs: [
      { key: 'ongoing', label: '进行中' },
      { key: 'ended', label: '已结束' },
      { key: 'closed', label: '已关闭' },
    ],
    items: [] as Record<string, any>[],
    loading: false,
  },

  onLoad(options: Record<string, string>) {
    const groupId = resolvePlanetIdFromOptions(options, ['groupId', 'planetId'])
    if (!groupId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    this.setData({
      groupId,
    }, () => {
      void this.refreshList()
    })
  },

  onShow() {
    this.refreshList()
  },

  async refreshList(activeTab?: CheckinTabKey) {
    const nextActiveTab = activeTab || this.data.activeTab
    const session = getStoredSession()
    this.setData({
      loading: true,
    })

    try {
      if (!this.data.groupId) {
        throw new Error('缺少星球ID，暂时无法读取打卡挑战')
      }

      const response = await fetchCheckinChallenges({
        groupId: this.data.groupId,
        status: nextActiveTab,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response || !response.ok || !response.data) {
        throw new Error('读取打卡挑战失败')
      }

      this.setData({
        canCreateChallenge: Boolean(response.data.canCreateChallenge),
        items: Array.isArray(response.data.items) ? response.data.items : [],
        loading: false,
      })
    } catch {
      this.setData({
        canCreateChallenge: Boolean(session && session.id),
        items: getCheckinChallengeList({
          status: nextActiveTab,
          groupId: this.data.groupId,
        }),
        loading: false,
      })
    }
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const nextTab = String(e.currentTarget.dataset.key || 'ongoing') as CheckinTabKey
    if (nextTab === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: nextTab,
    })
    this.refreshList(nextTab)
  },

  onChallengeTap(e: WechatMiniprogram.TouchEvent) {
    const challengeId = String(e.currentTarget.dataset.id || '')
    if (!challengeId) {
      return
    }

    wx.navigateTo({
      url: `/pages/planet/checkin-detail?id=${challengeId}&groupId=${this.data.groupId}`,
    })
  },

  onCreateChallenge() {
    if (!this.data.canCreateChallenge) {
      wx.showToast({
        title: '只有星主或管理员可以创建挑战',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet/checkin-create?groupId=${this.data.groupId}`,
    })
  },
})
