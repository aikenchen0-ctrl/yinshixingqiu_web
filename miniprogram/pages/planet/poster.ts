import { getPlanetById, getPinnedPostById, getPostById } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { fetchPlanetHome, fetchPlanetPostDetail } from '../../utils/planet-api'
import {
  navigateToPlanetIndex,
  normalizePlanetId,
  rememberActivePlanetId,
  resolvePlanetIdFromOptions,
} from '../../utils/planet-route'

interface PosterPlanetView {
  id: string
  name: string
  ownerName: string
}

interface PosterPostView {
  id: string
  author: string
  time: string
  content: string
}

const fallbackPlanet: PosterPlanetView = {
  id: 'grp_datawhale_001',
  name: 'Datawhale AI成长星球',
  ownerName: '星主A',
}

const fallbackPost: PosterPostView = {
  id: 'seed_2',
  author: '活跃成员李雷',
  time: '2026/03/30 21:10',
  content:
    '成员提问：如何把一个选题拆成连续 7 天内容？\n\n我想把 AI 工具测评拆成一周连载，当前卡在主题拆分、节奏安排和每天输出粒度上。\n\n这个长图兜底内容主要用于在接口失败时继续验证帖子详情、分享和长图生成链路。',
}

const formatPosterTime = (value?: string) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

const wrapTextByWidth = (
  ctx: WechatMiniprogram.CanvasContext,
  text: string,
  maxWidth: number,
) => {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push('')
      return
    }

    let currentLine = ''
    for (let index = 0; index < paragraph.length; index += 1) {
      const nextChar = paragraph[index]
      const candidate = `${currentLine}${nextChar}`
      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = nextChar
      } else {
        currentLine = candidate
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  })

  return lines
}

Page({
  data: {
    canvasWidth: 708,
    canvasHeight: 1400,
    posterTempFilePath: '',
    post: fallbackPost,
    planet: fallbackPlanet,
  },

  onLoad(options: Record<string, string>) {
    const postId = options.id || ''
    const planetId = resolvePlanetIdFromOptions(options, ['planetId', 'groupId'], false)
    if (!postId) {
      navigateToPlanetIndex('帖子参数缺失')
      return
    }

    const post = this.resolvePost(postId)
    const planet = this.resolvePlanet(planetId)

    this.setData(
      {
        post,
        planet,
      },
      () => {
        this.generatePoster()
      },
    )

    void this.syncPosterData(postId, planetId)
  },

  resolvePost(postId: string): PosterPostView {
    const normalPost = getPostById(postId)
    if (normalPost) {
      return {
        id: normalPost.id,
        author: normalPost.author,
        time: normalPost.time,
        content: normalPost.content,
      }
    }

    const pinnedPost = getPinnedPostById(postId)
    if (pinnedPost) {
      return {
        id: pinnedPost.id,
        author: pinnedPost.author,
        time: pinnedPost.time,
        content: pinnedPost.content,
      }
    }

    return fallbackPost
  },

  resolvePlanet(planetId: string): PosterPlanetView {
    const planet = getPlanetById(planetId)
    if (!planet) {
      return fallbackPlanet
    }

    return {
      id: planet.id,
      name: planet.name,
      ownerName: planet.ownerName.replace(/老师$/, ''),
    }
  },

  async syncPosterData(postId: string, planetId: string) {
    if (!postId) {
      return
    }

    const session = getStoredSession()
    const sessionToken = session && session.sessionToken ? session.sessionToken : ''
    let resolvedPlanetId = String(planetId || '').trim()
    let nextPost = this.resolvePost(postId)

    try {
      const postResponse = await fetchPlanetPostDetail(postId, false, sessionToken)
      if (postResponse.ok && postResponse.data) {
        const postData = postResponse.data
        nextPost = {
          id: String(postData.id || postId),
          author:
            postData.author && typeof postData.author === 'object' && typeof postData.author.nickname === 'string'
              ? postData.author.nickname
              : nextPost.author,
          time: formatPosterTime(postData.publishedAt || postData.createdAt || '') || nextPost.time,
          content: String(postData.contentText || postData.summary || postData.title || '').trim() || nextPost.content,
        }

        if (postData.groupId) {
          resolvedPlanetId = normalizePlanetId(postData.groupId)
          rememberActivePlanetId(resolvedPlanetId)
        }
      }
    } catch {
      // 长图页面在帖子详情失败时保留本地帖子兜底
    }

    let nextPlanet = this.resolvePlanet(resolvedPlanetId)

    if (resolvedPlanetId) {
      try {
        const homeResponse = await fetchPlanetHome({
          groupId: resolvedPlanetId,
          sessionToken,
          userId: session && session.id ? session.id : '',
        })

        if (homeResponse.ok && homeResponse.data && homeResponse.data.group && homeResponse.data.owner) {
          nextPlanet = {
            id: resolvedPlanetId,
            name: String(homeResponse.data.group.name || nextPlanet.name || fallbackPlanet.name),
            ownerName: String(homeResponse.data.owner.nickname || nextPlanet.ownerName || fallbackPlanet.ownerName).replace(/老师$/, ''),
          }
        }
      } catch {
        // 长图页面在星球概览失败时保留本地星球兜底
      }
    }

    this.setData(
      {
        post: nextPost,
        planet: nextPlanet,
      },
      () => {
        this.generatePoster()
      },
    )
  },

  generatePoster() {
    wx.showLoading({
      title: '生成中',
      mask: true,
    })

    const { post } = this.data
    const systemInfo = wx.getSystemInfoSync()
    const canvasWidth = Math.min(systemInfo.windowWidth - 32, 708)
    const contentWidth = canvasWidth - 96
    const baseFontSize = 24
    const lineHeight = 42

    const context = wx.createCanvasContext('planetPosterCanvas', this)
    context.setFontSize(baseFontSize)
    const bodyLines = wrapTextByWidth(context, post.content, contentWidth)

    const topSectionHeight = 248
    const bodyHeight = bodyLines.length * lineHeight + 36
    const hintHeight = 110
    const authorCardHeight = 140
    const qrHeight = 340
    const footerHeight = 180
    const canvasHeight = topSectionHeight + bodyHeight + hintHeight + authorCardHeight + qrHeight + footerHeight

    this.setData(
      {
        canvasWidth,
        canvasHeight,
      },
      () => {
        this.drawPoster(bodyLines)
      },
    )
  },

  drawPoster(bodyLines: string[]) {
    const ctx = wx.createCanvasContext('planetPosterCanvas', this)
    const { canvasWidth, canvasHeight, post, planet } = this.data
    const contentLeft = 48
    const contentRight = canvasWidth - 48
    const contentWidth = contentRight - contentLeft

    ctx.setFillStyle('#f7f7f7')
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.setFillStyle('#24c5a7')
    ctx.beginPath()
    ctx.arc(canvasWidth + 18, 24, 82, 0, Math.PI * 2)
    ctx.fill()

    ctx.setFillStyle('#2f2f2f')
    ctx.setFontSize(36)
    ctx.setTextAlign('left')
    ctx.fillText(`来自 ${planet.name}`, contentLeft, 92)

    ctx.setFillStyle('#25c7aa')
    ctx.setFontSize(30)
    ctx.fillText(`${post.author} 的主题`, contentLeft, 158)

    ctx.setFillStyle('#cbcbcb')
    ctx.setFontSize(22)
    ctx.setTextAlign('right')
    ctx.fillText(post.time, contentRight, 158)

    ctx.setStrokeStyle('#ededed')
    ctx.setLineWidth(2)
    ctx.beginPath()
    ctx.moveTo(contentLeft, 188)
    ctx.lineTo(contentRight, 188)
    ctx.stroke()

    let currentY = 242
    ctx.setFillStyle('#575757')
    ctx.setFontSize(24)
    ctx.setTextAlign('left')
    bodyLines.forEach((line) => {
      if (!line) {
        currentY += 20
        return
      }
      ctx.fillText(line, contentLeft, currentY)
      currentY += 42
    })

    currentY += 24
    ctx.setFillStyle('#25c7aa')
    ctx.setFontSize(24)
    ctx.setTextAlign('center')
    ctx.fillText('扫码查看完整内容', canvasWidth / 2, currentY)

    currentY += 44
    this.drawAuthorCard(ctx, contentLeft + 10, currentY, contentWidth - 20, 92)

    currentY += 122
    this.drawQrCode(ctx, (canvasWidth - 264) / 2, currentY, 264, post.id)

    currentY += 300
    ctx.setFillStyle('#d5d5d5')
    ctx.setFontSize(22)
    ctx.setTextAlign('center')
    ctx.fillText('扫一扫上面的二维码图案，加我为朋友。', canvasWidth / 2, currentY)

    currentY += 96
    ctx.setStrokeStyle('#ededed')
    ctx.setLineWidth(2)
    ctx.beginPath()
    ctx.moveTo(contentLeft, currentY)
    ctx.lineTo(contentRight, currentY)
    ctx.stroke()

    currentY += 60
    ctx.setFillStyle('#6e6e6e')
    ctx.setFontSize(24)
    ctx.setTextAlign('left')
    ctx.fillText('长按识别二维码查看完整主题', contentLeft, currentY)

    this.drawQrCode(ctx, canvasWidth - 118, currentY - 40, 72, `${post.id}_mini`)

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'planetPosterCanvas',
        success: (res) => {
          wx.hideLoading()
          this.setData({
            posterTempFilePath: res.tempFilePath,
          })
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({
            title: '长图生成失败',
            icon: 'none',
          })
        },
      }, this)
    })
  },

  drawAuthorCard(
    ctx: WechatMiniprogram.CanvasContext,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const { post } = this.data
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(x, y, width, height)

    ctx.setFillStyle('#f5a236')
    ctx.beginPath()
    ctx.arc(x + 34, y + 34, 34, 0, Math.PI * 2)
    ctx.fill()

    ctx.setFillStyle('#ffffff')
    ctx.setFontSize(26)
    ctx.setTextAlign('center')
    ctx.fillText(post.author.slice(0, 1), x + 34, y + 43)

    ctx.setFillStyle('#2d2d2d')
    ctx.setFontSize(28)
    ctx.setTextAlign('left')
    ctx.fillText(post.author, x + 86, y + 28)

    this.drawRoundRect(ctx, x + 86, y + 42, width - 106, 36, 18, '#ffffff', '#2d2d2d')
    ctx.setFillStyle('#2d2d2d')
    ctx.setFontSize(20)
    ctx.fillText('扫码失败，请加20133213', x + 102, y + 66)

    ctx.setFillStyle('#1f1f1f')
    ctx.fillRect(x + width - 48, y + 49, 24, 24)
    ctx.setStrokeStyle('#ffffff')
    ctx.setLineWidth(2)
    ctx.beginPath()
    ctx.arc(x + width - 38, y + 59, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + width - 34, y + 63)
    ctx.lineTo(x + width - 29, y + 68)
    ctx.stroke()
  },

  drawRoundRect(
    ctx: WechatMiniprogram.CanvasContext,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor: string,
    strokeColor?: string,
  ) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.arcTo(x + width, y, x + width, y + radius, radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
    ctx.lineTo(x + radius, y + height)
    ctx.arcTo(x, y + height, x, y + height - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()

    ctx.setFillStyle(fillColor)
    ctx.fill()

    if (strokeColor) {
      ctx.setStrokeStyle(strokeColor)
      ctx.setLineWidth(2)
      ctx.stroke()
    }
  },

  drawQrCode(
    ctx: WechatMiniprogram.CanvasContext,
    x: number,
    y: number,
    size: number,
    seed: string,
  ) {
    const cellCount = 25
    const padding = Math.floor(size * 0.08)
    const cellSize = (size - padding * 2) / cellCount

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(x, y, size, size)

    for (let row = 0; row < cellCount; row += 1) {
      for (let col = 0; col < cellCount; col += 1) {
        if (this.isFinderArea(row, col, cellCount)) {
          continue
        }

        const hash = (seed.charCodeAt((row + col) % seed.length) + row * 17 + col * 31) % 7
        if (hash < 3) {
          ctx.setFillStyle('#101010')
          ctx.fillRect(
            x + padding + col * cellSize,
            y + padding + row * cellSize,
            cellSize,
            cellSize,
          )
        }
      }
    }

    this.drawFinder(ctx, x + padding, y + padding, cellSize)
    this.drawFinder(ctx, x + padding + (cellCount - 7) * cellSize, y + padding, cellSize)
    this.drawFinder(ctx, x + padding, y + padding + (cellCount - 7) * cellSize, cellSize)
  },

  isFinderArea(row: number, col: number, cellCount: number) {
    const inTopLeft = row < 7 && col < 7
    const inTopRight = row < 7 && col >= cellCount - 7
    const inBottomLeft = row >= cellCount - 7 && col < 7
    return inTopLeft || inTopRight || inBottomLeft
  },

  drawFinder(
    ctx: WechatMiniprogram.CanvasContext,
    x: number,
    y: number,
    cellSize: number,
  ) {
    ctx.setFillStyle('#101010')
    ctx.fillRect(x, y, cellSize * 7, cellSize * 7)
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5)
    ctx.setFillStyle('#101010')
    ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3)
  },

  onSavePoster() {
    if (!this.data.posterTempFilePath) {
      wx.showToast({
        title: '长图还在生成中',
        icon: 'none',
      })
      return
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterTempFilePath,
      success: () => {
        wx.showToast({
          title: '图片已保存',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showModal({
          title: '无法保存图片',
          content: '请允许保存到相册后重试。',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({})
            }
          },
        })
      },
    })
  },
})
