import { getPlanetById, PlanetProfile } from '../../utils/planet'

const fallbackPlanet: PlanetProfile = {
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
  ownerName: '易安',
  ownerTagline: 'AI 编程实战',
  category: '其他',
  intro: '聚焦 AI 编程、副业出海与项目实操，每周更新案例与方法论。',
  embedPath: 'pages/topics/topics?group_id=88885121521552',
  memberCount: 2360,
  postCount: 512,
  createdAt: '2026/02/18',
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
        ownerName: planet.ownerName.replace(/老师$/, ''),
      },
    })
  },

  onCopyPath() {
    wx.setClipboardData({
      data: this.data.planet.embedPath,
    })
  },

  onSavePoster() {
    wx.showLoading({
      title: '保存中',
      mask: true,
    })

    wx.downloadFile({
      url: this.data.planet.coverImageUrl,
      success: (downloadRes) => {
        if (downloadRes.statusCode !== 200) {
          wx.hideLoading()
          wx.showToast({
            title: '图片下载失败',
            icon: 'none',
          })
          return
        }

        wx.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({
              title: '图片已保存',
              icon: 'success',
            })
          },
          fail: () => {
            wx.hideLoading()
            wx.showModal({
              title: '无法保存图片',
              content: '请允许保存到相册后重试。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({})
                }
              },
            })
          },
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '图片下载失败',
          icon: 'none',
        })
      },
    })
  },
})
