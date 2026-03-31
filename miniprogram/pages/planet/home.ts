import { getPlanetById, loadPinnedPosts, loadPosts, PlanetPinnedPost, PlanetPost, PlanetProfile } from '../../utils/planet'

interface PlanetMetricItem {
  label: string
  value: string
}

interface PlanetPreviewItem {
  id: string
  author: string
  authorAvatar: string
  time: string
  title: string
  summary: string
  image: string
}

interface PlanetDetailConfig {
  planetNo: string
  verifiedLabel: string
  reportLabel: string
  categoryLabel?: string
  ownerNameOverride?: string
  avatarImageUrl?: string
  ownerActiveText: string
  description: string[]
  feeNotices: string[]
  previewList: PlanetPreviewItem[]
  metricOverrides?: {
    topics?: string
    members?: string
    featured?: string
    questions?: string
  }
  priceText?: string
}

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
  likeCount: string
  commentCount: string
  hasFile?: boolean
  fileName?: string
}

interface PinnedArticleItem {
  id: string
  prefix: string
  title: string
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

const defaultPreviewList: PlanetPreviewItem[] = [
  {
    id: 'preview_default_1',
    author: '星主',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    time: '2026/03/31 13:36',
    title: '欢迎来到这里，一起把长期有价值的内容沉淀下来',
    summary: '这里会持续更新主题内容、实战经验和阶段性复盘，方便大家按主题回看。',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
  },
]

const detailConfigMap: Record<string, PlanetDetailConfig> = {
  CEO管理笔记: {
    planetNo: '40468939',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    categoryLabel: '教育',
    ownerNameOverride: '李李舟安',
    avatarImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    ownerActiveText: '创建1159天，今天活跃过',
    description: [
      '这里聊你书上看不到、学校不会教、父母也不懂的：社会规则｜职场关系｜管理难题｜人际关系｜复杂局面。',
      '舟安去过南极、亚马逊雨林、远东无人区探险，也把这些经历沉淀成关于管理和复杂关系的长期笔记。',
    ],
    feeNotices: [
      '付费后，你可以使用当前付款的微信帐号在有效期内通过「知识星球」公众号、小程序、App 端、Web 端阅读内容、参与互动，向星主、合伙人或嘉宾提问。',
      '加入星球后，72 小时内可申请退款。超过 72 小时后如果产生退款，手续费不予退还。',
      '本星球由星主自行创建，加入前请确认风险，平台不提供相关保证。若发现违法星球，请勿加入，并及时投诉。',
    ],
    previewList: [
      {
        id: 'ceo_preview_1',
        author: '李李舟安',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/31 13:36',
        title: '【 第 1218 期 关系中的爱与恨 】',
        summary: '这篇本来要在局间星球聊的，但问的人实在太多，打算写在这里。我写这个知识星...',
        image: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'ceo_preview_2',
        author: '李李舟安',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/15 21:04',
        title: '【 第 1205 期 10-20人团队的配置和分工 】',
        summary: '刚接了一位朋友咨询的电话。我们一起讨论一下，10-20人团队在不同阶段怎么配人。',
        image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'ceo_preview_3',
        author: '李李舟安',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/12 11:39',
        title: '【 第 1203 期 大多数人忽略的管理真相 】',
        summary: '这几天我在做《逆向管理课》的 PPT，发现很多人都在忽略一个管理的真问题。',
        image: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80',
      },
    ],
    metricOverrides: {
      topics: '1.7k+',
      members: '1800+',
      featured: '81',
      questions: '691',
    },
    priceText: '¥499',
  },
  planet_1: {
    planetNo: '40468939',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    ownerActiveText: '创建1159天，今天活跃过',
    description: [
      '这里聊你书上看不到、学校不会教、父母也不懂的：社会规则｜职场关系｜管理难题｜人际关系｜复杂局面。',
      '把经历过的管理现场、组织磨合、关键决策和沟通方法，沉淀成可以反复翻看的经验笔记。',
    ],
    feeNotices: [
      '付费后，你可以使用当前付款的微信帐号在有效期内通过「知识星球」公众号、小程序、App 端、Web 端阅读内容、参与互动，向星主、合伙人或嘉宾提问。',
      '加入星球后，72 小时内可申请退款。超过 72 小时后如果产生退款，手续费不予退还。',
      '本星球由星主自行创建，加入前请确认风险，平台不提供相关保证。若发现违法星球，请勿加入，并及时投诉。',
    ],
    previewList: defaultPreviewList,
    metricOverrides: {
      topics: '1.7k+',
      members: '1800+',
      featured: '81',
      questions: '691',
    },
    priceText: '¥499',
  },
  planet_2: {
    planetNo: '88885121',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    ownerActiveText: '创建803天，今天活跃过',
    description: [
      '聚焦 AI 编程、副业出海和项目实操，分享从选题、验证到上线变现的一整套方法。',
      '每周会补充项目复盘、工具链清单和案例拆解，帮助大家更快做出自己的可售卖产品。',
    ],
    feeNotices: [
      '会员有效期内可在微信小程序、App 和 Web 端浏览主题、精华和专栏内容。',
      '付费加入后 72 小时内支持申请退款；超时后如发生退款，手续费不予退回。',
      '请确认星球定位与更新节奏后再加入，适合想把 AI 项目尽快落地并持续复盘的同学。',
    ],
    previewList: [
      {
        id: 'ai_preview_1',
        author: '易安',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/31 09:30',
        title: '新来的朋友，大家好，欢迎来到我的知识星球。',
        summary: '这里会持续记录 AI 副业路径、产品验证方式和真实踩坑经验，先把项目做出来，再慢慢打磨。',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'ai_preview_2',
        author: '易安',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/29 20:16',
        title: '如何用 7 天做出一个能卖的 AI 小工具',
        summary: '从需求来源、MVP 范围到收款闭环，把最小验证路径拆成可以直接执行的清单。',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
      },
    ],
    metricOverrides: {
      topics: '2.3k+',
      members: '2360+',
      featured: '126',
      questions: '918',
    },
    priceText: '¥365',
  },
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
    likeCount: `${post.likeCount}`,
    commentCount: `${post.commentCount}`,
  }))

const mapPinnedPostsToItems = (posts: PlanetPinnedPost[]): PinnedArticleItem[] =>
  posts.map((post) => ({
    id: post.id,
    prefix: post.prefix,
    title: post.title,
  }))

const formatMetricCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k+`
  }
  return `${count}`
}

const buildMetricList = (planet: PlanetProfile, detail: PlanetDetailConfig): PlanetMetricItem[] => {
  const metricOverrides = detail.metricOverrides || {}
  const topics = metricOverrides.topics || formatMetricCount(planet.postCount)
  const members = metricOverrides.members || `${planet.memberCount}+`
  const featured = metricOverrides.featured || `${Math.max(12, Math.floor(planet.postCount / 5))}`
  const questions = metricOverrides.questions || `${Math.max(36, Math.floor(planet.memberCount / 3))}`

  return [
    { label: '主题', value: topics },
    { label: '成员', value: members },
    { label: '精华', value: featured },
    { label: '问答', value: questions },
  ]
}

const buildTags = (planet: PlanetProfile, detail: PlanetDetailConfig) => {
  const tags = [detail.verifiedLabel, detail.categoryLabel || planet.category]
  if (planet.isFree) {
    tags.push('免费')
  }
  return tags
}

Page({
  data: {
    isJoined: false,
    planetId: 'planet_1',
    planetName: '知识星球',
    creatorName: '',
    avatarClass: 'avatar-sand',
    avatarImageUrl: '',
    planetNo: '',
    ownerName: '',
    ownerActiveText: '',
    tags: [] as string[],
    metrics: [] as PlanetMetricItem[],
    descriptionList: [] as string[],
    previewDescriptionList: [] as string[],
    introExpanded: false,
    feeNotices: [] as string[],
    previewList: [] as PlanetPreviewItem[],
    priceText: '¥199',
    joinButtonText: '立即加入',
    reportLabel: '投诉',
    showNotices: true,
    activeTab: 'latest',
    tabs: [
      { key: 'latest', label: '最新' },
      { key: 'featured', label: '精华' },
      { key: 'files', label: '文件' },
      { key: 'answer', label: '等我回答' },
    ] as PlanetTab[],
    pinnedList: [] as PinnedArticleItem[],
    latestList: [] as FeedItem[],
    featuredList: [
      {
        id: 'f1',
        author: '程序员996号',
        avatarClass: 'feed-avatar-blue',
        time: '2026/03/18 15:47',
        title: '26年目标 ai智能体开发或ai产品经理',
        content: '',
        images: [],
        likeCount: '1',
        commentCount: '0',
      },
      {
        id: 'f2',
        author: 'WROC',
        avatarClass: 'feed-avatar-gray',
        time: '2026/03/13 05:11',
        title: '26年目标，智能体应用',
        content: '',
        images: [],
        likeCount: '0',
        commentCount: '0',
      },
    ] as FeedItem[],
    fileList: [
      {
        id: 'file1',
        author: '云梦&&玄龙',
        avatarClass: 'feed-avatar-amber',
        time: '2026/01/05 09:02',
        title: '分享一个关于AI 智能体的综述',
        content: '',
        images: [],
        likeCount: '6',
        commentCount: '0',
        hasFile: true,
        fileName: 'ai agent综述 李飞飞.pdf',
      },
    ] as FeedItem[],
  },

  onLoad(options: Record<string, string>) {
    const planetId = options.id || 'planet_1'
    const planet = getPlanetById(planetId)
    const optionName = options.name ? decodeURIComponent(options.name) : ''
    const optionCreator = options.creator ? decodeURIComponent(options.creator) : ''
    const source = options.source || ''

    if (!planet) {
      return
    }

    const detail = detailConfigMap[optionName] || detailConfigMap[planetId] || {
      planetNo: planet.embedPath.replace(/\D/g, '').slice(0, 8) || '10000001',
      verifiedLabel: '已认证',
      reportLabel: '投诉',
      ownerActiveText: `创建${Math.max(30, planet.memberCount)}天，今天活跃过`,
      description: [planet.intro],
      feeNotices: [
        '付费后可在有效期内查看星球内容、参与互动并接收更新提醒。',
        '加入星球后 72 小时内可申请退款，超时后手续费不予退回。',
        '加入前请确认内容方向与更新节奏，平台不对第三方内容承担保证责任。',
      ],
      previewList: defaultPreviewList,
      priceText: planet.isFree ? '免费' : `¥${planet.price}`,
    }

    const isJoined = source === 'discover' ? false : source === 'joined' ? true : !!planet.joined
    const latestPosts = mapPostsToFeedItems(loadPosts())
    const pinnedList = mapPinnedPostsToItems(loadPinnedPosts())
    const creatorName = optionCreator || planet.ownerName
    const joinButtonText = isJoined ? '进入星球' : `立即加入：${detail.priceText || (planet.isFree ? '免费' : `¥${planet.price}`)}`

    this.setData({
      isJoined,
      planetId,
      planetName: optionName || planet.name,
      creatorName,
      avatarClass: planet.avatarClass,
      avatarImageUrl: detail.avatarImageUrl || planet.avatarImageUrl,
      planetNo: detail.planetNo,
      ownerName: (detail.ownerNameOverride || creatorName).replace(/^(主理人\s*)/, '').replace(/老师$/, ''),
      ownerActiveText: detail.ownerActiveText,
      tags: buildTags(planet, detail),
      metrics: buildMetricList(planet, detail),
      descriptionList: detail.description,
      previewDescriptionList: detail.description.slice(0, 1),
      introExpanded: false,
      feeNotices: detail.feeNotices,
      previewList: detail.previewList,
      priceText: detail.priceText || (planet.isFree ? '免费' : `¥${planet.price}`),
      joinButtonText,
      reportLabel: detail.reportLabel,
      showNotices: !!pinnedList.length,
      pinnedList,
      latestList: latestPosts,
    })
  },

  onToggleIntro() {
    const introExpanded = !this.data.introExpanded

    this.setData({
      introExpanded,
      previewDescriptionList: introExpanded ? this.data.descriptionList : this.data.descriptionList.slice(0, 1),
    })
  },

  onOwnerTap() {
    wx.navigateTo({
      url: `/pages/planet/profile?id=${this.data.planetId}`,
    })
  },

  onPreviewTap() {
    wx.showToast({
      title: '主题详情下一步补齐',
      icon: 'none',
    })
  },

  onJoinTap() {
    if (this.data.isJoined) {
      wx.showToast({
        title: '进入星球内容流',
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: this.data.priceText === '免费' ? '准备加入星球' : `准备加入 ${this.data.priceText}`,
      icon: 'none',
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
      wx.showToast({
        title: '订阅提醒功能下一步补齐',
        icon: 'none',
      })
      return
    }

    if (key === 'settings') {
      wx.navigateTo({
        url: `/pages/planet/profile?id=${this.data.planetId}`,
      })
      return
    }

    if (key === 'invite') {
      wx.navigateTo({
        url: `/pages/planet/share-card?id=${this.data.planetId}`,
      })
    }
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key || 'latest'
    this.setData({
      activeTab: key,
    })
  },

  onFeedTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'seed_1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${id}&planetId=${this.data.planetId}`,
    })
  },

  onPinnedTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'pinned_1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${id}&planetId=${this.data.planetId}`,
    })
  },

  onPublish() {
    wx.showToast({
      title: '发帖能力下一步补齐',
      icon: 'none',
    })
  },

  onShareAppMessage() {
    return {
      title: `邀请你加入「${this.data.planetName}」`,
      path: `/pages/planet/home?id=${this.data.planetId}`,
    }
  },

  onShareTimeline() {
    return {
      title: `邀请你加入「${this.data.planetName}」`,
      query: `id=${this.data.planetId}`,
    }
  },
})
