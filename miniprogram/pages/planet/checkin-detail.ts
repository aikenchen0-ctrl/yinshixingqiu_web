import { getStoredSession } from '../../utils/auth'
import { getCheckinChallengeDetail, joinCheckinChallenge } from '../../utils/checkin'
import { fetchCheckinChallengeDetail, joinPlanetCheckinChallenge } from '../../utils/planet-api'
import { navigateToPlanetIndex, rememberActivePlanetId, resolvePlanetIdFromOptions } from '../../utils/planet-route'

Page({
  data: {
    challengeId: '',
    groupId: '',
    challenge: null as Record<string, any> | null,
    showSignupSheet: false,
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
      void this.refreshDetail()
    })
  },

  onShow() {
    if (!this.data.challengeId) {
      return
    }
    void this.refreshDetail()
  },

  async refreshDetail() {
    const session = getStoredSession()
    this.setData({
      loading: true,
    })

    try {
      const response = await fetchCheckinChallengeDetail({
        challengeId: this.data.challengeId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response || !response.ok || !response.data) {
        throw new Error('读取挑战详情失败')
      }

      const challenge = response.data
      const groupId = challenge.groupId ? rememberActivePlanetId(challenge.groupId) : this.data.groupId
      this.setData({
        challenge,
        groupId,
        loading: false,
      })
    } catch {
      const localChallenge = getCheckinChallengeDetail(this.data.challengeId, this.data.groupId)
      if (localChallenge) {
        const groupId = localChallenge.groupId ? rememberActivePlanetId(localChallenge.groupId) : this.data.groupId
        this.setData({
          challenge: localChallenge,
          groupId,
          loading: false,
        })
        return
      }

      this.setData({
        challenge: null,
        loading: false,
      })

      wx.showToast({
        title: '读取挑战详情失败',
        icon: 'none',
      })
    }
  },

  onOpenSignupSheet() {
    this.setData({
      showSignupSheet: true,
    })
  },

  noop() {},

  onCloseSignupSheet() {
    this.setData({
      showSignupSheet: false,
    })
  },

  async onConfirmSignup() {
    if (!this.data.challengeId) {
      return
    }

    const session = getStoredSession()

    try {
      if (!session || !session.id || !session.sessionToken) {
        throw new Error('使用本地打卡报名')
      }

      const response = await joinPlanetCheckinChallenge({
        challengeId: this.data.challengeId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response || !response.ok || !response.data) {
        throw new Error('报名失败')
      }

      this.setData({
        showSignupSheet: false,
        challenge: response.data,
      })

      wx.showToast({
        title: '报名成功',
        icon: 'success',
      })
    } catch {
      joinCheckinChallenge(this.data.challengeId)
      const localChallenge = getCheckinChallengeDetail(this.data.challengeId, this.data.groupId)
      if (localChallenge) {
        this.setData({
          showSignupSheet: false,
          challenge: localChallenge,
        })

        wx.showToast({
          title: '报名成功',
          icon: 'success',
        })
        return
      }

      wx.showToast({
        title: '报名失败',
        icon: 'none',
      })
    }
  },

  onPrimaryActionTap() {
    const challenge = this.data.challenge
    if (!challenge) {
      return
    }

    if (challenge.primaryActionDisabled) {
      wx.showToast({
        title: challenge.status === 'closed' ? '当前挑战已关闭，不能继续参加' : '当前挑战已结束，不能继续参加',
        icon: 'none',
      })
      return
    }

    if (challenge.status !== 'ongoing') {
      wx.showToast({
        title: '当前挑战不可打卡',
        icon: 'none',
      })
      return
    }

    if (!challenge.isJoined) {
      this.onOpenSignupSheet()
      return
    }

    wx.navigateTo({
      url: `/pages/planet/checkin-compose?id=${challenge.id}&title=${encodeURIComponent(challenge.title)}&groupId=${this.data.groupId}`,
    })
  },

  onPreviewRule() {
    this.onOpenSignupSheet()
  },

  onShareTap() {
    const sharePath = `/pages/planet/checkin-detail?id=${this.data.challengeId}&groupId=${this.data.groupId}`
    wx.setClipboardData({
      data: sharePath,
      success: () => {
        wx.showToast({
          title: '挑战链接已复制',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制挑战链接失败',
          icon: 'none',
        })
      },
    })
  },

  onCalendarTap() {
    wx.navigateTo({
      url: `/pages/planet/checkin-record?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
    })
  },

  onRankTap() {
    wx.navigateTo({
      url: `/pages/planet/checkin-ranking?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
    })
  },

  onTotalTap() {
    wx.navigateTo({
      url: `/pages/planet/checkin-record?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
    })
  },

  onTodayTap() {
    const today = new Date()
    wx.navigateTo({
      url:
        `/pages/planet/checkin-record?id=${this.data.challengeId}` +
        `&groupId=${this.data.groupId}` +
        `&year=${today.getFullYear()}` +
        `&month=${today.getMonth() + 1}` +
        `&day=${today.getDate()}`,
    })
  },

  openPostDetail(postId: string) {
    if (!postId) {
      return
    }

    if (postId.indexOf('local_') === 0) {
      wx.showToast({
        title: '本地打卡已在当前页展示',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet/post?id=${postId}&planetId=${this.data.groupId}`,
    })
  },

  onLikeTap(e: WechatMiniprogram.TouchEvent) {
    const postId = String(e.currentTarget.dataset.id || '')
    this.openPostDetail(postId)
  },

  onCommentTap(e: WechatMiniprogram.TouchEvent) {
    const postId = String(e.currentTarget.dataset.id || '')
    this.openPostDetail(postId)
  },

  onImageTap(e: WechatMiniprogram.TouchEvent) {
    const url = String(e.currentTarget.dataset.url || '')
    if (!url) {
      return
    }

    wx.previewImage({
      urls: [url],
      current: url,
    })
  },

  onShareAppMessage() {
    const challenge = this.data.challenge
    return {
      title: challenge ? challenge.title : '打卡挑战',
      path: `/pages/planet/checkin-detail?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
    }
  },

  onShareTimeline() {
    const challenge = this.data.challenge
    return {
      title: challenge ? challenge.title : '打卡挑战',
      query: `id=${this.data.challengeId}&groupId=${this.data.groupId}`,
    }
  },
})
