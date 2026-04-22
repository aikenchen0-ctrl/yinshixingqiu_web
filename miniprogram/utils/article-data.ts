export type ArticleAccessType = 'free' | 'paid'
export type ArticlePreviewMode = 'paragraph' | 'ratio'
export type ArticleReadState = 'free' | 'paid_locked' | 'paid_unlocked'
export type ArticlePrimaryMarkClass = 'is-free' | 'is-paid'
export type ArticleStatusClass = 'is-free' | 'is-locked' | 'is-unlocked' | 'is-updated'
export type ArticleContentSource = 'wechat' | 'planet'

export interface ArticlePlanetCard {
  id: string
  name: string
  creator?: string
  avatar: string
  intro: string
  meta: string
}

export interface ArticleAccessProfile {
  accessType: ArticleAccessType
  priceAmount: number
  priceLabel: string
  originPriceAmount?: number
  originPriceLabel?: string
  isUnlocked: boolean
  previewMode: ArticlePreviewMode
  previewValue: number
}

export interface ArticleReadPresentation {
  readState: ArticleReadState
  primaryMarkText: string
  primaryMarkClass: ArticlePrimaryMarkClass
  statusLabel: string
  statusClass: ArticleStatusClass
  unlockLabel: string
  detailHint: string
  canReadFull: boolean
}

export interface ArticleRecord {
  id: string
  contentSource: ArticleContentSource
  category: string
  title: string
  summary: string
  author: string
  authorTag?: string
  authorAvatar: string
  time: string
  coverImage: string
  likeCount: number
  commentCount: number
  tags: string[]
  readDuration: string
  wordCount: string
  salesCount: number
  updated: boolean
  sortWeight: number
  access: ArticleAccessProfile
  fullContent: string[]
  previewContent: string[]
  recommendTitle: string
  planetCard: ArticlePlanetCard
}

interface ArticleSeedAccessProfile {
  accessType: ArticleAccessType
  priceAmount: number
  originPriceAmount?: number
  isUnlocked: boolean
  previewMode: ArticlePreviewMode
  previewValue: number
}

interface ArticleSeedRecord extends Omit<ArticleRecord, 'access' | 'previewContent'> {
  access: ArticleSeedAccessProfile
}

const formatPriceLabel = (priceAmount: number) => {
  const normalizedPrice = Number.isFinite(priceAmount) ? Math.max(0, Math.round(priceAmount)) : 0
  return normalizedPrice > 0 ? `¥${normalizedPrice}` : '免费'
}

const buildPreviewContent = (fullContent: string[], access: ArticleSeedAccessProfile) => {
  if (!Array.isArray(fullContent) || fullContent.length === 0) {
    return [] as string[]
  }

  if (access.accessType === 'free' || access.isUnlocked) {
    return [...fullContent]
  }

  if (access.previewMode === 'ratio') {
    const normalizedRatio = Math.max(0.1, Math.min(1, access.previewValue))
    const previewCount = Math.max(1, Math.ceil(fullContent.length * normalizedRatio))
    return fullContent.slice(0, previewCount)
  }

  const previewCount = Math.max(1, Math.floor(access.previewValue))
  return fullContent.slice(0, Math.min(fullContent.length, previewCount))
}

const normalizeAccess = (access: ArticleSeedAccessProfile): ArticleAccessProfile => ({
  accessType: access.accessType,
  priceAmount: access.accessType === 'free' ? 0 : Math.max(0, Math.round(access.priceAmount)),
  priceLabel: access.accessType === 'free' ? '免费' : formatPriceLabel(access.priceAmount),
  originPriceAmount:
    access.accessType === 'paid' && typeof access.originPriceAmount === 'number'
      ? Math.max(0, Math.round(access.originPriceAmount))
      : undefined,
  originPriceLabel:
    access.accessType === 'paid' && typeof access.originPriceAmount === 'number'
      ? formatPriceLabel(access.originPriceAmount)
      : undefined,
  isUnlocked: access.accessType === 'free' ? true : Boolean(access.isUnlocked),
  previewMode: access.previewMode,
  previewValue: access.previewValue,
})

const cloneArticleRecord = (article: ArticleRecord): ArticleRecord => ({
  ...article,
  tags: [...article.tags],
  access: { ...article.access },
  fullContent: [...article.fullContent],
  previewContent: [...article.previewContent],
  planetCard: { ...article.planetCard },
})

const articleSeed: ArticleSeedRecord[] = [
  {
    id: 'a1',
    contentSource: 'wechat',
    category: 'defense',
    title: '高净值资产防护的六层结构',
    summary: '用边界、账户、身份、授权、审计、应急六层视角拆开高净值家庭最容易被忽略的保护缺口。',
    author: '血饮',
    authorTag: '主理人',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/25 09:12',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    likeCount: 0,
    commentCount: 0,
    tags: ['方法论', '防护'],
    readDuration: '12分钟',
    wordCount: '4.2k字',
    salesCount: 328,
    updated: true,
    sortWeight: 98,
    access: {
      accessType: 'paid',
      priceAmount: 49,
      originPriceAmount: 69,
      isUnlocked: false,
      previewMode: 'paragraph',
      previewValue: 2,
    },
    fullContent: [
      '第一层是身份边界。高净值家庭最容易忽视的不是资产本身，而是谁有资格触达资产。家庭成员、助理、财务顾问、法务、外包团队都会形成身份入口，任何一个入口没有收紧，都会把整个资产保护体系拖回脆弱状态。',
      '第二层是账户边界。个人卡、企业账户、代持账户、交易平台账户不能混用，否则审计链路会失真。资产一旦发生异常转移，事后很难快速定位责任人和责任动作。',
      '第三层是授权边界。很多人把“方便”当作长期授权理由，结果留下长期有效、无人复核的高危授权。真正安全的做法不是不给权限，而是让权限具有场景、时间和额度边界。',
      '第四层是审计边界。没有稳定审计记录的资产体系，看起来井井有条，实则经不起一次突发事件。定期回看账户操作、授权变更和异常登录，能够把很多损失拦在发生之前。',
      '第五层是应急边界。出现异常转账、账号失控、身份伪冒时，谁先处理、几分钟内联系谁、哪些账户先冻结，都需要预案。没有预案，损失往往不是发生在攻击那一刻，而是发生在慌乱响应阶段。',
    ],
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'grp_datawhale_001',
      name: 'Datawhale AI成长星球',
      creator: '星主A',
      avatar: 'https://images.unsplash.com/photo-1611095973763-414019e72400?auto=format&fit=crop&w=240&q=80',
      intro:
        '围绕 AI 学习与实践持续沉淀主题内容、专栏、打卡和作业样本，适合验证内容流、成员身份和互动链路。',
      meta: '星主A创建，已有6名成员',
    },
  },
  {
    id: 'a2',
    contentSource: 'wechat',
    category: 'case',
    title: '链上洗钱路径的识别与阻断',
    summary: '结合真实案例梳理资金流拆分、跳转与出金节点，适合做风控案例复盘与告警规则设计。',
    author: '血饮',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/24 21:18',
    coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    likeCount: 3,
    commentCount: 1,
    tags: ['案例拆解', '链上风控'],
    readDuration: '9分钟',
    wordCount: '3.1k字',
    salesCount: 512,
    updated: false,
    sortWeight: 94,
    access: {
      accessType: 'free',
      priceAmount: 0,
      isUnlocked: true,
      previewMode: 'ratio',
      previewValue: 1,
    },
    fullContent: [
      '识别链上洗钱，不是盯住某一个地址，而是要看资金在多个地址之间如何被拆分、混合、跳转和再聚合。单点识别通常只能抓住末梢，无法还原完整路径。',
      '第一步是识别拆分模式。异常资金会在短时间内分散到多个新地址，金额呈现高度接近的批量切分特征。这类动作的目标通常不是交易效率，而是稀释单地址风险。',
      '第二步是识别跳板模式。中间地址的生命周期很短，进入和流出之间几乎没有停留，说明它们更像临时管道而不是正常持仓地址。',
      '第三步是识别出金模式。真正的风险控制，不是看是否发生链上转账，而是看链上链下是否形成闭环。一旦异常链上地址和特定出金渠道反复联动，就可以构造出稳定告警规则。',
      '第四步是动作编排。识别到高风险链路后，系统应自动触发人工复核、额度收紧、二次认证或延迟放行，而不是只打一个风险标签然后结束。',
    ],
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'grp_multi_admin_001',
      name: '多管理员协作星球',
      creator: '星主A',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
      intro: '用于验证合伙人、管理员、权限设置和成员协作场景。',
      meta: '星主A创建，已有4名成员',
    },
  },
  {
    id: 'a3',
    contentSource: 'planet',
    category: 'risk',
    title: '多维风控指标体系设计',
    summary: '从识别、分层到动作编排，给出一套可执行的风险评分框架，便于小团队先搭 MVP。',
    author: '顾城',
    authorAvatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/22 11:20',
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
    likeCount: 6,
    commentCount: 2,
    tags: ['风控', '指标体系'],
    readDuration: '15分钟',
    wordCount: '5.3k字',
    salesCount: 271,
    updated: false,
    sortWeight: 86,
    access: {
      accessType: 'paid',
      priceAmount: 39,
      isUnlocked: true,
      previewMode: 'paragraph',
      previewValue: 2,
    },
    fullContent: [
      '风控指标体系设计的核心，不是把指标越堆越多，而是先回答三个问题：识别什么、用什么动作响应、对哪个业务目标负责。离开业务动作谈指标，只会产出一堆难以消费的数字。',
      '第一层是基础识别指标，例如登录频率、设备变更、交易金额波动、账户关联密度。这一层负责把异常信号尽可能完整地收集上来。',
      '第二层是风险分层指标，把单点信号组合成阶段性判断，例如低风险观察、中风险限流、高风险拦截。没有分层，动作就只能一刀切。',
      '第三层是动作效果指标，用来验证规则是否真的有效，例如误伤率、命中率、人工复核通过率、恢复周期。风控系统如果不能自我校正，很快就会背离业务目标。',
      '第四层是运营反馈指标，把投诉、复议、人工备注等信息拉回规则系统，反向修正参数。这一步决定你的体系是一次性规则，还是可持续迭代的风控产品。',
    ],
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'grp_review_001',
      name: '审核流演示星球',
      creator: '星主A',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
      intro: '用于验证内容审核中、已拒绝和已通过的后台视图。',
      meta: '星主A创建，已有3名成员',
    },
  },
  {
    id: 'a4',
    contentSource: 'planet',
    category: 'ai',
    title: 'AI风控模型的对抗评测',
    summary: '用红队思维验证模型在脏数据、诱导输入和异常样本下的表现，适合做评测基线。',
    author: '启明',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/20 18:08',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    likeCount: 2,
    commentCount: 0,
    tags: ['AI安全', '深度报告'],
    readDuration: '18分钟',
    wordCount: '6.8k字',
    salesCount: 188,
    updated: false,
    sortWeight: 82,
    access: {
      accessType: 'paid',
      priceAmount: 59,
      originPriceAmount: 89,
      isUnlocked: false,
      previewMode: 'ratio',
      previewValue: 0.4,
    },
    fullContent: [
      'AI 风控模型上线后最常见的问题不是准确率下降，而是团队过早相信模型在复杂环境中“自然可靠”。对抗评测的目的，就是故意把模型放进脏数据、误导输入和异常样本里，逼它暴露边界。',
      '第一类测试是脏数据测试，观察字段缺失、字段错位、异常编码对模型输出的影响。很多模型在标准样本上表现优异，一旦输入脏化，输出会迅速失真。',
      '第二类测试是诱导输入测试，重点看是否能通过伪装正常行为骗过风控阈值。攻击者不会按规则出牌，评测体系也不能只围绕正常样本建立。',
      '第三类测试是极端样本测试，例如样本量突然放大、事件频率突然集中、长尾类别异常活跃。真正的线上风险，经常出现在历史样本最少覆盖的位置。',
      '第四类测试是动作联动测试。模型给出风险分数之后，动作系统如何限流、拦截、复核，也应纳入评测。否则你测到的只是一个“会打分的组件”，不是完整的风控链路。',
    ],
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'grp_empty_001',
      name: '空内容演示星球',
      creator: '星主A',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
      intro: '用于验证后台空状态、空列表和默认提示。',
      meta: '星主A创建，已有1名成员',
    },
  },
  {
    id: 'a5',
    contentSource: 'planet',
    category: 'ai',
    title: '大模型应用的权限边界清单',
    summary: '给产品、运营和研发一份可直接拿去排查的权限边界清单，适合上线前做自检。',
    author: '血饮',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/18 08:36',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    likeCount: 4,
    commentCount: 1,
    tags: ['AI安全', '权限治理'],
    readDuration: '10分钟',
    wordCount: '3.8k字',
    salesCount: 143,
    updated: false,
    sortWeight: 77,
    access: {
      accessType: 'paid',
      priceAmount: 29,
      isUnlocked: false,
      previewMode: 'paragraph',
      previewValue: 1,
    },
    fullContent: [
      '大模型应用最容易出问题的不是模型能力，而是权限边界没有被设计清楚。只要系统把“谁可以读、谁可以写、谁可以代操作”这三件事混在一起，后续就一定会在数据和流程上出问题。',
      '第一类边界是数据读取边界。模型是否可以读取敏感知识库、历史会话、业务日志、文件附件，需要分别控制，而不是笼统给一个“可调用知识库”的权限。',
      '第二类边界是动作执行边界。模型能不能发消息、改状态、下单、删数据，必须是显式配置。任何默认放开的执行权限，都会在业务扩张时变成高危入口。',
      '第三类边界是身份冒充边界。模型如果可以代替不同角色输出或执行动作，就需要明确标记代理身份和权限范围，不能让系统把模型响应误认为真实人工操作。',
      '第四类边界是审计留痕边界。所有由模型触发的读取、生成、调用和执行都需要可追溯，否则出了问题只能看到结果，看不到触发链路。',
    ],
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'grp_datawhale_001',
      name: 'Datawhale AI成长星球',
      creator: '星主A',
      avatar: 'https://images.unsplash.com/photo-1611095973763-414019e72400?auto=format&fit=crop&w=240&q=80',
      intro: '持续沉淀 AI 学习资料、项目拆解和权限治理清单。',
      meta: '星主A创建，已有6名成员',
    },
  },
]

const articleCatalog = articleSeed.map<ArticleRecord>((article) => {
  const access = normalizeAccess(article.access)
  return {
    ...article,
    tags: [...article.tags],
    access,
    fullContent: [...article.fullContent],
    previewContent: buildPreviewContent(article.fullContent, article.access),
    planetCard: { ...article.planetCard },
  }
})

const articleMap = articleCatalog.reduce<Record<string, ArticleRecord>>((result, article) => {
  result[article.id] = article
  return result
}, {})

export const loadArticleCatalog = () => articleCatalog.map((article) => cloneArticleRecord(article))

export const getArticleById = (articleId?: string) => {
  const normalizedId = String(articleId || '').trim()
  const matchedArticle = articleMap[normalizedId] || articleCatalog[0]
  return cloneArticleRecord(matchedArticle)
}

export const getArticleReadState = (article: Pick<ArticleRecord, 'access'>): ArticleReadState => {
  if (article.access.accessType === 'free') {
    return 'free'
  }

  return article.access.isUnlocked ? 'paid_unlocked' : 'paid_locked'
}

export const getArticleReadPresentation = (
  article: Pick<ArticleRecord, 'access' | 'updated'>
): ArticleReadPresentation => {
  const readState = getArticleReadState(article)

  if (readState === 'free') {
    return {
      readState,
      primaryMarkText: '免费',
      primaryMarkClass: 'is-free',
      statusLabel: '免费全文',
      statusClass: 'is-free',
      unlockLabel: '免费全文',
      detailHint: '免费全文',
      canReadFull: true,
    }
  }

  if (readState === 'paid_unlocked') {
    const statusLabel = article.updated ? '已更新' : '已解锁'
    return {
      readState,
      primaryMarkText: article.access.priceLabel,
      primaryMarkClass: 'is-paid',
      statusLabel,
      statusClass: article.updated ? 'is-updated' : 'is-unlocked',
      unlockLabel: '已解锁全文',
      detailHint: statusLabel,
      canReadFull: true,
    }
  }

  return {
    readState,
    primaryMarkText: article.access.priceLabel,
    primaryMarkClass: 'is-paid',
    statusLabel: '付费试看',
    statusClass: 'is-locked',
    unlockLabel: '解锁全文',
    detailHint: '付费试看',
    canReadFull: false,
  }
}
