import {
  deletePlanet as deleteLocalPlanet,
  getLocalPlanetSubscriptionEnabled,
  getPlanetById,
  leavePlanet as leaveLocalPlanet,
  updateLocalPlanetProfile,
  updateLocalPlanetSubscription,
  upsertRemotePlanets,
} from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import {
  deletePlanet as deleteRemotePlanet,
  fetchPlanetHome,
  leavePlanetMembership,
  requestPlanetRefundReview,
  updatePlanetProfile,
  updatePlanetSubscription,
  uploadPlanetImage,
} from '../../utils/planet-api'
import { navigateToPlanetIndex, rememberActivePlanetId, resolvePlanetIdFromOptions } from '../../utils/planet-route'
import { normalizeAssetUrl } from '../../utils/request'
import { ensureWechatSession } from '../../utils/wechat-login'

interface ProfileViewState {
  groupId: string
  name: string
  avatarImageUrl: string
  category: string
  intro: string
  ownerName: string
  isFree: boolean
  memberCount: number
  joined: boolean
  joinedAt: string
  isPaid: boolean
}

const defaultProfile: ProfileViewState = {
  groupId: '',
  name: '饮视星球',
  avatarImageUrl: '',
  category: '其他',
  intro: '',
  ownerName: '星主',
  isFree: false,
  memberCount: 0,
  joined: false,
  joinedAt: '',
  isPaid: false,
}

const SELF_REFUND_WINDOW_MS = 72 * 60 * 60 * 1000

const isLocalPlanetId = (groupId: string) => groupId.indexOf('grp_local_') === 0

const canRefundWithinWindow = (joinedAt: string, isPaid: boolean) => {
  if (!isPaid || !joinedAt) {
    return false
  }

  const joinedAtTime = new Date(joinedAt).getTime()
  if (!Number.isFinite(joinedAtTime)) {
    return false
  }

  return Date.now() - joinedAtTime <= SELF_REFUND_WINDOW_MS
}

const isPlanetUnavailableError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = String(error.message || '')
  return message.indexOf('星球已删除') >= 0 || message.indexOf('星球不存在') >= 0
}

const buildCapabilityState = (profile: ProfileViewState, canEdit: boolean) => {
  const canExitPlanet = !canEdit && Boolean(profile.joined)
  const canDeletePlanet = canEdit && (profile.isFree || profile.memberCount <= 1)
  const canRefundOnExit = canExitPlanet && canRefundWithinWindow(profile.joinedAt, profile.isPaid)
  const dangerHint = canEdit
    ? canDeletePlanet
      ? '删除后星球将从前台下线，成员将无法继续访问，操作不可恢复。'
      : '仅免费星球或当前仅剩球主一人时可删除。'
    : canRefundOnExit
      ? '付费加入后 72 小时内可申请退款退出，提交后需要等待星主审批；超时后仅支持直接退出。'
      : profile.isFree
        ? '免费星球支持直接退出，退出后将不再显示在你的已加入列表。'
        : '退出后将不再显示在你的已加入列表，若已超过退款期将不会退款。'

  return {
    canExitPlanet,
    canDeletePlanet,
    canRefundOnExit,
    dangerHint,
  }
}

const buildLocalProfileState = (groupId: string) => {
  const localPlanet = getPlanetById(groupId)
  if (!localPlanet) {
    return null
  }

  return {
    groupId,
    name: localPlanet.name || '饮视星球',
    avatarImageUrl: String(localPlanet.avatarImageUrl || '').trim(),
    category: String(localPlanet.category || '其他').trim() || '其他',
    intro: String(localPlanet.intro || '').trim(),
    ownerName: String(localPlanet.ownerName || '星主'),
    isFree: !!localPlanet.isFree,
    memberCount: Number(localPlanet.memberCount || 0),
    joined: !!localPlanet.joined,
    joinedAt: '',
    isPaid: !localPlanet.isFree,
  } as ProfileViewState
}

const canEditLocalPlanet = (groupId: string) => {
  const localPlanet = getPlanetById(groupId)
  if (!localPlanet) {
    return false
  }

  const session = getStoredSession()
  const currentNickname = session && session.nickname ? session.nickname.trim() : ''
  return localPlanet.id.indexOf('grp_local_') === 0 || Boolean(currentNickname && localPlanet.ownerName === currentNickname)
}

Page({
  data: {
    profile: defaultProfile,
    loading: true,
    subscribeEnabled: false,
    subscribeLoading: false,
    canEdit: false,
    canExitPlanet: false,
    canDeletePlanet: false,
    canRefundOnExit: false,
    dangerHint: '',
    editMode: false,
    saving: false,
    uploadingAvatar: false,
    dangerActionLoading: false,
    editName: '',
    editCategory: '',
    editIntro: '',
    editAvatarImageUrl: '',
  },

  onLoad(options: Record<string, string>) {
    const groupId = resolvePlanetIdFromOptions(options, ['id', 'groupId', 'planetId'])
    if (!groupId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    this.setData({
      'profile.groupId': groupId,
    })
  },

  onShow() {
    void this.loadProfile()
  },

  async ensureSession() {
    const stored = getStoredSession()
    if (stored && stored.sessionToken) {
      return stored
    }

    try {
      return await ensureWechatSession()
    } catch {
      return null
    }
  },

  fillEditForm(profile: ProfileViewState) {
    this.setData({
      editName: profile.name,
      editCategory: profile.category,
      editIntro: profile.intro,
      editAvatarImageUrl: profile.avatarImageUrl,
    })
  },

  applyProfileState(profile: ProfileViewState, canEdit: boolean) {
    this.setData({
      profile,
      canEdit,
      ...buildCapabilityState(profile, canEdit),
    })

    if (!this.data.editMode) {
      this.fillEditForm(profile)
    }
  },

  syncPlanetCache(payload: {
    id: string
    name: string
    avatarImageUrl: string
    category: string
    intro: string
    ownerName: string
  }) {
    if (!payload.id) {
      return
    }

    rememberActivePlanetId(payload.id)

    const localPlanet = getPlanetById(payload.id)

    upsertRemotePlanets([
      {
        id: payload.id,
        name: payload.name,
        avatarImageUrl: payload.avatarImageUrl,
        coverImageUrl: localPlanet ? localPlanet.coverImageUrl : '',
        intro: payload.intro,
        price: localPlanet ? localPlanet.price : 0,
        priceLabel: localPlanet ? localPlanet.priceLabel : '免费加入',
        joinType: localPlanet ? localPlanet.joinType : 'rolling',
        isFree: localPlanet ? localPlanet.isFree : true,
        requireInviteCode: localPlanet ? localPlanet.requireInviteCode : false,
        ownerName: payload.ownerName,
        ownerTagline: localPlanet ? localPlanet.ownerTagline : '',
        category: payload.category || '其他',
        memberCount: localPlanet ? localPlanet.memberCount : 0,
        postCount: localPlanet ? localPlanet.postCount : 0,
        createdAt: localPlanet ? localPlanet.createdAt : '',
        joined: localPlanet ? localPlanet.joined : true,
      },
    ])
  },

  async loadProfile() {
    const groupId = this.data.profile.groupId
    if (!groupId) {
      this.setData({
        loading: false,
      })
      return
    }

    this.setData({
      loading: true,
    })

    try {
      const session = await this.ensureSession()
      const response = await fetchPlanetHome({
        groupId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data) {
        throw new Error('加载星球资料失败')
      }

      const nextProfile: ProfileViewState = {
        groupId,
        name: String((response.data.group && response.data.group.name) || '饮视星球'),
        avatarImageUrl: normalizeAssetUrl(String((response.data.group && response.data.group.avatarUrl) || '').trim()),
        category: String((response.data.group && response.data.group.description) || '其他').trim() || '其他',
        intro: String((response.data.group && response.data.group.intro) || '').trim(),
        ownerName: String((response.data.owner && response.data.owner.nickname) || '星主'),
        isFree: String((response.data.group && response.data.group.joinType) || '').toUpperCase() === 'FREE',
        memberCount: Number((response.data.group && response.data.group.memberCount) || 0),
        joined: Boolean(
          (response.data.role && response.data.role.isOwner) ||
            (response.data.membership && response.data.membership.isActive)
        ),
        joinedAt: String((response.data.membership && response.data.membership.joinedAt) || ''),
        isPaid: Boolean(response.data.membership && response.data.membership.isPaid),
      }

      this.syncPlanetCache({
        id: nextProfile.groupId,
        name: nextProfile.name,
        avatarImageUrl: nextProfile.avatarImageUrl,
        category: nextProfile.category,
        intro: nextProfile.intro,
        ownerName: nextProfile.ownerName,
      })

      this.applyProfileState(nextProfile, Boolean(response.data.role && response.data.role.isOwner))
      this.setData({
        loading: false,
        subscribeEnabled: Boolean(response.data.viewer && response.data.viewer.subscriptionEnabled),
        subscribeLoading: false,
      })
    } catch (error) {
      if (!isLocalPlanetId(groupId) && isPlanetUnavailableError(error)) {
        deleteLocalPlanet(groupId)
        this.setData({
          loading: false,
        })
        navigateToPlanetIndex(error instanceof Error ? error.message : '星球已删除')
        return
      }

      const localProfile = buildLocalProfileState(groupId)
      if (localProfile) {
        this.applyProfileState(localProfile, canEditLocalPlanet(groupId))
        this.setData({
          loading: false,
          subscribeEnabled: getLocalPlanetSubscriptionEnabled(groupId),
          subscribeLoading: false,
        })
        return
      }

      this.setData({
        loading: false,
        subscribeLoading: false,
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '加载星球资料失败',
        icon: 'none',
      })
    }
  },

  onStartEdit() {
    if (!this.data.canEdit) {
      return
    }

    this.fillEditForm(this.data.profile)
    this.setData({
      editMode: true,
    })
  },

  onCancelEdit() {
    if (this.data.saving || this.data.uploadingAvatar) {
      return
    }

    this.fillEditForm(this.data.profile)
    this.setData({
      editMode: false,
    })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({
      editName: String(e.detail.value || ''),
    })
  },

  onCategoryInput(e: WechatMiniprogram.Input) {
    this.setData({
      editCategory: String(e.detail.value || ''),
    })
  },

  onIntroInput(e: WechatMiniprogram.Input) {
    this.setData({
      editIntro: String(e.detail.value || ''),
    })
  },

  onChooseAvatar() {
    if (!this.data.canEdit || this.data.uploadingAvatar || this.data.saving) {
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const target = res.tempFiles && res.tempFiles[0]
        if (!target || !target.tempFilePath) {
          return
        }

        const session = await this.ensureSession()
        if (!session || !session.sessionToken) {
          this.setData({
            editAvatarImageUrl: target.tempFilePath,
          })
          wx.showToast({
            title: '已使用本地头像草稿',
            icon: 'none',
          })
          return
        }

        this.setData({
          uploadingAvatar: true,
        })

        wx.showLoading({
          title: '上传头像中',
          mask: true,
        })

        try {
          const uploadResult = await uploadPlanetImage(target.tempFilePath, session.sessionToken)
          const avatarImageUrl = normalizeAssetUrl(uploadResult.data.url)
          wx.hideLoading()
          this.setData({
            editAvatarImageUrl: avatarImageUrl,
            uploadingAvatar: false,
          })
        } catch (error) {
          wx.hideLoading()
          this.setData({
            editAvatarImageUrl: target.tempFilePath,
            uploadingAvatar: false,
          })
          wx.showToast({
            title: error instanceof Error ? error.message : '已切换为本地头像草稿',
            icon: 'none',
          })
        }
      },
    })
  },

  async onSaveProfile() {
    if (!this.data.canEdit || this.data.saving || this.data.uploadingAvatar) {
      return
    }

    const name = this.data.editName.trim()
    const category = this.data.editCategory.trim()
    const intro = this.data.editIntro.trim()

    if (!name) {
      wx.showToast({
        title: '请输入星球名称',
        icon: 'none',
      })
      return
    }

    if (!intro) {
      wx.showToast({
        title: '请输入星球简介',
        icon: 'none',
      })
      return
    }

    const session = await this.ensureSession()

    this.setData({
      saving: true,
    })

    wx.showLoading({
      title: '保存中',
      mask: true,
    })

    try {
      let useLocalFallback = false
      let nextProfile: ProfileViewState | null = null

      try {
        if (!session || !session.sessionToken) {
          throw new Error('使用本地资料保存')
        }

        const response = await updatePlanetProfile({
          groupId: this.data.profile.groupId,
          name,
          category,
          intro,
          avatarImageUrl: this.data.editAvatarImageUrl,
          sessionToken: session.sessionToken,
        })

        if (!response.ok || !response.data) {
          throw new Error('保存失败，请稍后重试')
        }

        nextProfile = {
          groupId: String(response.data.id || this.data.profile.groupId),
          name: String(response.data.name || name),
          avatarImageUrl: normalizeAssetUrl(String(response.data.avatarImageUrl || this.data.editAvatarImageUrl || '')),
          category: String(response.data.category || category || '其他'),
          intro: String(response.data.intro || intro),
          ownerName: this.data.profile.ownerName,
          isFree: this.data.profile.isFree,
          memberCount: this.data.profile.memberCount,
          joined: this.data.profile.joined,
          joinedAt: this.data.profile.joinedAt,
          isPaid: this.data.profile.isPaid,
        }
      } catch {
        useLocalFallback = true
        const localPlanet = updateLocalPlanetProfile({
          id: this.data.profile.groupId,
          name,
          category,
          intro,
          avatarImageUrl: this.data.editAvatarImageUrl,
        })

        if (!localPlanet) {
          throw new Error('保存失败，请稍后重试')
        }

        nextProfile = {
          groupId: localPlanet.id,
          name: localPlanet.name,
          avatarImageUrl: String(localPlanet.avatarImageUrl || '').trim(),
          category: String(localPlanet.category || '其他'),
          intro: String(localPlanet.intro || ''),
          ownerName: this.data.profile.ownerName,
          isFree: !!localPlanet.isFree,
          memberCount: Number(localPlanet.memberCount || 0),
          joined: !!localPlanet.joined,
          joinedAt: this.data.profile.joinedAt,
          isPaid: this.data.profile.isPaid,
        }
      }

      if (!nextProfile) {
        throw new Error('保存失败，请稍后重试')
      }

      const resolvedProfile = nextProfile

      this.syncPlanetCache({
        id: resolvedProfile.groupId,
        name: resolvedProfile.name,
        avatarImageUrl: resolvedProfile.avatarImageUrl,
        category: resolvedProfile.category,
        intro: resolvedProfile.intro,
        ownerName: resolvedProfile.ownerName,
      })

      wx.hideLoading()
      this.applyProfileState(resolvedProfile, this.data.canEdit)
      this.setData({
        editMode: false,
        saving: false,
      })

      wx.showToast({
        title: useLocalFallback ? '已保存本地资料' : '星球资料已更新',
        icon: 'success',
      })
    } catch (error) {
      wx.hideLoading()
      this.setData({
        saving: false,
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '保存失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  onInviteTap() {
    if (!this.data.profile.groupId) {
      return
    }

    wx.navigateTo({
      url: `/pages/planet/share-card?id=${this.data.profile.groupId}`,
    })
  },

  async onToggleSubscriptionTap() {
    if (this.data.subscribeLoading || !this.data.profile.groupId) {
      return
    }

    const nextEnabled = !this.data.subscribeEnabled
    const applyLocalSubscription = () => {
      const enabled = updateLocalPlanetSubscription(this.data.profile.groupId, nextEnabled)
      wx.hideLoading()
      this.setData({
        subscribeEnabled: enabled,
        subscribeLoading: false,
      })
      wx.showToast({
        title: enabled ? '已开启订阅' : '已取消订阅',
        icon: 'success',
      })
    }

    this.setData({
      subscribeLoading: true,
    })

    wx.showLoading({
      title: nextEnabled ? '开启订阅中' : '取消订阅中',
      mask: true,
    })

    const session = await this.ensureSession()
    if (!session || !session.sessionToken) {
      applyLocalSubscription()
      return
    }

    try {
      const response = await updatePlanetSubscription({
        groupId: this.data.profile.groupId,
        enabled: nextEnabled,
        sessionToken: session.sessionToken,
        userId: session.id,
      })

      if (!response.ok || !response.data) {
        throw new Error('订阅设置失败，请稍后重试')
      }

      updateLocalPlanetSubscription(this.data.profile.groupId, response.data.enabled)
      wx.hideLoading()
      this.setData({
        subscribeEnabled: response.data.enabled,
        subscribeLoading: false,
      })
      wx.showToast({
        title: response.data.enabled ? '已开启订阅' : '已取消订阅',
        icon: 'success',
      })
    } catch {
      applyLocalSubscription()
    }
  },

  onLeavePlanetTap() {
    if (!this.data.canExitPlanet || this.data.dangerActionLoading) {
      return
    }

    const title = this.data.canRefundOnExit ? '申请退款退出星球' : '退出星球'
    const content = this.data.canRefundOnExit
      ? '确认提交退款退出申请吗？提交后需要等待星主审批，通过后才会退款并退出星球。'
      : '退出后将不再显示在你的已加入列表中，确认继续吗？'

    wx.showModal({
      title,
      content,
      confirmText: '确认',
      confirmColor: '#a93039',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void this.submitLeavePlanet()
      },
    })
  },

  async submitLeavePlanet() {
    const groupId = this.data.profile.groupId
    if (!groupId) {
      return
    }

    const requireRefundReview = !isLocalPlanetId(groupId) && this.data.canRefundOnExit
    let refunded = false

    this.setData({
      dangerActionLoading: true,
    })
    wx.showLoading({
      title: requireRefundReview ? '提交中' : this.data.canRefundOnExit ? '处理中' : '退出中',
      mask: true,
    })

    try {
      if (isLocalPlanetId(groupId)) {
        const localPlanet = leaveLocalPlanet(groupId)
        if (!localPlanet) {
          throw new Error('退出失败，请稍后重试')
        }
      } else {
        const session = await this.ensureSession()
        if (!session || !session.sessionToken) {
          throw new Error('请先登录后再试')
        }

        if (requireRefundReview) {
          const response = await requestPlanetRefundReview({
            groupId,
            sessionToken: session.sessionToken,
          })

          if (!response.ok) {
            throw new Error(response.message || '提交退款审批失败')
          }
        } else {
          const response = await leavePlanetMembership({
            groupId,
            sessionToken: session.sessionToken,
          })

          if (!response.ok) {
            throw new Error(response.message || '退出失败，请稍后重试')
          }

          refunded = Boolean(response.data && response.data.refunded)
          leaveLocalPlanet(groupId)
        }
      }

      wx.hideLoading()
      this.setData({
        dangerActionLoading: false,
      })

      if (requireRefundReview) {
        wx.showToast({
          title: '已提交退款审批',
          icon: 'success',
        })
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/planet/refunds?tab=joined',
          })
        }, 300)
        return
      }

      wx.showToast({
        title: refunded ? '已退款并退出' : '已退出星球',
        icon: 'success',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/planet/index',
        })
      }, 300)
    } catch (error) {
      wx.hideLoading()
      this.setData({
        dangerActionLoading: false,
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '退出失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  onDeletePlanetTap() {
    if (!this.data.canEdit || this.data.dangerActionLoading) {
      return
    }

    if (!this.data.canDeletePlanet) {
      wx.showToast({
        title: this.data.dangerHint || '当前条件下不能删除星球',
        icon: 'none',
      })
      return
    }

    wx.showModal({
      title: '删除星球',
      content: '删除后星球将从前台下线，成员将无法继续访问，操作不可恢复。确认继续吗？',
      confirmText: '确认删除',
      confirmColor: '#a93039',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void this.submitDeletePlanet()
      },
    })
  },

  async submitDeletePlanet() {
    const groupId = this.data.profile.groupId
    if (!groupId) {
      return
    }

    this.setData({
      dangerActionLoading: true,
    })
    wx.showLoading({
      title: '删除中',
      mask: true,
    })

    try {
      if (isLocalPlanetId(groupId)) {
        const localPlanet = deleteLocalPlanet(groupId)
        if (!localPlanet) {
          throw new Error('删除失败，请稍后重试')
        }
      } else {
        const session = await this.ensureSession()
        if (!session || !session.sessionToken) {
          throw new Error('请先登录后再试')
        }

        const response = await deleteRemotePlanet({
          groupId,
          sessionToken: session.sessionToken,
        })

        if (!response.ok) {
          throw new Error(response.message || '删除失败，请稍后重试')
        }

        deleteLocalPlanet(groupId)
      }

      wx.hideLoading()
      this.setData({
        dangerActionLoading: false,
      })
      wx.showToast({
        title: '星球已删除',
        icon: 'success',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/planet/index',
        })
      }, 300)
    } catch (error) {
      wx.hideLoading()
      this.setData({
        dangerActionLoading: false,
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '删除失败，请稍后重试',
        icon: 'none',
      })
    }
  },
})
