import { getPlanetById } from '../../utils/planet'

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
  tag: string
  likeCount: string
  commentCount: string
  hasFile?: boolean
  fileName?: string
}

Page({
  data: {
    planetId: 'planet_1',
    planetName: 'Datawhale',
    creatorName: '范大',
    avatarClass: 'avatar-sand',
    showNotices: true,
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
    const planetName = planet?.name || (options.name ? decodeURIComponent(options.name) : 'Datawhale')
    const creatorName = planet?.ownerName || (options.creator ? decodeURIComponent(options.creator) : '范大')
    const avatarClass = planet?.avatarClass || 'avatar-sand'
    const isNewPlanet = !!planet && planet.memberCount <= 1

    this.setData({
      planetId,
      planetName,
      creatorName,
      avatarClass,
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
              tag: '',
              likeCount: '0',
              commentCount: '0',
            },
          ]
        : this.data.latestList,
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
    }
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
