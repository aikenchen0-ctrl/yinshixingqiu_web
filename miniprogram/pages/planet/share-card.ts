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

type WechatImageInfo = WechatMiniprogram.GetImageInfoSuccessCallbackResult

Page({
  data: {
    planet: fallbackPlanet,
    displayOwnerName: '易安',
    canvasWidth: 708,
    canvasHeight: 956,
  },

  onLoad(options: Record<string, string>) {
    const planetId = options.id || 'planet_2'
    const planet = getPlanetById(planetId)
    const nextPlanet = planet
      ? {
          ...planet,
          ownerName: planet.ownerName.replace(/老师$/, ''),
        }
      : fallbackPlanet

    this.setData({
      planet: nextPlanet,
      displayOwnerName: nextPlanet.ownerName,
    })
  },

  async onSavePoster() {
    wx.showLoading({
      title: '生成中',
      mask: true,
    })

    try {
      const [coverInfo, avatarInfo] = await Promise.all([
        this.getImageInfo(this.data.planet.coverImageUrl),
        this.getImageInfo(this.data.planet.avatarImageUrl),
      ])

      await this.drawPoster(coverInfo, avatarInfo)

      wx.canvasToTempFilePath({
        canvasId: 'sharePosterCanvas',
        success: (canvasRes) => {
          wx.saveImageToPhotosAlbum({
            filePath: canvasRes.tempFilePath,
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
            title: '图片生成失败',
            icon: 'none',
          })
        },
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '图片素材加载失败',
        icon: 'none',
      })
      void error
    }
  },

  getImageInfo(src: string) {
    return new Promise<WechatImageInfo>((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: resolve,
        fail: reject,
      })
    })
  },

  drawPoster(coverInfo: WechatImageInfo, avatarInfo: WechatImageInfo) {
    return new Promise<void>((resolve) => {
      const ctx = wx.createCanvasContext('sharePosterCanvas', this)
      const width = this.data.canvasWidth
      const height = this.data.canvasHeight

      ctx.setFillStyle('#1f1f1f')
      ctx.fillRect(0, 0, width, height)

      const cardX = 36
      const cardY = 140
      const cardWidth = 636
      const coverHeight = 500
      const footerHeight = 180

      ctx.drawImage(coverInfo.path, cardX, cardY, cardWidth, coverHeight)
      ctx.setFillStyle('rgba(0, 0, 0, 0.18)')
      ctx.fillRect(cardX, cardY, cardWidth, coverHeight)

      const avatarSize = 110
      const avatarX = cardX + (cardWidth - avatarSize) / 2
      const avatarY = cardY + 112
      ctx.save()
      ctx.beginPath()
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(avatarInfo.path, avatarX, avatarY, avatarSize, avatarSize)
      ctx.restore()
      ctx.setStrokeStyle('#ffffff')
      ctx.setLineWidth(4)
      ctx.beginPath()
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.stroke()

      ctx.setFillStyle('#ffffff')
      ctx.setFontSize(24)
      ctx.setTextAlign('center')
      ctx.fillText(this.data.planet.name, cardX + cardWidth / 2, cardY + 290)

      ctx.setFontSize(16)
      ctx.fillText(this.data.displayOwnerName, cardX + cardWidth / 2, cardY + 340)

      ctx.setFillStyle('#ffffff')
      ctx.fillRect(cardX, cardY + coverHeight, cardWidth, footerHeight)

      ctx.setFillStyle('#23c6b5')
      ctx.beginPath()
      ctx.arc(cardX + 68, cardY + coverHeight + 70, 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.setFillStyle('#22c6b6')
      ctx.setFontSize(20)
      ctx.setTextAlign('left')
      ctx.fillText('知识星球', cardX + 88, cardY + coverHeight + 78)

      ctx.setFillStyle('#c0c0c0')
      ctx.setFontSize(16)
      ctx.fillText('连接一千位铁杆粉丝', cardX + 60, cardY + coverHeight + 116)

      this.drawQrRing(ctx, cardX + 548, cardY + coverHeight + 86)

      ctx.draw(false, () => resolve())
    })
  },

  drawQrRing(
    ctx: WechatMiniprogram.CanvasContext,
    centerX: number,
    centerY: number,
  ) {
    ctx.setStrokeStyle('#111111')
    ctx.setLineWidth(2)
    for (let index = 0; index < 26; index += 1) {
      const angle = (Math.PI * 2 * index) / 26
      const startRadius = 34
      const endRadius = index % 3 === 0 ? 48 : 44
      const startX = centerX + Math.cos(angle) * startRadius
      const startY = centerY + Math.sin(angle) * startRadius
      const endX = centerX + Math.cos(angle) * endRadius
      const endY = centerY + Math.sin(angle) * endRadius
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    }

    ctx.setStrokeStyle('#1fc8b7')
    ctx.setLineWidth(8)
    ctx.beginPath()
    ctx.arc(centerX, centerY, 18, 0.2 * Math.PI, 1.8 * Math.PI)
    ctx.stroke()

    ctx.setFillStyle('#ffffff')
    ctx.beginPath()
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.setFillStyle('#1fc8b7')
    ctx.fillRect(centerX + 18, centerY + 18, 12, 12)
    ctx.setFillStyle('#8ddf8f')
    ctx.beginPath()
    ctx.arc(centerX + 24, centerY + 24, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.setFillStyle('#1fc8b7')
    ctx.setFontSize(10)
    ctx.setTextAlign('center')
    ctx.fillText('S', centerX + 24, centerY + 27)
  },
})
