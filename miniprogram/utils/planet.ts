export interface PlanetPost {
  id: string
  planetId?: string
  author: string
  avatar: string
  time: string
  content: string
  richContent?: string
  tags: string[]
  images: string[]
  likeCount: number
  commentCount: number
  liked: boolean
}

export interface PlanetPinnedPost {
  id: string
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
}

interface UpsertRemotePlanetsOptions {
  defaultJoined?: boolean
}

interface AddPostPayload {
  planetId?: string
  content: string
  richContent?: string
  tags: string[]
  images: string[]
  author?: string
  avatar?: string
}

const POST_KEY = 'planet_posts_v1'
const PINNED_POST_KEY = 'planet_pinned_posts_v1'
const COMMENT_PREFIX = 'planet_comments_'
const PLANET_KEY = 'planet_profiles_v1'

const avatarClassPool = ['avatar-sand', 'avatar-sunset', 'avatar-navy', 'avatar-forest']

const getAvatarClass = (index: number) => avatarClassPool[index % avatarClassPool.length]

const formatPriceLabel = (price: number) => `¥ ${price}/年`

const seedPosts: PlanetPost[] = [
  {
    id: 'seed_1',
    planetId: 'planet_2',
    author: '血饮',
    avatar: '',
    time: '今天 10:30',
    content: '官方下场，这实属是偷家了，A普要如何应对',
    tags: ['风控', '链上'],
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
    planetId: 'planet_1',
    author: '情报官',
    avatar: '',
    time: '昨天 21:10',
    content: '整理了黑灰产洗钱路径识别清单，包含高频拆分与聚合特征。',
    tags: ['情报', '案例'],
    images: [],
    likeCount: 42,
    commentCount: 7,
    liked: true,
  },
  {
    id: 'seed_3',
    planetId: 'planet_1',
    author: '安全教官',
    avatar: '',
    time: '03/08 14:05',
    content: '本周直播课将演示AI风控模型的红队评测流程，附基线指标。',
    tags: ['课程', 'AI安全'],
    images: [],
    likeCount: 31,
    commentCount: 4,
    liked: false,
  },
]

const seedPinnedPosts: PlanetPinnedPost[] = [
  {
    id: 'pinned_1',
    author: '易安',
    time: '2026/03/31 09:30',
    title: '新来的朋友，大家好，欢迎来到我的知识星球。',
    content:
      '新来的朋友，大家好，欢迎来到我的知识星球。\n\n正如其名，这里是记录AI副业的一个地方，大家可以下载一下「知识星球」APP，使用体验会更加好！\n\n易安最新产品清单：\nhttps://ziby0nwxodov.feishu.cn/sheets/DoWEs1UmohKiw...\n\n这是我创建的免费星球，但是我也会认真的去对待，为大家提供物超所值的干货，希望有机会一起探索第二曲线，一起搞事情。\n\n星球主要记录我在职场中探索副业的经历，以及我不断成长、付费超6位数学习，所获取到的一些商业洞察，信息差，认知差和好的项目机会。\n\n为了保证分享的信息足够价值，减少无效信息，这个星球仅我和我的合伙人，以及嘉宾可以发起提问，不影响提问、参与打卡、和提交作业，当然大家也可以点赞评论。',
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
    id: 'planet_1',
    name: 'Datawhale',
    joined: true,
    avatarClass: 'avatar-sand',
    avatarImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
    unread: '',
    badge: '',
    price: 0,
    priceLabel: '免费加入',
    joinType: 'rolling',
    isFree: true,
    requireInviteCode: false,
    ownerName: 'Datawhale 团队',
    ownerTagline: '与你同行',
    category: '学习',
    intro: '欢迎来到 Datawhale 星球，这里聚合学习笔记、组队项目与成长交流。',
    embedPath: 'pages/topics/topics?group_id=10001',
    memberCount: 1428,
    postCount: 186,
    createdAt: '2026/03/01',
  },
  {
    id: 'planet_2',
    name: '易安AI编程·出海赚钱',
    joined: true,
    avatarClass: 'avatar-sunset',
    avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 365,
    priceLabel: '¥ 365/年',
    joinType: 'rolling',
    isFree: false,
    requireInviteCode: false,
    ownerName: '易安老师',
    ownerTagline: 'AI 编程实战',
    category: '其他',
    intro: '聚焦 AI 编程、副业出海与项目实操，每周更新案例与方法论。',
    embedPath: 'pages/topics/topics?group_id=88885121521552',
    memberCount: 2360,
    postCount: 512,
    createdAt: '2026/02/18',
  },
  {
    id: 'planet_3',
    name: '洋哥陪你终身成长',
    joined: false,
    avatarClass: 'avatar-navy',
    avatarImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 199,
    priceLabel: '¥ 199/年',
    joinType: 'calendar',
    isFree: false,
    requireInviteCode: false,
    ownerName: '洋哥',
    ownerTagline: '成长教练',
    category: '成长',
    intro: '围绕认知升级、复盘方法和长期主义，持续输出陪伴式内容。',
    embedPath: 'pages/topics/topics?group_id=20002',
    memberCount: 3012,
    postCount: 468,
    createdAt: '2026/01/25',
  },
  {
    id: 'planet_4',
    name: '五竹的成长笔记',
    joined: false,
    avatarClass: 'avatar-forest',
    avatarImageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80',
    unread: '99+',
    badge: '99+',
    price: 129,
    priceLabel: '¥ 129/年',
    joinType: 'rolling',
    isFree: false,
    requireInviteCode: false,
    ownerName: '五竹',
    ownerTagline: '真实成长记录',
    category: '成长',
    intro: '记录成长路径、工作方法和高质量输入输出，适合长期学习者。',
    embedPath: 'pages/topics/topics?group_id=30003',
    memberCount: 1786,
    postCount: 239,
    createdAt: '2026/03/12',
  },
]

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
        planetId: post.planetId || '',
        images: Array.isArray(post.images) ? post.images : [],
      }
    }

    return {
      ...post,
      planetId: post.planetId || seedPost.planetId || '',
      content: post.content || seedPost.content,
      images: Array.isArray(post.images) && post.images.length ? post.images : seedPost.images,
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
    liked: !!post.liked,
  }))
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
  const normalizedPlanets = (stored as PlanetProfile[]).map((planet) => ({
    ...planet,
    joined: typeof planet.joined === 'boolean' ? planet.joined : true,
  }))
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
      avatarImageUrl: planet.avatarImageUrl || localAvatarImageUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
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
  return planets.find((planet) => planet.id === planetId)
}

export const joinPlanet = (planetId: string) => {
  const planets = loadPlanets()
  let joinedPlanet: PlanetProfile | null = null

  const nextPlanets = planets.map((planet) => {
    if (planet.id !== planetId) {
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

export const createPlanet = (payload: PlanetCreationPayload, options: PlanetCreationOptions = {}) => {
  const planets = loadPlanets()
  const now = Date.now()
  const createdPlanet: PlanetProfile = {
    id: options.id || `planet_${now}`,
    name: payload.name,
    joined: true,
    avatarClass: getAvatarClass(planets.length),
    avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
    unread: '',
    badge: '',
    price: payload.price,
    priceLabel: formatPriceLabel(payload.price),
    joinType: payload.joinType,
    isFree: false,
    requireInviteCode: false,
    ownerName: options.ownerName || `${payload.name} 主理人`,
    ownerTagline: options.ownerTagline || '(*^▽^*)o 创建',
    category: '其他',
    intro: `欢迎加入「${payload.name}」，这里会持续分享精选内容、答疑和社群互动。`,
    embedPath: `pages/topics/topics?group_id=${options.id || now}`,
    memberCount: 1,
    postCount: 1,
    createdAt: formatDateTime(now).slice(0, 10),
  }

  const nextPlanets = [createdPlanet, ...planets.filter((planet) => planet.id !== createdPlanet.id)]
  savePlanets(nextPlanets)
  return createdPlanet
}

export const savePosts = (posts: PlanetPost[]) => {
  wx.setStorageSync(POST_KEY, posts)
}

export const loadPostsByPlanet = (planetId: string) => {
  const posts = loadPosts()
  return posts.filter((post) => !post.planetId || post.planetId === planetId)
}

export const addPost = (payload: AddPostPayload) => {
  const posts = loadPosts()
  const newPost: PlanetPost = {
    id: `post_${Date.now()}`,
    planetId: payload.planetId || '',
    author: payload.author || '当前成员',
    avatar: payload.avatar || '',
    time: formatDateTime(Date.now()),
    content: payload.content,
    richContent: payload.richContent || '',
    tags: payload.tags,
    images: payload.images,
    likeCount: 0,
    commentCount: 0,
    liked: false,
  }
  const nextPosts = [newPost, ...posts]
  savePosts(nextPosts)

  if (payload.planetId) {
    const planets = loadPlanets()
    const nextPlanets = planets.map((planet) => {
      if (planet.id !== payload.planetId) {
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
    author: '当前成员',
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
