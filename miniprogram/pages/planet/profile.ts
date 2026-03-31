import { getPlanetById, PlanetProfile } from '../../utils/planet'

type PlanetProfileView = PlanetProfile & {
  introText: string
}

const fallbackPlanet: PlanetProfileView = {
  id: 'planet_2',
  name: '易安AI编程·出海赚钱',
  avatarClass: 'avatar-sunset',
  avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
  unread: '',
  badge: '',
  price: 365,
  priceLabel: '¥ 365/年',
  joinType: 'rolling',
  isFree: false,
  requireInviteCode: false,
  ownerName: '易安老师',
  ownerTagline: 'AI 编程实战',
  category: '其他',
  intro: '易安AI编程，AI副业。不聊技术，只聊技术人如何搞钱，破局，发展人生第二曲线。每日分享关于IT职场破圈心得，认知成长，程序员可做的副业项目，热门项目拆解，副业避坑指南，IP打造，私域运营，前沿AI资讯，AI搞钱风向标等，定期邀请各行业的大佬进行分享！',
  embedPath: 'pages/topics/topics?group_id=88885121521552',
  memberCount: 2360,
  postCount: 512,
  createdAt: '2026/02/18',
  introText:
    '易安AI编程，AI副业。不聊技术，只聊技术人如何搞钱，破局，发展人生第二曲线。每日分享关于IT职场破圈心得，认知成长，程序员可做的副业项目，热门项目拆解，副业避坑指南，IP打造，私域运营，前沿AI资讯，AI搞钱风向标等，定期邀请各行业的大佬进行分享！',
}

Page({
  data: {
    planet: fallbackPlanet,
  },

  onLoad(options: Record<string, string>) {
    const planetId = options.id || 'planet_2'
    const planet = getPlanetById(planetId)

    if (!planet) {
      return
    }

    this.setData({
      planet: {
        ...planet,
        introText:
          planet.id === 'planet_2'
            ? '易安AI编程，AI副业。不聊技术，只聊技术人如何搞钱，破局，发展人生第二曲线。每日分享关于IT职场破圈心得，认知成长，程序员可做的副业项目，热门项目拆解，副业避坑指南，IP打造，私域运营，前沿AI资讯，AI搞钱风向标等，定期邀请各行业的大佬进行分享！'
            : planet.intro,
      },
    })
  },
})
