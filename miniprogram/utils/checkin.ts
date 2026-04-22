export type CheckinChallengeStatus = 'ongoing' | 'ended' | 'closed'

export interface CheckinAuthor {
  id: string
  name: string
  avatarUrl: string
  isOwner?: boolean
  location?: string
}

export interface CheckinPost {
  id: string
  author: CheckinAuthor
  createdAt: string
  content: string
  images: string[]
  likeCount: number
  commentCount: number
}

export interface CheckinChallengeSeed {
  id: string
  title: string
  status: CheckinChallengeStatus
  dayText: string
  validityText: string
  joinedCount: number
  checkinCount: number
  completedCount: number
  todayCount: number
  todayPercent: number
  description: string
  heroColor: string
  avatarUrls: string[]
  joinedAvatarUrls: string[]
  posts: CheckinPost[]
  groupId?: string
  createdAt?: string
}

export interface CheckinChallengeView extends CheckinChallengeSeed {
  isJoined: boolean
  currentJoinedCount: number
  primaryActionText: string
  primaryActionDisabled: boolean
  canJoin: boolean
  canCheckin: boolean
}

export interface LocalCheckinRankingItem {
  rank: number
  userId: string
  nickname: string
  avatarUrl: string
  value: number
  valueText: string
  isViewer: boolean
}

export interface LocalCheckinRankingPayload {
  challengeId: string
  challengeTitle: string
  streakRanking: LocalCheckinRankingItem[]
  totalRanking: LocalCheckinRankingItem[]
  viewerSummary: {
    streakRank: number
    streakDays: number
    totalRank: number
    totalDays: number
  }
}

export interface LocalCheckinRecordPayload {
  challengeId: string
  challengeTitle: string
  year: number
  month: number
  monthLabel: string
  selectedDay: number
  selectedDateKey: string
  weekdayLabels: string[]
  calendarDays: Array<Record<string, any>>
  progressPercent: number
  streakDays: number
  totalDays: number
  todayChecked: boolean
  selectedDayChecked: boolean
  myPosts: CheckinPost[]
  allPosts: CheckinPost[]
}

interface LocalCheckinAuthorSummary {
  userId: string
  nickname: string
  avatarUrl: string
  dateKeys: Set<string>
}

const CHECKIN_JOINED_STORAGE_KEY = 'planet_checkin_joined_v1'
const CHECKIN_POST_STORAGE_PREFIX = 'planet_checkin_posts_v1_'
const CHECKIN_CHALLENGE_STORAGE_KEY = 'planet_checkin_local_challenges_v1'

const fallbackAuthorAvatar =
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const challengeSeeds: CheckinChallengeSeed[] = [
  {
    id: 'milestone-archive',
    title: '里程碑档案',
    status: 'ongoing',
    dayText: '打卡天数：21天',
    validityText: '长期有效',
    joinedCount: 6,
    checkinCount: 29,
    completedCount: 1,
    todayCount: 0,
    todayPercent: 0,
    description:
      '记录每一次精进的小结果，比如公域知乎达到4级、5级、6级公众号突破100、1000、2000、1w；私域突破更多。',
    heroColor: 'teal',
    avatarUrls: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    ],
    joinedAvatarUrls: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    ],
    posts: [
      {
        id: 'milestone-post-1',
        author: {
          id: 'owner_1',
          name: '星主A',
          avatarUrl:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
          isOwner: true,
          location: '广东',
        },
        createdAt: '2026/03/26 10:12',
        content:
          '这个挑战样本主要用来验证打卡、进度、排行榜和挑战详情页面。最近把内容流、评论和长图链路都串起来了，接下来会继续补齐回退数据和边界状态。',
        images: ['https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80'],
        likeCount: 0,
        commentCount: 0,
      },
      {
        id: 'milestone-post-2',
        author: {
          id: 'guest_1',
          name: 'meperdine',
          avatarUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=200&q=80',
          location: '',
        },
        createdAt: '2026/01/27 14:16',
        content:
          '今天算了下，去年年中定下的长期去做的项目，总收益大概是3W。经过了苍蝇乱撞的一年，终于找到自己的方向。虽然这行也是流量越来越差，也有很多从业者说是49年入国军，但平心而论都2026年了，普通人根本不可能去参与进去任何所谓的红利项目。找到适合自己的，慢慢做就是了。希望今年，能完成自己的一个小目标。',
        images: [],
        likeCount: 0,
        commentCount: 0,
      },
    ],
  },
  {
    id: 'weekly-review',
    title: '周复盘',
    status: 'ongoing',
    dayText: '打卡天数：21天',
    validityText: '长期有效',
    joinedCount: 1,
    checkinCount: 12,
    completedCount: 0,
    todayCount: 0,
    todayPercent: 0,
    description: '每周固定复盘一次，把目标、动作、结果和下周调整写清楚，形成稳定节奏。',
    heroColor: 'mint',
    avatarUrls: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'],
    joinedAvatarUrls: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'],
    posts: [],
  },
  {
    id: 'writing-practice',
    title: '基本功｜刻意练习·短文写作',
    status: 'ongoing',
    dayText: '打卡天数：21天',
    validityText: '长期有效',
    joinedCount: 7,
    checkinCount: 18,
    completedCount: 0,
    todayCount: 1,
    todayPercent: 14,
    description: '固定练习短文表达，把一句话观点拆成更完整的内容，提高输出稳定性。',
    heroColor: 'teal',
    avatarUrls: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    ],
    joinedAvatarUrls: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    ],
    posts: [],
  },
  {
    id: 'private-domain-365',
    title: '私域运营365计划',
    status: 'ongoing',
    dayText: '打卡天数：21天',
    validityText: '长期有效',
    joinedCount: 31,
    checkinCount: 86,
    completedCount: 4,
    todayCount: 3,
    todayPercent: 10,
    description: '围绕私域运营动作做长期打卡，把增长、转化和复盘沉淀下来。',
    heroColor: 'mint',
    avatarUrls: [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    ],
    joinedAvatarUrls: [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    ],
    posts: [],
  },
  {
    id: 'sdk-training',
    title: 'SDK测试训练营',
    status: 'ended',
    dayText: '打卡天数：7天',
    validityText: '打卡已结束',
    joinedCount: 0,
    checkinCount: 7,
    completedCount: 0,
    todayCount: 0,
    todayPercent: 0,
    description: '用于短周期测试的训练营挑战。',
    heroColor: 'mint',
    avatarUrls: [],
    joinedAvatarUrls: [],
    posts: [],
  },
  {
    id: 'zhihu-ring',
    title: '知乎圆环任务挑战',
    status: 'closed',
    dayText: '打卡天数：21天',
    validityText: '打卡已关闭',
    joinedCount: 13,
    checkinCount: 40,
    completedCount: 2,
    todayCount: 0,
    todayPercent: 0,
    description: '阶段性关闭的历史挑战。',
    heroColor: 'teal',
    avatarUrls: [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
    ],
    joinedAvatarUrls: [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
    ],
    posts: [],
  },
]

function safeGetStorage<T>(key: string, fallbackValue: T): T {
  try {
    const value = wx.getStorageSync(key)
    if (value === undefined || value === null || value === '') {
      return fallbackValue
    }
    return value as T
  } catch {
    return fallbackValue
  }
}

function safeSetStorage(key: string, value: unknown) {
  try {
    wx.setStorageSync(key, value)
  } catch {}
}

function padNumber(value: number) {
  return `${value}`.padStart(2, '0')
}

function formatNow() {
  const date = new Date()
  return `${date.getFullYear()}/${padNumber(date.getMonth() + 1)}/${padNumber(date.getDate())} ${padNumber(
    date.getHours()
  )}:${padNumber(date.getMinutes())}`
}

function formatDateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${padNumber(month)}-${padNumber(day)}`
}

function normalizeDateKey(createdAt: string) {
  const matched = String(createdAt || '').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (matched) {
    return `${matched[1]}-${padNumber(Number(matched[2]))}-${padNumber(Number(matched[3]))}`
  }

  const parsedDate = new Date(createdAt)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return formatDateKeyFromParts(parsedDate.getFullYear(), parsedDate.getMonth() + 1, parsedDate.getDate())
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getWeekdayMondayFirst(year: number, month: number, day: number) {
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 ? 6 : weekday - 1
}

function calculateStreakDays(dateInput: Set<string> | string[]) {
  const dateKeys = Array.from(dateInput || []).filter(Boolean).sort()
  if (!dateKeys.length) {
    return 0
  }

  let streak = 1
  for (let index = dateKeys.length - 1; index > 0; index -= 1) {
    const currentDate = new Date(`${dateKeys[index]}T00:00:00`)
    const previousDate = new Date(`${dateKeys[index - 1]}T00:00:00`)
    const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays !== 1) {
      break
    }
    streak += 1
  }

  return streak
}

function getChallengeDayCount(challenge: CheckinChallengeSeed) {
  const matched = String(challenge.dayText || '').match(/(\d+)/)
  return matched ? Number(matched[1]) : 21
}

function getChallengeStatusMeta(status: CheckinChallengeStatus, isJoined: boolean) {
  if (status === 'ended') {
    return {
      primaryActionText: '已结束',
      primaryActionDisabled: true,
      canJoin: false,
      canCheckin: false,
    }
  }

  if (status === 'closed') {
    return {
      primaryActionText: '已关闭',
      primaryActionDisabled: true,
      canJoin: false,
      canCheckin: false,
    }
  }

  return {
    primaryActionText: isJoined ? '去打卡' : '去参加',
    primaryActionDisabled: false,
    canJoin: !isJoined,
    canCheckin: isJoined,
  }
}

function normalizeChallengeSeed(input: Partial<CheckinChallengeSeed>) {
  const status = String(input.status || 'ongoing')
  const normalizedStatus: CheckinChallengeStatus =
    status === 'ended' || status === 'closed' ? status : 'ongoing'

  return {
    id: String(input.id || ''),
    title: String(input.title || '未命名挑战'),
    status: normalizedStatus,
    dayText: String(input.dayText || '打卡天数：21天'),
    validityText: String(input.validityText || '长期有效'),
    joinedCount: Number(input.joinedCount || 0),
    checkinCount: Number(input.checkinCount || 0),
    completedCount: Number(input.completedCount || 0),
    todayCount: Number(input.todayCount || 0),
    todayPercent: Number(input.todayPercent || 0),
    description: String(input.description || ''),
    heroColor: String(input.heroColor || 'teal'),
    avatarUrls: Array.isArray(input.avatarUrls) ? input.avatarUrls.filter(Boolean) : [],
    joinedAvatarUrls: Array.isArray(input.joinedAvatarUrls) ? input.joinedAvatarUrls.filter(Boolean) : [],
    posts: Array.isArray(input.posts) ? input.posts : [],
    groupId: input.groupId ? String(input.groupId) : '',
    createdAt: input.createdAt ? String(input.createdAt) : '',
  }
}

function getLocalCheckinChallenges(groupId?: string) {
  const storedChallenges: CheckinChallengeSeed[] = safeGetStorage<CheckinChallengeSeed[]>(
    CHECKIN_CHALLENGE_STORAGE_KEY,
    []
  )
    .map((item) => normalizeChallengeSeed(item))
    .filter((item) => item.id)

  if (!groupId) {
    return storedChallenges
  }

  return storedChallenges.filter((item) => item.groupId === groupId)
}

function saveLocalCheckinChallenges(challenges: CheckinChallengeSeed[]) {
  safeSetStorage(CHECKIN_CHALLENGE_STORAGE_KEY, challenges)
}

function getAllChallengeSeeds(groupId?: string): CheckinChallengeSeed[] {
  const localChallenges = getLocalCheckinChallenges(groupId)
  return groupId ? localChallenges : [...localChallenges, ...challengeSeeds]
}

function buildChallengeView(challenge: CheckinChallengeSeed): CheckinChallengeView {
  const isJoined = isJoinedCheckinChallenge(challenge.id)
  const currentJoinedCount = challenge.joinedCount + (isJoined ? 1 : 0)
  const statusMeta = getChallengeStatusMeta(challenge.status, isJoined)

  return {
    ...challenge,
    isJoined,
    currentJoinedCount,
    primaryActionText: statusMeta.primaryActionText,
    primaryActionDisabled: statusMeta.primaryActionDisabled,
    canJoin: statusMeta.canJoin,
    canCheckin: statusMeta.canCheckin,
  }
}

function getViewerId(viewerId?: string) {
  return String(viewerId || 'local_current_user')
}

function buildAuthorStats(posts: CheckinPost[]) {
  const statsMap = new Map<string, LocalCheckinAuthorSummary>()

  posts.forEach((post) => {
    const authorId = String(post.author && post.author.id ? post.author.id : '')
    if (!authorId) {
      return
    }

    const dateKey = normalizeDateKey(post.createdAt)
    if (!dateKey) {
      return
    }

    const existing =
      statsMap.get(authorId) ||
      {
        userId: authorId,
        nickname: post.author.name || '当前成员',
        avatarUrl: post.author.avatarUrl || fallbackAuthorAvatar,
        dateKeys: new Set<string>(),
      }

    existing.dateKeys.add(dateKey)
    if (!existing.nickname && post.author.name) {
      existing.nickname = post.author.name
    }
    if (!existing.avatarUrl && post.author.avatarUrl) {
      existing.avatarUrl = post.author.avatarUrl
    }
    statsMap.set(authorId, existing)
  })

  return Array.from(statsMap.values())
}

export function getCheckinChallengeSeedById(challengeId: string) {
  return getAllChallengeSeeds().find((item) => item.id === challengeId) || null
}

export function getJoinedCheckinChallengeIds() {
  return safeGetStorage<string[]>(CHECKIN_JOINED_STORAGE_KEY, [])
}

export function isJoinedCheckinChallenge(challengeId: string) {
  return getJoinedCheckinChallengeIds().indexOf(challengeId) >= 0
}

export function joinCheckinChallenge(challengeId: string) {
  const joinedIds = getJoinedCheckinChallengeIds()
  if (joinedIds.indexOf(challengeId) < 0) {
    safeSetStorage(CHECKIN_JOINED_STORAGE_KEY, joinedIds.concat(challengeId))
  }
}

function getLocalCheckinPosts(challengeId: string) {
  return safeGetStorage<CheckinPost[]>(`${CHECKIN_POST_STORAGE_PREFIX}${challengeId}`, [])
}

export function createLocalCheckinChallenge(payload: {
  groupId?: string
  title: string
  description: string
  dayCount: number
  heroColor?: 'teal' | 'mint'
  creatorAvatarUrl?: string
}) {
  const currentChallenges = getLocalCheckinChallenges()
  const nextChallenge: CheckinChallengeSeed = normalizeChallengeSeed({
    id: `local_checkin_${Date.now()}`,
    groupId: payload.groupId || '',
    title: payload.title.trim(),
    status: 'ongoing',
    dayText: `打卡天数：${Math.max(1, Math.floor(payload.dayCount || 21))}天`,
    validityText: '长期有效',
    joinedCount: 0,
    checkinCount: 0,
    completedCount: 0,
    todayCount: 0,
    todayPercent: 0,
    description: payload.description.trim(),
    heroColor: payload.heroColor === 'mint' ? 'mint' : 'teal',
    avatarUrls: payload.creatorAvatarUrl ? [payload.creatorAvatarUrl] : [],
    joinedAvatarUrls: payload.creatorAvatarUrl ? [payload.creatorAvatarUrl] : [],
    posts: [],
    createdAt: formatNow(),
  })

  saveLocalCheckinChallenges([nextChallenge, ...currentChallenges])
  joinCheckinChallenge(nextChallenge.id)
  return nextChallenge
}

export function appendCheckinPost(
  challengeId: string,
  payload: {
    content: string
    images: string[]
    authorId?: string
    authorName?: string
    authorAvatarUrl?: string
  }
) {
  const currentPosts = getLocalCheckinPosts(challengeId)
  const nextPost: CheckinPost = {
    id: `local_${Date.now()}`,
    author: {
      id: payload.authorId || 'local_current_user',
      name: payload.authorName || '当前成员',
      avatarUrl: payload.authorAvatarUrl || fallbackAuthorAvatar,
    },
    createdAt: formatNow(),
    content: payload.content.trim(),
    images: payload.images.slice(0, 9),
    likeCount: 0,
    commentCount: 0,
  }

  safeSetStorage(`${CHECKIN_POST_STORAGE_PREFIX}${challengeId}`, [nextPost].concat(currentPosts))
}

export function getCheckinChallengePosts(challengeId: string) {
  const challenge = getCheckinChallengeSeedById(challengeId)
  if (!challenge) {
    return getLocalCheckinPosts(challengeId)
  }

  return getLocalCheckinPosts(challengeId).concat(challenge.posts)
}

export function getCheckinChallengeList(options?: {
  status?: CheckinChallengeStatus
  groupId?: string
}) {
  const status = options && options.status ? options.status : ''
  const challengeList = getAllChallengeSeeds(options && options.groupId ? options.groupId : '')
    .map((item) => buildChallengeView(item))
    .filter((item) => !status || item.status === status)

  return challengeList
}

export function getCheckinChallengeDetail(challengeId: string, groupId?: string) {
  const challenge = getCheckinChallengeList({ groupId }).find((item) => item.id === challengeId)
  if (!challenge) {
    return null
  }

  const posts = getCheckinChallengePosts(challengeId)
  const todayKey = normalizeDateKey(formatNow())
  const todayCount =
    challenge.todayCount +
    posts.filter((item) => normalizeDateKey(item.createdAt) === todayKey).length -
    challenge.posts.filter((item) => normalizeDateKey(item.createdAt) === todayKey).length
  const checkinCount = challenge.checkinCount + Math.max(0, posts.length - challenge.posts.length)
  const todayPercent = challenge.currentJoinedCount
    ? Math.floor((todayCount / challenge.currentJoinedCount) * 100)
    : 0

  return {
    ...challenge,
    groupId: challenge.groupId || groupId || '',
    todayCount,
    todayPercent,
    checkinCount,
    posts,
  }
}

export function getLocalCheckinRankings(challengeId: string, viewerId?: string): LocalCheckinRankingPayload | null {
  const challenge = getCheckinChallengeDetail(challengeId)
  if (!challenge) {
    return null
  }

  const authorStats = buildAuthorStats(challenge.posts)
  const resolvedViewerId = getViewerId(viewerId)
  const streakRanking = authorStats
    .slice()
    .sort((first, second) => {
      const streakDiff = calculateStreakDays(second.dateKeys) - calculateStreakDays(first.dateKeys)
      if (streakDiff !== 0) {
        return streakDiff
      }

      const totalDiff = second.dateKeys.size - first.dateKeys.size
      if (totalDiff !== 0) {
        return totalDiff
      }

      return String(first.userId).localeCompare(String(second.userId))
    })
    .map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      nickname: item.nickname,
      avatarUrl: item.avatarUrl || fallbackAuthorAvatar,
      value: calculateStreakDays(item.dateKeys),
      valueText: `${calculateStreakDays(item.dateKeys)}天`,
      isViewer: item.userId === resolvedViewerId,
    }))

  const totalRanking = authorStats
    .slice()
    .sort((first, second) => {
      const totalDiff = second.dateKeys.size - first.dateKeys.size
      if (totalDiff !== 0) {
        return totalDiff
      }

      const streakDiff = calculateStreakDays(second.dateKeys) - calculateStreakDays(first.dateKeys)
      if (streakDiff !== 0) {
        return streakDiff
      }

      return String(first.userId).localeCompare(String(second.userId))
    })
    .map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      nickname: item.nickname,
      avatarUrl: item.avatarUrl || fallbackAuthorAvatar,
      value: item.dateKeys.size,
      valueText: `${item.dateKeys.size}天`,
      isViewer: item.userId === resolvedViewerId,
    }))

  const viewerStreak = streakRanking.find((item) => item.userId === resolvedViewerId) || null
  const viewerTotal = totalRanking.find((item) => item.userId === resolvedViewerId) || null

  return {
    challengeId: challenge.id,
    challengeTitle: challenge.title,
    streakRanking,
    totalRanking,
    viewerSummary: {
      streakRank: viewerStreak ? viewerStreak.rank : 0,
      streakDays: viewerStreak ? viewerStreak.value : 0,
      totalRank: viewerTotal ? viewerTotal.rank : 0,
      totalDays: viewerTotal ? viewerTotal.value : 0,
    },
  }
}

export function getLocalCheckinRecord(
  challengeId: string,
  options?: {
    year?: number
    month?: number
    day?: number
    viewerId?: string
  }
): LocalCheckinRecordPayload | null {
  const challenge = getCheckinChallengeDetail(challengeId)
  if (!challenge) {
    return null
  }

  const resolvedViewerId = getViewerId(options && options.viewerId ? options.viewerId : '')
  const now = new Date()
  const year =
    options && Number.isFinite(Number(options.year)) ? Number(options.year) : now.getFullYear()
  const monthCandidate = options && Number.isFinite(Number(options.month)) ? Number(options.month) : now.getMonth() + 1
  const month = Math.max(1, Math.min(12, monthCandidate))
  const daysInMonth = getDaysInMonth(year, month)
  const dayCandidate = options && Number.isFinite(Number(options.day)) ? Number(options.day) : now.getDate()
  const day = Math.max(1, Math.min(daysInMonth, dayCandidate))
  const selectedDateKey = formatDateKeyFromParts(year, month, day)

  const challengePosts = getCheckinChallengePosts(challengeId)
  const viewerPosts = challengePosts.filter((item) => item.author.id === resolvedViewerId)
  const viewerDateKeys = new Set(viewerPosts.map((item) => normalizeDateKey(item.createdAt)).filter(Boolean))
  const monthMarkedDays = Array.from(viewerDateKeys)
    .filter((item) => item.indexOf(`${year}-${padNumber(month)}-`) === 0)
    .map((item) => Number(item.split('-')[2] || 0))
    .filter((item) => item > 0)
    .sort((first, second) => first - second)

  const allPosts = challengePosts.filter((item) => normalizeDateKey(item.createdAt) === selectedDateKey)
  const myPosts = allPosts.filter((item) => item.author.id === resolvedViewerId)
  const firstWeekday = getWeekdayMondayFirst(year, month, 1)
  const calendarDays: Array<Record<string, any>> = []

  for (let index = 0; index < firstWeekday; index += 1) {
    calendarDays.push({
      day: 0,
      isEmpty: true,
      isMarked: false,
      isSelected: false,
      isToday: false,
    })
  }

  for (let currentDay = 1; currentDay <= daysInMonth; currentDay += 1) {
    const currentDate = new Date(year, month - 1, currentDay)
    calendarDays.push({
      day: currentDay,
      isEmpty: false,
      isMarked: monthMarkedDays.indexOf(currentDay) >= 0,
      isSelected: currentDay === day,
      isToday:
        currentDate.getFullYear() === now.getFullYear() &&
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getDate() === now.getDate(),
    })
  }

  const totalDays = viewerDateKeys.size
  const streakDays = calculateStreakDays(viewerDateKeys)
  const progressPercent = Math.min(100, Math.round((totalDays / getChallengeDayCount(challenge)) * 100))

  return {
    challengeId: challenge.id,
    challengeTitle: challenge.title,
    year,
    month,
    monthLabel: `${year}年${month}月`,
    selectedDay: day,
    selectedDateKey,
    weekdayLabels,
    calendarDays,
    progressPercent,
    streakDays,
    totalDays,
    todayChecked: viewerDateKeys.has(formatDateKeyFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate())),
    selectedDayChecked: viewerDateKeys.has(selectedDateKey),
    myPosts,
    allPosts,
  }
}
