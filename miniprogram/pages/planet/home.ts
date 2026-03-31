import { getPlanetById, loadPosts, PlanetPost } from '../../utils/planet'

interface PlanetTab {
  key: string
  label: string
}

interface FeedItem {
  id: string
  author: string
  avatarClass: string
  time: string
  title: string
  content: string
  images: string[]
  tag: string
  likeCount: string
  commentCount: string
  hasFile?: boolean
  fileName?: string
}

const feedAvatarClassPool = [
  'feed-avatar-blue',
  'feed-avatar-gray',
  'feed-avatar-rose',
  'feed-avatar-dark',
  'feed-avatar-amber',
  'feed-avatar-navy',
]

const getFeedAvatarClass = (index: number) => feedAvatarClassPool[index % feedAvatarClassPool.length]

const SUBSCRIBE_STORAGE_KEY = 'planet_subscription_status_v1'
const SUBSCRIBE_TEMPLATE_IDS = ['REPLACE_WITH_WECHAT_SUBSCRIBE_TEMPLATE_ID']

type SubscribeStatusMap = Record<string, boolean>

const loadSubscribeStatusMap = () => {
  const stored = wx.getStorageSync(SUBSCRIBE_STORAGE_KEY)
  if (!stored || typeof stored !== 'object') {
    return {} as SubscribeStatusMap
  }
  return stored as SubscribeStatusMap
}

const saveSubscribeStatus = (planetId: string, subscribed: boolean) => {
  const statusMap = loadSubscribeStatusMap()
  wx.setStorageSync(SUBSCRIBE_STORAGE_KEY, {
    ...statusMap,
    [planetId]: subscribed,
  })
}

const mapPostsToFeedItems = (posts: PlanetPost[]): FeedItem[] =>
  posts.map((post, index) => ({
    id: post.id,
    author: post.author,
    avatarClass: getFeedAvatarClass(index),
    time: post.time,
    title: post.content,
    content: '',
    images: post.images || [],
    tag: '',
    likeCount: `${post.likeCount}`,
    commentCount: `${post.commentCount}`,
  }))

Page({
  data: {
    planetId: 'planet_1',
    planetName: 'Datawhale',
    creatorName: '范大',
    avatarClass: 'avatar-sand',
    showNotices: true,
    subscribed: false,
    showSubscribeDialog: false,
    showSettingsSheet: false,
    showInviteSheet: false,
    activeTab: 'latest',
    tabs: [
      { key: 'latest', label: '最新' },
      { key: 'featured', label: '精华' },
      { key: 'files', label: '文件' },
      { key: 'answer', label: '等我回答' },
    ] as PlanetTab[],
    latestList: [
      {
        id: 'l1',
        author: '程序员996号',
        avatarClass: 'feed-avatar-blue',
        time: '2026/03/18 15:47',
        title: '26年目标 :智能体开发或ai产品经理',
        content: '',
        images: [],
        tag: '',
        likeCount: '1',
        commentCount: '0',
      },
      {
        id: 'l2',
        author: 'WROC',
        avatarClass: 'feed-avatar-gray',
        time: '2026/03/13 05:11',
        title: '26年目标，智能体应用',
        content: '',
        images: [],
        tag: '',
        likeCount: '0',
        commentCount: '0',
      },
    ] as FeedItem[],
    featuredList: [
      {
        id: 'f1',
        author: '二小',
        avatarClass: 'feed-avatar-rose',
        time: '2025/01/09 17:21',
        title: '分享一本python游戏编程',
        content: '',
        images: [],
        tag: '精华',
        likeCount: '6',
        commentCount: '0',
        hasFile: true,
        fileName: 'Python游戏编程快速上手.pdf',
      },
      {
        id: 'f2',
        author: 'BDAI_Skywa*',
        avatarClass: 'feed-avatar-dark',
        time: '2024/11/26 21:05',
        title: '基于博弈交互可解释ML',
        content: '',
        images: [],
        tag: '精华',
        likeCount: '1',
        commentCount: '0',
        hasFile: true,
        fileName: 'f27a0e2139a305a35426438ee7ca77ad.pdf',
      },
    ] as FeedItem[],
    fileList: [
      {
        id: 'file1',
        author: '云梦 &&玄龙',
        avatarClass: 'feed-avatar-amber',
        time: '2026/01/05 09:02',
        title: '分享一个关于AI 智能体的综述',
        content: '',
        images: [],
        tag: '',
        likeCount: '5',
        commentCount: '0',
        hasFile: true,
        fileName: 'ai agent综述 李飞飞.pdf',
      },
      {
        id: 'file2',
        author: '曹文杰',
        avatarClass: 'feed-avatar-navy',
        time: '2025/11/14 10:38',
        title: '大模型边界',
        content: '',
        images: [],
        tag: '',
        likeCount: '0',
        commentCount: '0',
        hasFile: true,
        fileName: '大模型能力边界与发展思考-专业研究版本-v1...',
      },
    ] as FeedItem[],
  },

  onLoad(options: Record<string, string>) {
    const planetId = options.id || 'planet_1'
    const planet = getPlanetById(planetId)
    const latestPosts = mapPostsToFeedItems(loadPosts())
    const planetName = planet?.name || (options.name ? decodeURIComponent(options.name) : 'Datawhale')
    const creatorName = planet?.ownerName || (options.creator ? decodeURIComponent(options.creator) : '范大')
    const avatarClass = planet?.avatarClass || 'avatar-sand'
    const isNewPlanet = !!planet && planet.memberCount <= 1

    this.setData({
      planetId,
      planetName,
      creatorName,
      avatarClass,
      subscribed: !!loadSubscribeStatusMap()[planetId],
      showNotices: !isNewPlanet,
      latestList: isNewPlanet
        ? [
            {
              id: 'welcome_1',
              author: creatorName,
              avatarClass,
              time: planet?.createdAt || '2026/03/31 11:23',
              title: `欢迎加入「${planetName}」，非常高兴能与大家在这里相遇。`,
              content: `${planet?.intro || `建议大家优先使用 App 深度交流，及时接收最新消息，和我一起把 ${planetName} 做起来。`}\n\n点击下方链接进行下载安装，期待在 App 里与大家深入交流。`,
              images: [],
              tag: '',
              likeCount: '0',
              commentCount: '0',
            },
          ]
        : latestPosts,
    })
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key || 'latest'
    this.setData({
      activeTab: key,
    })
  },

  onActionTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key
    if (key === 'checkin') {
      wx.navigateTo({
        url: '/pages/planet/checkin',
      })
      return
    }
    if (key === 'columns') {
      wx.navigateTo({
        url: '/pages/planet/columns',
      })
      return
    }
    if (key === 'subscribe') {
      this.onSubscribeTap()
      return
    }
    if (key === 'settings') {
      this.onSettingsTap()
      return
    }
    if (key === 'invite') {
      this.onInviteTap()
    }
  },

  onSettingsTap() {
    this.setData({
      showSettingsSheet: true,
    })
  },

  onCloseSettingsSheet() {
    this.setData({
      showSettingsSheet: false,
    })
  },

  onSettingsItemTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key

    this.setData({
      showSettingsSheet: false,
    })

    if (key === 'profile') {
      wx.navigateTo({
        url: `/pages/planet/profile?id=${this.data.planetId}`,
      })
      return
    }

    if (key === 'mp') {
      wx.navigateTo({
        url: `/pages/planet/embed?id=${this.data.planetId}`,
      })
    }
  },

  onInviteTap() {
    this.setData({
      showInviteSheet: true,
    })
  },

  onCloseInviteSheet() {
    this.setData({
      showInviteSheet: false,
    })
  },

  onGenerateInviteCard() {
    this.setData({
      showInviteSheet: false,
    })
    wx.navigateTo({
      url: `/pages/planet/share-card?id=${this.data.planetId}`,
    })
  },

  onShareAppMessage() {
    const { planetId, planetName, creatorName } = this.data
    this.setData({
      showInviteSheet: false,
    })
    return {
      title: `邀请你加入「${planetName}」`,
      path: `/pages/planet/home?id=${planetId}&name=${encodeURIComponent(planetName)}&creator=${encodeURIComponent(creatorName)}`,
    }
  },

  onShareTimeline() {
    return {
      title: `邀请你加入「${this.data.planetName}」`,
      query: `id=${this.data.planetId}`,
    }
  },

  onSubscribeTap() {
    if (this.data.subscribed) {
      wx.showToast({
        title: '已订阅内容提醒',
        icon: 'none',
      })
      return
    }

    this.setData({
      showSubscribeDialog: true,
    })
  },

  onCloseSubscribeDialog() {
    this.setData({
      showSubscribeDialog: false,
    })
  },

  onSubscribeSkip() {
    this.setData({
      showSubscribeDialog: false,
    })
  },

  noop() {},

  onSubscribeConfirm() {
    const validTemplateIds = SUBSCRIBE_TEMPLATE_IDS.filter(
      (item) => item && !item.startsWith('REPLACE_WITH_'),
    )

    if (!validTemplateIds.length) {
      this.setData({
        showSubscribeDialog: false,
      })
      wx.showToast({
        title: '请先配置订阅消息模板ID',
        icon: 'none',
      })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds: validTemplateIds,
      success: (res) => {
        const accepted = validTemplateIds.some((tmplId) => res[tmplId] === 'accept')
        const rejected = validTemplateIds.every((tmplId) => res[tmplId] === 'reject')
        const mainSwitchOff = typeof res.errMsg === 'string' && res.errMsg.includes('20004')

        this.setData({
          showSubscribeDialog: false,
        })

        if (accepted) {
          saveSubscribeStatus(this.data.planetId, true)
          this.setData({
            subscribed: true,
          })
          wx.showToast({
            title: '订阅成功',
            icon: 'success',
          })
          return
        }

        if (mainSwitchOff) {
          wx.showModal({
            title: '通知未开启',
            content: '请在微信设置中开启订阅消息提醒后再试。',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({})
              }
            },
          })
          return
        }

        wx.showToast({
          title: rejected ? '你已选择暂不订阅' : '未完成订阅授权',
          icon: 'none',
        })
      },
      fail: (error) => {
        this.setData({
          showSubscribeDialog: false,
        })
        const errMsg = typeof error.errMsg === 'string' ? error.errMsg : ''
        const blockedBySwitch = errMsg.includes('20004')

        if (blockedBySwitch) {
          wx.showModal({
            title: '通知未开启',
            content: '请在微信设置中开启订阅消息提醒后再试。',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({})
              }
            },
          })
          return
        }

        wx.showToast({
          title: '订阅申请未完成',
          icon: 'none',
        })
      },
    })
  },

  onFeedTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'l1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${id}`,
    })
  },

  onPublish() {
    wx.showToast({
      title: '发帖能力下一步补齐',
      icon: 'none',
    })
  },
})
