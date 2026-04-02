import {
  getPlanetById,
  joinPlanet,
  PlanetProfile,
} from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import {
  createJoinOrder,
  fetchMembershipStatus,
  fetchPinnedPosts,
  fetchPlanetPosts,
  mockJoinPayment,
} from '../../utils/planet-api'
import { ensureWechatSession } from '../../utils/wechat-login'

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
  targetPostId?: string
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
interface PinnedArticleItem extends Pick<FeedItem, 'id' | 'title'> {
  prefix: string
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
const PLANET_PUBLISH_REFRESH_KEY = 'planet_publish_refresh_v1'
const legacyPlanetIdMap: Record<string, string> = {
  planet_1: 'grp_datawhale_001',
}

const resolvePlanetId = (planetId: string) => legacyPlanetIdMap[planetId] || planetId

const formatPostTime = (value?: string) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

const isImageUrl = (value: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value)

const extractPostImages = (post: Record<string, any>) => {
  const attachments = Array.isArray(post.attachments) ? post.attachments : []
  const attachmentImages = attachments
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return item.url.trim()
      }
      return ''
    })
    .filter((item) => /^https?:\/\//.test(item) && isImageUrl(item))

  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const metadataImages = Array.isArray(metadata.images)
    ? metadata.images.filter(
        (item: unknown) => typeof item === 'string' && /^https?:\/\//.test(item) && isImageUrl(item)
      )
    : []

  return Array.from(new Set(attachmentImages.concat(metadataImages))).slice(0, 9)
}

const mapRemotePostToFeedItem = (post: Record<string, any>, index: number): FeedItem => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const images = extractPostImages(post)
  const title = String(post.title || post.summary || post.contentText || '').trim()
  const content = String(post.contentText || '').trim()

  return {
    id: String(post.id || ''),
    author:
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : '当前成员',
    avatarClass: getFeedAvatarClass(index),
    time: formatPostTime(post.publishedAt || post.createdAt || ''),
    title: title || content,
    content: title && content && content !== title ? content : '',
    images,
    likeCount: `${Number(post.likeCount || 0)}`,
    commentCount: `${Number(post.commentCount || 0)}`,
    hasFile: images.length === 0 && Array.isArray(post.attachments) && post.attachments.length > 0,
    fileName: typeof metadata.fileName === 'string' ? metadata.fileName : '附件资料',
  }
}

const mapRemotePostsToFeedItems = (posts: Array<Record<string, any>>) =>
  posts.map((post, index) => mapRemotePostToFeedItem(post, index))

const mapRemotePinnedPostsToItems = (posts: Array<Record<string, any>>): PinnedArticleItem[] =>
  posts.map((post) => ({
    id: String(post.id || ''),
    prefix: Array.isArray(post.attachments) && post.attachments.length ? '[图片]' : '',
    title: String(post.title || post.summary || post.contentText || '').trim(),
  }))

const defaultPreviewList: PlanetPreviewItem[] = [
  {
    id: 'preview_default_1',
    author: '星主',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    time: '2026/03/31 13:36',
    title: '欢迎来到这里，一起把长期有价值的内容沉淀下来',
    summary: '这里会持续更新主题内容、实战经验和阶段性复盘，方便大家按主题回看。',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    targetPostId: 'pinned_1',
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
        targetPostId: 'pinned_1',
      },
      {
        id: 'ceo_preview_2',
        author: '李李舟安',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/15 21:04',
        title: '【 第 1205 期 10-20人团队的配置和分工 】',
        summary: '刚接了一位朋友咨询的电话。我们一起讨论一下，10-20人团队在不同阶段怎么配人。',
        image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80',
        targetPostId: 'seed_2',
      },
      {
        id: 'ceo_preview_3',
        author: '李李舟安',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/12 11:39',
        title: '【 第 1203 期 大多数人忽略的管理真相 】',
        summary: '这几天我在做《逆向管理课》的 PPT，发现很多人都在忽略一个管理的真问题。',
        image: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80',
        targetPostId: 'seed_3',
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
        targetPostId: 'pinned_1',
      },
      {
        id: 'ai_preview_2',
        author: '易安',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        time: '2026/03/29 20:16',
        title: '如何用 7 天做出一个能卖的 AI 小工具',
        summary: '从需求来源、MVP 范围到收款闭环，把最小验证路径拆成可以直接执行的清单。',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
        targetPostId: 'seed_2',
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
    joinLoading: false,
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
    source: '',
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
    answerList: [] as FeedItem[],
  },

  onLoad(options: Record<string, string>) {
    const planetId = resolvePlanetId(options.id || 'planet_1')
    const planet = getPlanetById(planetId)
    const optionName = options.name ? decodeURIComponent(options.name) : ''
    const optionCreator = options.creator ? decodeURIComponent(options.creator) : ''
    const source = options.source || ''
    const fallbackPlanet: PlanetProfile =
      planet ||
      ({
        id: planetId,
        name: optionName || '知识星球',
        joined: source === 'joined',
        avatarClass: 'avatar-sand',
        avatarImageUrl: '',
        coverImageUrl: '',
        unread: '',
        badge: '',
        price: 0,
        priceLabel: '免费加入',
        joinType: 'rolling',
        isFree: true,
        requireInviteCode: false,
        ownerName: optionCreator || '星主',
        ownerTagline: '',
        category: '其他',
        intro: '',
        embedPath: '',
        memberCount: 0,
        postCount: 0,
        createdAt: '',
      } as PlanetProfile)

    const detail = detailConfigMap[optionName] || detailConfigMap[planetId] || {
      planetNo: fallbackPlanet.embedPath.replace(/\D/g, '').slice(0, 8) || '10000001',
      verifiedLabel: '已认证',
      reportLabel: '投诉',
      ownerActiveText: `创建${Math.max(30, planet.memberCount)}天，今天活跃过`,
      description: [fallbackPlanet.intro],
      feeNotices: [
        '付费后可在有效期内查看星球内容、参与互动并接收更新提醒。',
        '加入星球后 72 小时内可申请退款，超时后手续费不予退回。',
        '加入前请确认内容方向与更新节奏，平台不对第三方内容承担保证责任。',
      ],
      previewList: defaultPreviewList,
      priceText: fallbackPlanet.isFree ? '免费' : `¥${fallbackPlanet.price}`,
    }

    const isJoined = source === 'discover' ? false : source === 'joined' ? true : !!fallbackPlanet.joined
    const creatorName = optionCreator || fallbackPlanet.ownerName
    const joinButtonText =
      isJoined ? '进入星球' : `立即加入：${detail.priceText || (fallbackPlanet.isFree ? '免费' : `¥${fallbackPlanet.price}`)}`

    this.setData({
      isJoined,
      joinLoading: false,
      planetId,
      planetName: optionName || fallbackPlanet.name,
      creatorName,
      avatarClass: fallbackPlanet.avatarClass,
      avatarImageUrl: detail.avatarImageUrl || fallbackPlanet.avatarImageUrl,
      planetNo: detail.planetNo,
      ownerName: (detail.ownerNameOverride || creatorName).replace(/^(主理人\s*)/, '').replace(/老师$/, ''),
      ownerActiveText: detail.ownerActiveText,
      tags: buildTags(fallbackPlanet, detail),
      metrics: buildMetricList(fallbackPlanet, detail),
      descriptionList: detail.description,
      previewDescriptionList: detail.description.slice(0, 1),
      introExpanded: false,
      feeNotices: detail.feeNotices,
      previewList: detail.previewList,
      priceText: detail.priceText || (fallbackPlanet.isFree ? '免费' : `¥${fallbackPlanet.price}`),
      joinButtonText,
      reportLabel: detail.reportLabel,
      showNotices: false,
      pinnedList: [],
      latestList: [],
      featuredList: [],
      fileList: [],
      answerList: [],
      source,
    })

    void this.refreshFeedContent(planetId)
    void this.syncMembershipState(planetId, isJoined)
  },

  onShow() {
    if (!this.data.planetId) {
      return
    }

    const refreshPlanetId = wx.getStorageSync(PLANET_PUBLISH_REFRESH_KEY)
    if (refreshPlanetId && refreshPlanetId === this.data.planetId) {
      wx.removeStorageSync(PLANET_PUBLISH_REFRESH_KEY)
      this.setData({
        activeTab: 'latest',
      })
    }

    void this.refreshFeedContent(this.data.planetId)
  },

  async refreshFeedContent(planetId: string) {
    if (!planetId) {
      return
    }

    try {
      const session = getStoredSession()
      const sessionToken = session && session.sessionToken ? session.sessionToken : ''
      const [latestResponse, featuredResponse, fileResponse, answerResponse, pinnedResponse] =
        await Promise.all([
          fetchPlanetPosts({ groupId: planetId, tab: 'latest', limit: 20, sessionToken }),
          fetchPlanetPosts({ groupId: planetId, tab: 'featured', limit: 20, sessionToken }),
          fetchPlanetPosts({ groupId: planetId, tab: 'files', limit: 20, sessionToken }),
          fetchPlanetPosts({ groupId: planetId, tab: 'answer', limit: 20, sessionToken }),
          fetchPinnedPosts(planetId, sessionToken),
        ])

      const latestList = latestResponse.ok && latestResponse.data ? mapRemotePostsToFeedItems(latestResponse.data.items || []) : []
      const featuredList =
        featuredResponse.ok && featuredResponse.data ? mapRemotePostsToFeedItems(featuredResponse.data.items || []) : []
      const fileList = fileResponse.ok && fileResponse.data ? mapRemotePostsToFeedItems(fileResponse.data.items || []) : []
      const answerList =
        answerResponse.ok && answerResponse.data ? mapRemotePostsToFeedItems(answerResponse.data.items || []) : []
      const pinnedList = pinnedResponse.ok && Array.isArray(pinnedResponse.data) ? mapRemotePinnedPostsToItems(pinnedResponse.data) : []

      this.setData({
        latestList,
        featuredList,
        fileList,
        answerList,
        pinnedList,
        showNotices: !!pinnedList.length,
      })
    } catch {
      this.setData({
        latestList: [],
        featuredList: [],
        fileList: [],
        answerList: [],
        pinnedList: [],
        showNotices: false,
      })
    }
  },

  async ensurePlanetSession() {
    const session = getStoredSession()

    if (session && session.sessionToken) {
      return session
    }

    try {
      return await ensureWechatSession()
    } catch {
      return null
    }
  },

  updateJoinState(isJoined: boolean) {
    this.setData({
      isJoined,
      joinButtonText: isJoined
        ? '进入星球'
        : `立即加入：${this.data.priceText === '免费' ? '免费' : this.data.priceText}`,
    })
  },

  async syncMembershipState(planetId: string, fallbackJoined: boolean) {
    const session = await this.ensurePlanetSession()

    if (!session || !session.id) {
      this.updateJoinState(fallbackJoined)
      return
    }

    try {
      const response = await fetchMembershipStatus(planetId, session.id)
      const isJoined = Boolean(response.ok && response.data && response.data.isActive)
      this.updateJoinState(isJoined || fallbackJoined)
    } catch {
      this.updateJoinState(fallbackJoined)
    }
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

  onPreviewTap(e: WechatMiniprogram.TouchEvent) {
    const targetPostId = e.currentTarget.dataset.postId || 'pinned_1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${targetPostId}&planetId=${this.data.planetId}`,
    })
  },

  onJoinTap() {
    if (this.data.joinLoading) {
      return
    }

    if (this.data.isJoined) {
      wx.redirectTo({
        url: `/pages/planet/home?id=${this.data.planetId}&name=${encodeURIComponent(this.data.planetName)}&creator=${encodeURIComponent(this.data.creatorName)}&source=joined`,
      })
      return
    }

    wx.showModal({
      title: this.data.priceText === '免费' ? '确认加入星球' : '确认支付加入',
      content:
        this.data.priceText === '免费'
          ? `加入后将进入「${this.data.planetName}」内容流。`
          : `将按 ${this.data.priceText} 支付并加入「${this.data.planetName}」。`,
      confirmText: this.data.priceText === '免费' ? '立即加入' : '确认支付',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        this.setData({
          joinLoading: true,
        })

        wx.showLoading({
          title: this.data.priceText === '免费' ? '加入中' : '支付中',
          mask: true,
        })

        try {
          const session = await this.ensurePlanetSession()

          if (!session || !session.id) {
            throw new Error('请先完成登录后再加入星球')
          }

          const orderResponse = await createJoinOrder({
            groupId: this.data.planetId,
            userId: session.id,
            paymentChannel: 'WECHAT',
          })

          if (!orderResponse.ok || !orderResponse.data || !orderResponse.data.order) {
            throw new Error('创建加入订单失败')
          }

          const orderNo = orderResponse.data.order.orderNo
          const paymentResponse = await mockJoinPayment({
            orderNo,
            transactionNo: `mock_${Date.now()}`,
            success: true,
          })

          if (!paymentResponse.ok || !paymentResponse.data || !paymentResponse.data.membership) {
            throw new Error('支付成功，但成员激活失败')
          }

          const joinedPlanet = joinPlanet(this.data.planetId)
          if (!joinedPlanet) {
            throw new Error('加入成功，但本地星球状态更新失败')
          }

          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })
          this.updateJoinState(true)

          wx.showToast({
            title: this.data.priceText === '免费' ? '加入成功' : '支付成功',
            icon: 'success',
          })

          wx.redirectTo({
            url: `/pages/planet/home?id=${joinedPlanet.id}&name=${encodeURIComponent(joinedPlanet.name)}&creator=${encodeURIComponent(joinedPlanet.ownerName)}&source=joined`,
          })
        } catch (error) {
          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })
          const message = error instanceof Error ? error.message : '加入失败，请稍后重试'

          if (message.indexOf('已是有效成员') >= 0) {
            const joinedPlanet = joinPlanet(this.data.planetId)
            this.updateJoinState(true)
            wx.showToast({
              title: '你已经加入过了',
              icon: 'none',
            })

            if (joinedPlanet) {
              wx.redirectTo({
                url: `/pages/planet/home?id=${joinedPlanet.id}&name=${encodeURIComponent(joinedPlanet.name)}&creator=${encodeURIComponent(joinedPlanet.ownerName)}&source=joined`,
              })
            }
            return
          }

          wx.showToast({
            title: message,
            icon: 'none',
          })
        }
      },
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
    wx.navigateTo({
      url: `/pages/planet-publish/index?planetId=${this.data.planetId}&planetName=${encodeURIComponent(this.data.planetName)}`,
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
