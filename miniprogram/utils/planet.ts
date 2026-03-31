export interface PlanetPost {
  id: string
  author: string
  avatar: string
  time: string
  content: string
  tags: string[]
  images: string[]
  likeCount: number
  commentCount: number
  liked: boolean
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

const POST_KEY = 'planet_posts_v1'
const COMMENT_PREFIX = 'planet_comments_'
const PLANET_KEY = 'planet_profiles_v1'

const avatarClassPool = ['avatar-sand', 'avatar-sunset', 'avatar-navy', 'avatar-forest']

const getAvatarClass = (index: number) => avatarClassPool[index % avatarClassPool.length]

const formatPriceLabel = (price: number) => `¥ ${price}/年`

const seedPosts: PlanetPost[] = [
  {
    id: 'seed_1',
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

const seedPlanets: PlanetProfile[] = [
  {
    id: 'planet_1',
    name: 'Datawhale',
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
        images: Array.isArray(post.images) ? post.images : [],
      }
    }

    return {
      ...post,
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

export const loadPlanets = () => {
  const stored = wx.getStorageSync(PLANET_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    wx.setStorageSync(PLANET_KEY, seedPlanets)
    return [...seedPlanets]
  }
  return stored as PlanetProfile[]
}

export const savePlanets = (planets: PlanetProfile[]) => {
  wx.setStorageSync(PLANET_KEY, planets)
}

export const getPlanetById = (planetId: string) => {
  const planets = loadPlanets()
  return planets.find((planet) => planet.id === planetId)
}

export const createPlanet = (payload: PlanetCreationPayload) => {
  const planets = loadPlanets()
  const now = Date.now()
  const createdPlanet: PlanetProfile = {
    id: `planet_${now}`,
    name: payload.name,
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
    ownerName: `${payload.name} 主理人`,
    ownerTagline: '(*^▽^*)o 创建',
    category: '其他',
    intro: `欢迎加入「${payload.name}」，这里会持续分享精选内容、答疑和社群互动。`,
    embedPath: `pages/topics/topics?group_id=${now}`,
    memberCount: 1,
    postCount: 1,
    createdAt: formatDateTime(now).slice(0, 10),
  }
  savePlanets([createdPlanet, ...planets])
  return createdPlanet
}

export const savePosts = (posts: PlanetPost[]) => {
  wx.setStorageSync(POST_KEY, posts)
}

export const addPost = (content: string, tags: string[], images: string[]) => {
  const posts = loadPosts()
  const newPost: PlanetPost = {
    id: `post_${Date.now()}`,
    author: '当前成员',
    avatar: '',
    time: formatDateTime(Date.now()),
    content,
    tags,
    images,
    likeCount: 0,
    commentCount: 0,
    liked: false,
  }
  const nextPosts = [newPost, ...posts]
  savePosts(nextPosts)
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
  savePosts(nextPosts)
  return nextPosts
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
  savePosts(nextPosts)
  return newComment
}
