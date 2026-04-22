import { getStoredSession } from '../../utils/auth'
import { getLocalCheckinRankings } from '../../utils/checkin'
import { fetchCheckinRankings } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

type RankingTabKey = 'streak' | 'total'

Page({
  data: {
    challengeId: '',
    groupId: '',
    challengeTitle: '打卡排行榜',
    activeTab: 'streak' as RankingTabKey,
    streakRanking: [] as Record<string, any>[],
    totalRanking: [] as Record<string, any>[],
    currentRanking: [] as Record<string, any>[],
    viewerSummary: null as Record<string, any> | null,
    viewerStreakItem: null as Record<string, any> | null,
    viewerTotalItem: null as Record<string, any> | null,
    currentViewerItem: null as Record<string, any> | null,
    loading: false,
  },

  onLoad(options: Record<string, string>) {
    const challengeId = options.id || ''
    if (!challengeId) {
      navigateToPlanetIndex('挑战参数缺失')
      return
    }

    this.setData({
      challengeId,
      groupId: resolvePlanetIdFromOptions(options, ['groupId', 'planetId']),
    }, () => {
      void this.refreshData()
    })
  },

  async refreshData() {
    const session = getStoredSession()
    if (!this.data.challengeId) {
      wx.showToast({
        title: '缺少挑战ID',
        icon: 'none',
      })
      return
    }

    this.setData({
      loading: true,
    })

    try {
      const response = await fetchCheckinRankings({
        challengeId: this.data.challengeId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response || !response.ok || !response.data) {
        throw new Error('读取排行榜失败')
      }

      const data = response.data
      const streakRanking = Array.isArray(data.streakRanking) ? data.streakRanking : []
      const totalRanking = Array.isArray(data.totalRanking) ? data.totalRanking : []
      const currentRanking = this.data.activeTab === 'total' ? totalRanking : streakRanking
      const viewerStreakItem = streakRanking.find((item) => item.isViewer) || null
      const viewerTotalItem = totalRanking.find((item) => item.isViewer) || null

      this.setData({
        challengeTitle: data.challengeTitle || '打卡排行榜',
        streakRanking,
        totalRanking,
        currentRanking,
        viewerSummary: data.viewerSummary || null,
        viewerStreakItem,
        viewerTotalItem,
        currentViewerItem: this.data.activeTab === 'total' ? viewerTotalItem : viewerStreakItem,
        loading: false,
      })
    } catch {
      const localRanking = getLocalCheckinRankings(
        this.data.challengeId,
        session && session.id ? session.id : ''
      )

      if (localRanking) {
        const currentRanking = this.data.activeTab === 'total' ? localRanking.totalRanking : localRanking.streakRanking
        const viewerStreakItem = localRanking.streakRanking.find((item) => item.isViewer) || null
        const viewerTotalItem = localRanking.totalRanking.find((item) => item.isViewer) || null

        this.setData({
          challengeTitle: localRanking.challengeTitle,
          streakRanking: localRanking.streakRanking,
          totalRanking: localRanking.totalRanking,
          currentRanking,
          viewerSummary: localRanking.viewerSummary,
          viewerStreakItem,
          viewerTotalItem,
          currentViewerItem: this.data.activeTab === 'total' ? viewerTotalItem : viewerStreakItem,
          loading: false,
        })
        return
      }

      this.setData({
        loading: false,
      })
    }
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const key = String(e.currentTarget.dataset.key || 'streak') as RankingTabKey
    if (key === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: key,
      currentRanking: key === 'streak' ? this.data.streakRanking : this.data.totalRanking,
      currentViewerItem: key === 'streak' ? this.data.viewerStreakItem : this.data.viewerTotalItem,
    })
  },
})
