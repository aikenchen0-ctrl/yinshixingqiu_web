import { getPlanetById, getPinnedPostById, getPostById } from '../../utils/planet'

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
  id: 'planet_2',
  name: '易安AI编程·出海赚钱',
  ownerName: '易安',
}

const fallbackPost: PosterPostView = {
  id: 'seed_2',
  author: '易安',
  time: '2024/8/2 20:02',
  content:
    '新来的朋友，大家好，欢迎来到我的领空！\n\n正如其名，这里是记录AI副业的一个地方，大家可以下载一下「知识星球」APP，使用体验会更加好！\n\n易安最新产品清单：\nhttps://ziby0nwxdov.feishu.cn/sheets/DoWEs1UmohKiwvvtQeh1cF4rLnH1\n\n这是我创建的免费星球，但是我也会认真的去对待，为大家提供物超所值的干货，希望有机会一起探索第二曲线，一起搞事情。',
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
    const planetId = options.planetId || 'planet_2'
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

  generatePoster() {
    wx.showLoading({
      title: '生成中',
      mask: true,
    })

    const { post } = this.data
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
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
