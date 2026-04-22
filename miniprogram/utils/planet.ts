import { getStoredSession } from './auth'
import { normalizePlanetId } from './planet-route'

export type PlanetPublishType = 'normal' | 'question' | 'checkin' | 'homework'

export interface PlanetPost {
  id: string
  planetId?: string
  authorId?: string
  author: string
  avatar: string
  time: string
  title?: string
  content: string
  richContent?: string
  coverImageUrl?: string
  tags: string[]
  images: string[]
  fileAttachments?: PlanetFileAttachment[]
  hasFile?: boolean
  fileName?: string
  publishType?: PlanetPublishType
  checkinStatus?: string
  checkinProgress?: string
  homeworkDeliverable?: string
  homeworkDeadline?: string
  questionTargetId?: string
  questionTargetName?: string
  columnId?: string
  columnTitle?: string
  isPinned?: boolean
  isEssence?: boolean
  likeCount: number
  commentCount: number
  liked: boolean
}

export interface PlanetFileAttachment {
  name: string
  url: string
  sizeText?: string
  mimeType?: string
}

export interface PlanetPinnedPost {
  id: string
  planetId?: string
  author: string
  time: string
  title: string
  content: string
  prefix: string
  avatarClass: string
  images: string[]
  likeCount: number
  commentCount: number
  liked?: boolean
}

export interface PlanetComment {
  id: string
  authorId?: string
  author: string
  time: string
  content: string
}

export interface PlanetProfile {
  id: string
  name: string
  joined?: boolean
  avatarClass: string
  avatarImageUrl: string
  coverImageUrl: string
  unread: string
  badge: string
  price: number
  priceLabel: string
  joinType: 'rolling' | 'calendar'
  isFree: boolean
  requireInviteCode: boolean
  ownerName: string
  ownerTagline: string
  category: string
  intro: string
  embedPath: string
  memberCount: number
  postCount: number
  createdAt: string
}

export interface PlanetCreationPayload {
  name: string
  price: number
  joinType: 'rolling' | 'calendar'
}

export interface PlanetCreationOptions {
  id?: string
  ownerName?: string
  ownerTagline?: string
}

export interface PlanetRemoteProfile {
  id: string
  name: string
  avatarImageUrl?: string
  coverImageUrl?: string
  intro?: string
  price: number
  priceLabel: string
  joinType: 'rolling' | 'calendar'
  isFree: boolean
  requireInviteCode: boolean
  ownerName: string
  ownerTagline?: string
  category?: string
  memberCount: number
  postCount: number
  createdAt: string
  joined?: boolean
  joinedAt?: string
  isPaid?: boolean
  canRefundOnExit?: boolean
  refundAmount?: number
  refundDeadline?: string
}

interface UpsertRemotePlanetsOptions {
  defaultJoined?: boolean
}

interface AddPostPayload {
  planetId?: string
  title?: string
  content: string
  richContent?: string
  coverImageUrl?: string
  tags: string[]
  images: string[]
  fileAttachments?: PlanetFileAttachment[]
  publishType?: PlanetPublishType
  checkinStatus?: string
  checkinProgress?: string
  homeworkDeliverable?: string
  homeworkDeadline?: string
  questionTargetId?: string
  questionTargetName?: string
  columnId?: string
  columnTitle?: string
  author?: string
  avatar?: string
}

interface UpdatePostPayload {
  id: string
  title?: string
  content: string
  richContent?: string
  coverImageUrl?: string
  tags: string[]
  images: string[]
  fileAttachments?: PlanetFileAttachment[]
  publishType?: PlanetPublishType
  checkinStatus?: string
  checkinProgress?: string
  homeworkDeliverable?: string
  homeworkDeadline?: string
  questionTargetId?: string
  questionTargetName?: string
  columnId?: string
  columnTitle?: string
}

const POST_KEY = 'planet_posts_v1'
const PINNED_POST_KEY = 'planet_pinned_posts_v1'
const COMMENT_PREFIX = 'planet_comments_'
const PLANET_KEY = 'planet_profiles_v1'
const SUBSCRIPTION_KEY = 'planet_subscriptions_v1'

const avatarClassPool = ['avatar-sand', 'avatar-sunset', 'avatar-navy', 'avatar-forest']

const getAvatarClass = (index: number) => avatarClassPool[index % avatarClassPool.length]
const DEFAULT_MEMBER_NAME = '当前成员'

const formatPriceLabel = (price: number) => `¥ ${price}/年`
const normalizeLocalPlanetId = (planetId?: string) => normalizePlanetId(planetId)
const normalizePublishType = (publishType?: string): PlanetPublishType =>
  publishType === 'question' || publishType === 'checkin' || publishType === 'homework'
    ? publishType
    : 'normal'
const normalizeFileAttachments = (fileAttachments?: PlanetFileAttachment[]) =>
  Array.isArray(fileAttachments)
    ? fileAttachments
        .map((item) => ({
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '附件资料',
          url: typeof item.url === 'string' ? item.url.trim() : '',
          sizeText: typeof item.sizeText === 'string' ? item.sizeText.trim() : '',
          mimeType: typeof item.mimeType === 'string' ? item.mimeType.trim() : '',
        }))
        .filter((item) => item.url)
        .slice(0, 5)
    : []

const getCurrentUserDisplayName = () => {
  const session = getStoredSession()
  const nickname = session && session.nickname ? session.nickname.trim() : ''
  return nickname || DEFAULT_MEMBER_NAME
}

const getCurrentUserId = () => {
  const session = getStoredSession()
  const userId = session && session.id ? session.id.trim() : ''
  return userId || ''
}

export const resolveAuthorName = (author?: string) => {
  const normalizedAuthor = typeof author === 'string' ? author.trim() : ''
  if (!normalizedAuthor || normalizedAuthor === DEFAULT_MEMBER_NAME) {
    return getCurrentUserDisplayName()
  }
  return normalizedAuthor
}

const seedPosts: PlanetPost[] = [
  {
    id: 'seed_1',
    planetId: 'grp_multi_admin_001',
    author: '管理员周沐',
    avatar: '',
    time: '今天 10:30',
    content: '管理员协作值班表已经更新，今天由管理员处理内容巡检，合伙人负责活动复盘和成员跟进。',
    tags: ['协作', '排班'],
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    ],
    likeCount: 68,
    commentCount: 12,
    liked: false,
  },
  {
    id: 'seed_2',
    planetId: 'grp_datawhale_001',
    author: '活跃成员李雷',
    avatar: '',
    time: '昨天 21:10',
    content: '成员提问：如何把一个选题拆成连续 7 天内容？我想把 AI 工具测评拆成一周连载，请问应该如何安排节奏？',
    tags: ['提问', '内容策划'],
    images: [],
    likeCount: 42,
    commentCount: 7,
    liked: true,
  },
  {
    id: 'seed_3',
    planetId: 'grp_datawhale_001',
    author: '星主A',
    avatar: '',
    time: '03/08 14:05',
    content: '边界数据：高阅读高互动内容复盘。这篇内容用于验证后台对阅读、点赞、评论大数值展示是否稳定。',
    tags: ['复盘', '边界数据'],
    images: [],
    likeCount: 31,
    commentCount: 4,
    liked: false,
  },
]

const seedPinnedPosts: PlanetPinnedPost[] = [
  {
    id: 'pinned_1',
    planetId: 'grp_datawhale_001',
    author: '星主A',
    time: '2026/03/31 09:30',
    title: '欢迎来到 Datawhale AI成长星球',
    content:
      '欢迎来到 Datawhale AI成长星球。\n\n这里主要用于串联小程序端、管理端和后端接口之间的真实 groupId 数据流，也保留了一套可以离线调试的本地内容样本。\n\n如果你当前看到的是本地回退内容，说明接口暂时不可用，但页面结构、跳转关系和互动链路依然可以继续验证。\n\n后续联网后，页面会优先显示真实星球内容、成员身份和内容统计。',
    prefix: '[图片]',
    avatarClass: 'feed-avatar-amber',
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    ],
    likeCount: 95,
    commentCount: 1,
  },
]

const seedPlanets: PlanetProfile[] = [
  {
    id: 'grp_datawhale_001',
    name: 'Datawhale AI成长星球',
    joined: true,
    avatarClass: 'avatar-sand',
    avatarImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
    unread: '',
    badge: '',
    price: 50,
    priceLabel: '¥ 50/年',
    joinType: 'rolling',
    isFree: false,
    requireInviteCode: false,
    ownerName: '星主A',
    ownerTagline: 'Datawhale 星球主理人',
    category: 'AI学习',
    intro: '一个围绕 AI 学习与实践的付费星球',
    embedPath: 'pages/topics/topics?group_id=grp_datawhale_001',
    memberCount: 6,
    postCount: 3,
    createdAt: '2026/03/01',
  },
  {
    id: 'grp_multi_admin_001',
    name: '多管理员协作星球',
    joined: true,
    avatarClass: 'avatar-sunset',
    avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 199,
    priceLabel: '¥ 199/年',
    joinType: 'rolling',
    isFree: false,
    requireInviteCode: false,
    ownerName: '星主A',
    ownerTagline: '多管理员协作演示',
    category: '协作运营',
    intro: '用于验证合伙人、管理员、权限设置和成员协作场景。',
    embedPath: 'pages/topics/topics?group_id=grp_multi_admin_001',
    memberCount: 4,
    postCount: 2,
    createdAt: '2026/03/02',
  },
  {
    id: 'grp_review_001',
    name: '审核流演示星球',
    joined: false,
    avatarClass: 'avatar-navy',
    avatarImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 149,
    priceLabel: '¥ 149/年',
    joinType: 'calendar',
    isFree: false,
    requireInviteCode: false,
    ownerName: '星主A',
    ownerTagline: '审核流程演示',
    category: '内容审核',
    intro: '用于验证内容审核中、已拒绝和已通过的后台视图。',
    embedPath: 'pages/topics/topics?group_id=grp_review_001',
    memberCount: 3,
    postCount: 2,
    createdAt: '2026/03/03',
  },
  {
    id: 'grp_empty_001',
    name: '空内容演示星球',
    joined: false,
    avatarClass: 'avatar-forest',
    avatarImageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 99,
    priceLabel: '¥ 99/年',
    joinType: 'rolling',
    isFree: false,
    requireInviteCode: false,
    ownerName: '星主A',
    ownerTagline: '空状态样本',
    category: '空内容样本',
    intro: '用于验证后台空状态、空列表和默认提示。',
    embedPath: 'pages/topics/topics?group_id=grp_empty_001',
    memberCount: 1,
    postCount: 0,
    createdAt: '2026/03/04',
  },
]

const legacyRemotePlanetAvatarUrlMarker = 'photo-1500648767791-00dcc994a43e'
const seedPlanetIdSet = new Set(seedPlanets.map((planet) => planet.id))

const isLocalPlanetProfile = (planetId: string) => planetId.indexOf('grp_local_') === 0

const normalizePlanetAvatarImageUrl = (planetId: string, avatarImageUrl?: string) => {
  const normalizedAvatarImageUrl = typeof avatarImageUrl === 'string' ? avatarImageUrl.trim() : ''
  if (!normalizedAvatarImageUrl) {
    return ''
  }

  if (seedPlanetIdSet.has(planetId) || isLocalPlanetProfile(planetId)) {
    return normalizedAvatarImageUrl
  }

  return normalizedAvatarImageUrl.indexOf(legacyRemotePlanetAvatarUrlMarker) >= 0 ? '' : normalizedAvatarImageUrl
}

const normalizePosts = (posts: PlanetPost[]) => {
  const seedPostMap = seedPosts.reduce<Record<string, PlanetPost>>((result, post) => {
    result[post.id] = post
    return result
  }, {})

  return posts.map((post) => {
    const seedPost = seedPostMap[post.id]
    if (!seedPost) {
      return {
        ...post,
        planetId: normalizeLocalPlanetId(post.planetId) || '',
        authorId: typeof post.authorId === 'string' ? post.authorId : '',
        title: typeof post.title === 'string' ? post.title : '',
        coverImageUrl: typeof post.coverImageUrl === 'string' ? post.coverImageUrl : '',
        images: Array.isArray(post.images) ? post.images : [],
        fileAttachments: normalizeFileAttachments(post.fileAttachments),
        hasFile: Boolean(post.hasFile) || normalizeFileAttachments(post.fileAttachments).length > 0,
        fileName: typeof post.fileName === 'string' ? post.fileName : '',
        publishType: normalizePublishType(post.publishType),
        checkinStatus: typeof post.checkinStatus === 'string' ? post.checkinStatus : '',
        checkinProgress: typeof post.checkinProgress === 'string' ? post.checkinProgress : '',
        homeworkDeliverable: typeof post.homeworkDeliverable === 'string' ? post.homeworkDeliverable : '',
        homeworkDeadline: typeof post.homeworkDeadline === 'string' ? post.homeworkDeadline : '',
        questionTargetId: typeof post.questionTargetId === 'string' ? post.questionTargetId : '',
        questionTargetName: typeof post.questionTargetName === 'string' ? post.questionTargetName : '',
        columnId: typeof post.columnId === 'string' ? post.columnId : '',
        columnTitle: typeof post.columnTitle === 'string' ? post.columnTitle : '',
        isPinned: !!post.isPinned,
        isEssence: typeof post.isEssence === 'boolean' ? post.isEssence : Number(post.likeCount || 0) >= 30,
      }
    }

    const normalizedFileAttachments = normalizeFileAttachments(post.fileAttachments)
    return {
      ...post,
      planetId: normalizeLocalPlanetId(post.planetId || seedPost.planetId) || '',
      authorId: typeof post.authorId === 'string' ? post.authorId : '',
      title: typeof post.title === 'string' ? post.title : '',
      content: post.content || seedPost.content,
      coverImageUrl: typeof post.coverImageUrl === 'string' ? post.coverImageUrl : '',
      images: Array.isArray(post.images) && post.images.length ? post.images : seedPost.images,
      fileAttachments: normalizedFileAttachments,
      hasFile: Boolean(post.hasFile) || normalizedFileAttachments.length > 0,
      fileName: typeof post.fileName === 'string' ? post.fileName : '',
      publishType: normalizePublishType(post.publishType),
      checkinStatus: typeof post.checkinStatus === 'string' ? post.checkinStatus : '',
      checkinProgress: typeof post.checkinProgress === 'string' ? post.checkinProgress : '',
      homeworkDeliverable: typeof post.homeworkDeliverable === 'string' ? post.homeworkDeliverable : '',
      homeworkDeadline: typeof post.homeworkDeadline === 'string' ? post.homeworkDeadline : '',
      questionTargetId: typeof post.questionTargetId === 'string' ? post.questionTargetId : '',
      questionTargetName: typeof post.questionTargetName === 'string' ? post.questionTargetName : '',
      columnId: typeof post.columnId === 'string' ? post.columnId : '',
      columnTitle: typeof post.columnTitle === 'string' ? post.columnTitle : '',
      isPinned: !!post.isPinned,
      isEssence: typeof post.isEssence === 'boolean' ? post.isEssence : Number(post.likeCount || seedPost.likeCount || 0) >= 30,
    }
  })
}

const formatDateTime = (time: number) => {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

export const loadPosts = () => {
  const stored = wx.getStorageSync(POST_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    wx.setStorageSync(POST_KEY, seedPosts)
    return [...seedPosts]
  }
  const normalizedPosts = normalizePosts(stored as PlanetPost[])
  wx.setStorageSync(POST_KEY, normalizedPosts)
  return normalizedPosts
}

export const loadPinnedPosts = () => {
  const stored = wx.getStorageSync(PINNED_POST_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    wx.setStorageSync(PINNED_POST_KEY, seedPinnedPosts)
    return [...seedPinnedPosts]
  }
  return (stored as PlanetPinnedPost[]).map((post) => ({
    ...post,
    planetId: normalizeLocalPlanetId(post.planetId) || '',
    liked: !!post.liked,
  }))
}

const loadPlanetSubscriptions = () => {
  const stored = wx.getStorageSync(SUBSCRIPTION_KEY)
  if (!stored || typeof stored !== 'object') {
    return {} as Record<string, boolean>
  }

  return Object.keys(stored as Record<string, unknown>).reduce<Record<string, boolean>>((result, key) => {
    const normalizedKey = normalizeLocalPlanetId(key) || String(key || '').trim()
    if (!normalizedKey) {
      return result
    }

    result[normalizedKey] = !!(stored as Record<string, unknown>)[key]
    return result
  }, {})
}

const savePlanetSubscriptions = (subscriptions: Record<string, boolean>) => {
  wx.setStorageSync(SUBSCRIPTION_KEY, subscriptions)
}

const clearPlanetSubscription = (planetId: string) => {
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  if (!resolvedPlanetId) {
    return
  }

  const subscriptions = loadPlanetSubscriptions()
  if (!Object.prototype.hasOwnProperty.call(subscriptions, resolvedPlanetId)) {
    return
  }

  const nextSubscriptions = {
    ...subscriptions,
  }
  delete nextSubscriptions[resolvedPlanetId]
  savePlanetSubscriptions(nextSubscriptions)
}

export const getPinnedPostById = (postId: string) => {
  const pinnedPosts = loadPinnedPosts()
  return pinnedPosts.find((post) => post.id === postId)
}

export const savePinnedPosts = (posts: PlanetPinnedPost[]) => {
  wx.setStorageSync(PINNED_POST_KEY, posts)
}

export const loadPlanets = () => {
  const stored = wx.getStorageSync(PLANET_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    wx.setStorageSync(PLANET_KEY, seedPlanets)
    return [...seedPlanets]
  }
  const normalizedPlanets = (stored as PlanetProfile[]).reduce<PlanetProfile[]>((result, planet, index) => {
    const normalizedPlanetId = normalizeLocalPlanetId(planet.id) || String(planet.id || '').trim()
    if (!normalizedPlanetId || result.some((item) => item.id === normalizedPlanetId)) {
      return result
    }

    result.push({
      ...planet,
      id: normalizedPlanetId,
      embedPath:
        typeof planet.embedPath === 'string' && planet.embedPath.trim()
          ? planet.embedPath
          : `pages/topics/topics?group_id=${normalizedPlanetId}`,
      avatarClass: planet.avatarClass || getAvatarClass(index),
      avatarImageUrl: normalizePlanetAvatarImageUrl(normalizedPlanetId, planet.avatarImageUrl),
      joined: typeof planet.joined === 'boolean' ? planet.joined : true,
    })
    return result
  }, [])
  wx.setStorageSync(PLANET_KEY, normalizedPlanets)
  return normalizedPlanets
}

export const savePlanets = (planets: PlanetProfile[]) => {
  wx.setStorageSync(PLANET_KEY, planets)
}

export const upsertRemotePlanets = (
  remotePlanets: PlanetRemoteProfile[],
  options: UpsertRemotePlanetsOptions = {}
) => {
  const defaultJoined = typeof options.defaultJoined === 'boolean' ? options.defaultJoined : true
  const localPlanets = loadPlanets()
  const localPlanetMap = localPlanets.reduce<Record<string, PlanetProfile>>((result, planet, index) => {
    result[planet.id] = {
      ...planet,
      avatarClass: planet.avatarClass || getAvatarClass(index),
      joined: typeof planet.joined === 'boolean' ? planet.joined : true,
    }
    return result
  }, {})

  const mergedRemotePlanets = remotePlanets.map((planet, index) => {
    const localPlanet = localPlanetMap[planet.id]
    const localAvatarClass = localPlanet ? localPlanet.avatarClass : ''
    const localAvatarImageUrl = localPlanet ? localPlanet.avatarImageUrl : ''
    const localCoverImageUrl = localPlanet ? localPlanet.coverImageUrl : ''
    const localUnread = localPlanet ? localPlanet.unread : ''
    const localBadge = localPlanet ? localPlanet.badge : ''
    const localOwnerTagline = localPlanet ? localPlanet.ownerTagline : ''
    const localCategory = localPlanet ? localPlanet.category : ''
    const localIntro = localPlanet ? localPlanet.intro : ''
    const localEmbedPath = localPlanet ? localPlanet.embedPath : ''
    const localJoined = localPlanet ? localPlanet.joined : undefined
    const hasRemoteAvatarImageUrl = Object.prototype.hasOwnProperty.call(planet, 'avatarImageUrl')

    return {
      id: planet.id,
      name: planet.name,
      joined:
        typeof planet.joined === 'boolean'
          ? planet.joined
          : defaultJoined === false
            ? false
            : typeof localJoined === 'boolean'
              ? localJoined
              : defaultJoined,
      avatarClass: localAvatarClass || getAvatarClass(index),
      avatarImageUrl: hasRemoteAvatarImageUrl
        ? normalizePlanetAvatarImageUrl(planet.id, planet.avatarImageUrl)
        : normalizePlanetAvatarImageUrl(planet.id, localAvatarImageUrl),
      coverImageUrl: planet.coverImageUrl || localCoverImageUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
      unread: localUnread || '',
      badge: localBadge || '',
      price: planet.price,
      priceLabel: planet.priceLabel,
      joinType: planet.joinType,
      isFree: planet.isFree,
      requireInviteCode: planet.requireInviteCode,
      ownerName: planet.ownerName,
      ownerTagline: planet.ownerTagline || localOwnerTagline || '',
      category: planet.category || localCategory || '其他',
      intro: planet.intro || localIntro || `欢迎加入「${planet.name}」，这里会持续分享精选内容、答疑和社群互动。`,
      embedPath: localEmbedPath || `pages/topics/topics?group_id=${planet.id}`,
      memberCount: planet.memberCount,
      postCount: planet.postCount,
      createdAt: planet.createdAt,
    } as PlanetProfile
  })

  const remotePlanetIds = new Set(mergedRemotePlanets.map((planet) => planet.id))
  const preservedLocalPlanets = localPlanets.filter((planet) => !remotePlanetIds.has(planet.id))
  const nextPlanets = [...mergedRemotePlanets, ...preservedLocalPlanets]

  savePlanets(nextPlanets)
  return nextPlanets
}

export const getPlanetById = (planetId: string) => {
  const planets = loadPlanets()
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  return planets.find((planet) => planet.id === resolvedPlanetId)
}

export const isPlanetOwnedByCurrentUser = (planet: PlanetProfile | null) => {
  if (!planet) {
    return false
  }

  const session = getStoredSession()
  const currentNickname = session && session.nickname ? session.nickname.trim() : ''
  const ownerName = String(planet.ownerName || '').trim()
  return planet.id.indexOf('grp_local_') === 0 || Boolean(currentNickname && ownerName === currentNickname)
}

export const getLocalPlanetSubscriptionEnabled = (planetId: string) => {
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  if (!resolvedPlanetId) {
    return false
  }

  const subscriptions = loadPlanetSubscriptions()
  return !!subscriptions[resolvedPlanetId]
}

export const updateLocalPlanetSubscription = (planetId: string, enabled: boolean) => {
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  if (!resolvedPlanetId) {
    return false
  }

  const subscriptions = loadPlanetSubscriptions()
  const nextSubscriptions = {
    ...subscriptions,
    [resolvedPlanetId]: !!enabled,
  }
  savePlanetSubscriptions(nextSubscriptions)
  return !!nextSubscriptions[resolvedPlanetId]
}

export const joinPlanet = (planetId: string): PlanetProfile | null => {
  const planets = loadPlanets()
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  let joinedPlanet: PlanetProfile | null = null

  const nextPlanets = planets.map((planet) => {
    if (planet.id !== resolvedPlanetId) {
      return planet
    }

    joinedPlanet = {
      ...planet,
      joined: true,
      memberCount: planet.memberCount + 1,
    }

    return joinedPlanet
  })

  if (!joinedPlanet) {
    return null
  }

  savePlanets(nextPlanets)
  return joinedPlanet
}

export const leavePlanet = (planetId: string): PlanetProfile | null => {
  const planets = loadPlanets()
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  let leftPlanet: PlanetProfile | null = null

  const nextPlanets = planets.map((planet) => {
    if (planet.id !== resolvedPlanetId) {
      return planet
    }

    leftPlanet = {
      ...planet,
      joined: false,
      memberCount: Math.max(Number(planet.memberCount || 0) - 1, 0),
    }

    return leftPlanet
  })

  if (!leftPlanet) {
    return null
  }

  savePlanets(nextPlanets)
  clearPlanetSubscription(resolvedPlanetId)
  return leftPlanet
}

export const deletePlanet = (planetId: string): PlanetProfile | null => {
  const planets = loadPlanets()
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  const deletedPlanet = planets.find((planet) => planet.id === resolvedPlanetId) || null

  if (!deletedPlanet) {
    return null
  }

  savePlanets(planets.filter((planet) => planet.id !== resolvedPlanetId))
  clearPlanetSubscription(resolvedPlanetId)
  return deletedPlanet
}

export const createPlanet = (payload: PlanetCreationPayload, options: PlanetCreationOptions = {}) => {
  const planets = loadPlanets()
  const now = Date.now()
  const createdPlanetId = options.id || `grp_local_${now}`
  const isFree = payload.price === 0
  const createdPlanet: PlanetProfile = {
    id: createdPlanetId,
    name: payload.name,
    joined: true,
    avatarClass: getAvatarClass(planets.length),
    avatarImageUrl: '',
    coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
    unread: '',
    badge: '',
    price: payload.price,
    priceLabel: isFree ? '免费加入' : formatPriceLabel(payload.price),
    joinType: isFree ? 'rolling' : payload.joinType,
    isFree,
    requireInviteCode: false,
    ownerName: options.ownerName || `${payload.name} 主理人`,
    ownerTagline: options.ownerTagline || '(*^▽^*)o 创建',
    category: '其他',
    intro: isFree
      ? `欢迎加入「${payload.name}」，这里对所有成员免费开放，适合持续分享内容和社群互动。`
      : `欢迎加入「${payload.name}」，这里会持续分享精选内容、答疑和社群互动。`,
    embedPath: `pages/topics/topics?group_id=${createdPlanetId}`,
    memberCount: 1,
    postCount: 1,
    createdAt: formatDateTime(now).slice(0, 10),
  }

  const nextPlanets = [createdPlanet, ...planets.filter((planet) => planet.id !== createdPlanet.id)]
  savePlanets(nextPlanets)
  return createdPlanet
}

export const updateLocalPlanetProfile = (payload: {
  id: string
  name: string
  category: string
  intro: string
  avatarImageUrl?: string
}): PlanetProfile | null => {
  const planets = loadPlanets()
  let updatedPlanet: PlanetProfile | null = null

  const nextPlanets = planets.map((planet) => {
    if (planet.id !== payload.id) {
      return planet
    }

    updatedPlanet = {
      ...planet,
      name: payload.name,
      category: payload.category || '其他',
      intro: payload.intro,
      avatarImageUrl: payload.avatarImageUrl || planet.avatarImageUrl,
    }

    return updatedPlanet
  })

  if (!updatedPlanet) {
    return null
  }

  savePlanets(nextPlanets)
  return updatedPlanet as PlanetProfile
}

export const savePosts = (posts: PlanetPost[]) => {
  wx.setStorageSync(POST_KEY, posts)
}

export const loadPostsByPlanet = (planetId: string) => {
  const posts = loadPosts()
  const resolvedPlanetId = normalizeLocalPlanetId(planetId) || String(planetId || '').trim()
  return posts.filter((post) => !post.planetId || post.planetId === resolvedPlanetId)
}

export const addPost = (payload: AddPostPayload) => {
  const posts = loadPosts()
  const resolvedPlanetId = normalizeLocalPlanetId(payload.planetId) || ''
  const normalizedFileAttachments = normalizeFileAttachments(payload.fileAttachments)
  const newPost: PlanetPost = {
    id: `post_${Date.now()}`,
    planetId: resolvedPlanetId,
    authorId: getCurrentUserId(),
    author: resolveAuthorName(payload.author),
    avatar: payload.avatar || '',
    time: formatDateTime(Date.now()),
    title: typeof payload.title === 'string' ? payload.title.trim() : '',
    content: payload.content,
    richContent: payload.richContent || '',
    coverImageUrl: typeof payload.coverImageUrl === 'string' ? payload.coverImageUrl.trim() : '',
    tags: payload.tags,
    images: payload.images,
    fileAttachments: normalizedFileAttachments,
    hasFile: normalizedFileAttachments.length > 0,
    fileName: normalizedFileAttachments.length ? normalizedFileAttachments[0].name : '',
    publishType: normalizePublishType(payload.publishType),
    checkinStatus: typeof payload.checkinStatus === 'string' ? payload.checkinStatus.trim() : '',
    checkinProgress: typeof payload.checkinProgress === 'string' ? payload.checkinProgress.trim() : '',
    homeworkDeliverable: typeof payload.homeworkDeliverable === 'string' ? payload.homeworkDeliverable.trim() : '',
    homeworkDeadline: typeof payload.homeworkDeadline === 'string' ? payload.homeworkDeadline.trim() : '',
    questionTargetId: typeof payload.questionTargetId === 'string' ? payload.questionTargetId.trim() : '',
    questionTargetName: typeof payload.questionTargetName === 'string' ? payload.questionTargetName.trim() : '',
    columnId: typeof payload.columnId === 'string' ? payload.columnId.trim() : '',
    columnTitle: typeof payload.columnTitle === 'string' ? payload.columnTitle.trim() : '',
    isPinned: false,
    isEssence: false,
    likeCount: 0,
    commentCount: 0,
    liked: false,
  }
  const nextPosts = [newPost, ...posts]
  savePosts(nextPosts)

  if (resolvedPlanetId) {
    const planets = loadPlanets()
    const nextPlanets = planets.map((planet) => {
      if (planet.id !== resolvedPlanetId) {
        return planet
      }

      return {
        ...planet,
        postCount: planet.postCount + 1,
      }
    })
    savePlanets(nextPlanets)
  }

  return newPost
}

export const updatePost = (payload: UpdatePostPayload) => {
  const posts = loadPosts()
  let updatedPost: PlanetPost | null = null
  const normalizedFileAttachments = normalizeFileAttachments(payload.fileAttachments)

  const nextPosts = posts.map((post) => {
    if (post.id !== payload.id) {
      return post
    }

    updatedPost = {
      ...post,
      title: typeof payload.title === 'string' ? payload.title.trim() : '',
      content: payload.content,
      richContent: payload.richContent || '',
      coverImageUrl: typeof payload.coverImageUrl === 'string' ? payload.coverImageUrl.trim() : '',
      tags: payload.tags,
      images: payload.images,
      fileAttachments: normalizedFileAttachments,
      hasFile: normalizedFileAttachments.length > 0,
      fileName: normalizedFileAttachments.length ? normalizedFileAttachments[0].name : '',
      publishType: normalizePublishType(payload.publishType),
      checkinStatus: typeof payload.checkinStatus === 'string' ? payload.checkinStatus.trim() : '',
      checkinProgress: typeof payload.checkinProgress === 'string' ? payload.checkinProgress.trim() : '',
      homeworkDeliverable: typeof payload.homeworkDeliverable === 'string' ? payload.homeworkDeliverable.trim() : '',
      homeworkDeadline: typeof payload.homeworkDeadline === 'string' ? payload.homeworkDeadline.trim() : '',
      questionTargetId: typeof payload.questionTargetId === 'string' ? payload.questionTargetId.trim() : '',
      questionTargetName: typeof payload.questionTargetName === 'string' ? payload.questionTargetName.trim() : '',
      columnId: typeof payload.columnId === 'string' ? payload.columnId.trim() : '',
      columnTitle: typeof payload.columnTitle === 'string' ? payload.columnTitle.trim() : '',
    }

    return updatedPost
  })

  if (!updatedPost) {
    return null
  }

  savePosts(nextPosts)
  return updatedPost
}

const updateStoredPost = (postId: string, updater: (post: PlanetPost) => PlanetPost) => {
  const posts = loadPosts()
  let updatedPost: PlanetPost | null = null

  const nextPosts = posts.map((post) => {
    if (post.id !== postId) {
      return post
    }

    updatedPost = updater(post)
    return updatedPost
  })

  if (!updatedPost) {
    return null
  }

  savePosts(nextPosts)
  return updatedPost
}

export const toggleLocalPostPinned = (postId: string, isPinned: boolean) =>
  updateStoredPost(postId, (post) => ({
    ...post,
    isPinned: !!isPinned,
  }))

export const toggleLocalPostEssence = (postId: string, isEssence: boolean) =>
  updateStoredPost(postId, (post) => ({
    ...post,
    isEssence: !!isEssence,
  }))

export const assignLocalPostColumn = (payload: {
  postId: string
  columnId?: string
  columnTitle?: string
}) =>
  updateStoredPost(payload.postId, (post) => ({
    ...post,
    columnId: typeof payload.columnId === 'string' ? payload.columnId.trim() : '',
    columnTitle: typeof payload.columnTitle === 'string' ? payload.columnTitle.trim() : '',
  }))

export const toggleLike = (postId: string) => {
  const posts = loadPosts()
  const nextPosts = posts.map((post) => {
    if (post.id !== postId) return post
    const liked = !post.liked
    const likeCount = liked ? post.likeCount + 1 : Math.max(0, post.likeCount - 1)
    return { ...post, liked, likeCount }
  })
  const targetPost = nextPosts.find((post) => post.id === postId)

  if (targetPost) {
    savePosts(nextPosts)
    return {
      type: 'post' as const,
      post: targetPost,
    }
  }

  const pinnedPosts = loadPinnedPosts()
  const targetPinnedPost = pinnedPosts.find((post) => post.id === postId)
  if (!targetPinnedPost) {
    return null
  }

  const nextPinnedPosts = pinnedPosts.map((post) => {
    if (post.id !== postId) return post
    const liked = !post.liked
    return {
      ...post,
      liked,
      likeCount: liked ? post.likeCount + 1 : Math.max(0, post.likeCount - 1),
    }
  })
  const updatedPinnedPost = nextPinnedPosts.find((post) => post.id === postId) || targetPinnedPost
  savePinnedPosts(nextPinnedPosts)

  return {
    type: 'pinned' as const,
    post: updatedPinnedPost,
  }
}

export const getPostById = (postId: string) => {
  const posts = loadPosts()
  return posts.find((post) => post.id === postId)
}

export const isPostOwnedByCurrentUser = (post: PlanetPost) => {
  const currentUserId = getCurrentUserId()
  if (currentUserId && post.authorId && post.authorId === currentUserId) {
    return true
  }

  const currentDisplayName = getCurrentUserDisplayName()
  return resolveAuthorName(post.author) === currentDisplayName
}

export const loadComments = (postId: string) => {
  const stored = wx.getStorageSync(`${COMMENT_PREFIX}${postId}`)
  if (!stored || !Array.isArray(stored)) {
    return [] as PlanetComment[]
  }
  return stored as PlanetComment[]
}

export const saveComments = (postId: string, comments: PlanetComment[]) => {
  wx.setStorageSync(`${COMMENT_PREFIX}${postId}`, comments)
}

export const addComment = (postId: string, content: string) => {
  const comments = loadComments(postId)
  const newComment: PlanetComment = {
    id: `c_${Date.now()}`,
    authorId: getCurrentUserId(),
    author: getCurrentUserDisplayName(),
    time: formatDateTime(Date.now()),
    content,
  }
  const nextComments = [...comments, newComment]
  saveComments(postId, nextComments)

  const posts = loadPosts()
  const nextPosts = posts.map((post) => {
    if (post.id !== postId) return post
    return { ...post, commentCount: post.commentCount + 1 }
  })
  const updatedPost = nextPosts.find((post) => post.id === postId)
  if (updatedPost) {
    savePosts(nextPosts)
    return newComment
  }

  const pinnedPosts = loadPinnedPosts()
  const hasPinnedPost = pinnedPosts.some((post) => post.id === postId)
  if (hasPinnedPost) {
    const nextPinnedPosts = pinnedPosts.map((post) => {
      if (post.id !== postId) return post
      return {
        ...post,
        commentCount: post.commentCount + 1,
      }
    })
    savePinnedPosts(nextPinnedPosts)
  }

  return newComment
}
