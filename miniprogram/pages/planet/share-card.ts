import { getPlanetById, PlanetProfile } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { fetchPlanetHome } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'
import { normalizeAssetUrl } from '../../utils/request'

const fallbackPlanet: PlanetProfile = {
  id: 'grp_datawhale_001',
  name: 'Datawhale AI成长星球',
  avatarClass: 'avatar-sunset',
  avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
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
}

type WechatImageInfo = WechatMiniprogram.GetImageInfoSuccessCallbackResult

Page({
  data: {
    planet: fallbackPlanet,
    displayOwnerName: '星主A',
    miniCodeUrl: '',
    miniCodeDisplayUrl: '',
    miniCodeLocalPath: '',
    canvasWidth: 708,
    canvasHeight: 956,
  },

  onLoad(options: Record<string, string>) {
    const planetId = resolvePlanetIdFromOptions(options, ['id', 'planetId', 'groupId'])
    if (!planetId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

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
      miniCodeUrl: '',
      miniCodeDisplayUrl: '',
      miniCodeLocalPath: '',
    })

    void this.syncPlanetCard(planetId)
  },

  async syncPlanetCard(planetId: string) {
    if (!planetId) {
      return
    }

    const session = getStoredSession()
    const localPlanet = getPlanetById(planetId) || this.data.planet || fallbackPlanet

    try {
      const response = await fetchPlanetHome({
        groupId: planetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data || !response.data.group || !response.data.owner) {
        return
      }

      const group = response.data.group
      const owner = response.data.owner
      const priceAmount = Number(group.priceAmount || localPlanet.price || 0)
      const ownerName = String(owner.nickname || localPlanet.ownerName || '星主').replace(/老师$/, '')
      const miniCodeUrl = normalizeAssetUrl(String(group.shareMiniCodeUrl || ''))
      const nextPlanet: PlanetProfile = {
        id: planetId,
        name: String(group.name || localPlanet.name || '饮视星球'),
        avatarClass: localPlanet.avatarClass || 'avatar-sunset',
        avatarImageUrl: normalizeAssetUrl(
          String(group.avatarUrl || owner.avatarUrl || localPlanet.avatarImageUrl || fallbackPlanet.avatarImageUrl)
        ),
        coverImageUrl: normalizeAssetUrl(
          String(group.coverUrl || group.avatarUrl || localPlanet.coverImageUrl || fallbackPlanet.coverImageUrl)
        ),
        unread: localPlanet.unread || '',
        badge: localPlanet.badge || '',
        price: priceAmount,
        priceLabel: group.joinType === 'FREE' ? '免费加入' : `¥ ${priceAmount}/年`,
        joinType: group.billingPeriod === 'YEAR' ? 'rolling' : 'calendar',
        isFree: group.joinType === 'FREE',
        requireInviteCode: group.joinType === 'INVITE_ONLY',
        ownerName,
        ownerTagline: String(owner.bio || localPlanet.ownerTagline || ''),
        category: localPlanet.category || fallbackPlanet.category,
        intro: String(group.intro || localPlanet.intro || ''),
        embedPath: localPlanet.embedPath || fallbackPlanet.embedPath,
        memberCount: Number(group.memberCount || localPlanet.memberCount || 0),
        postCount: Number(group.contentCount || localPlanet.postCount || 0),
        createdAt: String(group.createdAt || localPlanet.createdAt || '').slice(0, 10),
        joined: typeof localPlanet.joined === 'boolean' ? localPlanet.joined : false,
      }

      this.setData({
        planet: nextPlanet,
        displayOwnerName: ownerName,
        miniCodeUrl,
        miniCodeDisplayUrl: miniCodeUrl,
        miniCodeLocalPath: '',
      })

      if (miniCodeUrl) {
        void this.prepareMiniCodeFile(miniCodeUrl)
          .then((localPath) => {
            if (!localPath) {
              return
            }

            this.setData({
              miniCodeDisplayUrl: localPath,
              miniCodeLocalPath: localPath,
            })
          })
          .catch(() => {})
      }
    } catch {
      // 邀请海报优先保证可保存，资料同步失败时保留本地回退数据
    }
  },

  async onSavePoster() {
    wx.showLoading({
      title: '生成中',
      mask: true,
    })

    try {
      const miniCodeSource = await this.ensureMiniCodeCanvasSource()
      const [coverInfo, avatarInfo, miniCodeInfo] = await Promise.all([
        this.getImageInfo(this.data.planet.coverImageUrl),
        this.getImageInfo(this.data.planet.avatarImageUrl),
        miniCodeSource ? this.getImageInfo(miniCodeSource).catch(() => null) : Promise.resolve(null),
      ])

      await this.drawPoster(coverInfo, avatarInfo, miniCodeInfo)

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
      }, this)
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

  prepareMiniCodeFile(src: string) {
    const normalizedSrc = String(src || '').trim()
    if (!normalizedSrc) {
      return Promise.resolve('')
    }

    if (!/^https?:\/\//i.test(normalizedSrc)) {
      return Promise.resolve(normalizedSrc)
    }

    return new Promise<string>((resolve) => {
      wx.downloadFile({
        url: normalizedSrc,
        success: (result) => {
          const statusCode = result && typeof result.statusCode === 'number' ? result.statusCode : 0
          const tempFilePath = result && typeof result.tempFilePath === 'string' ? result.tempFilePath : ''

          if (statusCode >= 200 && statusCode < 300 && tempFilePath) {
            resolve(tempFilePath)
            return
          }

          resolve('')
        },
        fail: () => resolve(''),
      })
    })
  },

  async ensureMiniCodeCanvasSource() {
    if (this.data.miniCodeLocalPath) {
      return this.data.miniCodeLocalPath
    }

    if (!this.data.miniCodeUrl) {
      return ''
    }

    const localPath = await this.prepareMiniCodeFile(this.data.miniCodeUrl)
    if (localPath) {
      this.setData({
        miniCodeDisplayUrl: localPath,
        miniCodeLocalPath: localPath,
      })
      return localPath
    }

    return this.data.miniCodeUrl
  },

  drawPoster(coverInfo: WechatImageInfo, avatarInfo: WechatImageInfo, miniCodeInfo: WechatImageInfo | null) {
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
      ctx.fillText('饮视星球', cardX + 88, cardY + coverHeight + 78)

      ctx.setFillStyle('#c0c0c0')
      ctx.setFontSize(16)
      ctx.fillText('连接一千位铁杆粉丝', cardX + 60, cardY + coverHeight + 116)

      if (miniCodeInfo && miniCodeInfo.path) {
        this.drawMiniCode(ctx, miniCodeInfo.path, cardX + 496, cardY + coverHeight + 34, 104)
      } else {
        this.drawQrRing(ctx, cardX + 548, cardY + coverHeight + 86)
      }

      ctx.draw(false, () => resolve())
    })
  },

  drawMiniCode(
    ctx: WechatMiniprogram.CanvasContext,
    imagePath: string,
    x: number,
    y: number,
    size: number,
  ) {
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(x, y, size, size)
    ctx.drawImage(imagePath, x, y, size, size)
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
