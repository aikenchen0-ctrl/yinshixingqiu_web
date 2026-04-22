import { getStoredSession } from '../../utils/auth'
import { appendCheckinPost, joinCheckinChallenge } from '../../utils/checkin'
import { publishPlanetCheckinPost, uploadPlanetImage } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

const MAX_CONTENT_LENGTH = 10000
const MAX_IMAGE_COUNT = 9

type TextareaEventDetail = {
  value?: string
  cursor?: number
}

const buildTodayLabel = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const resolveChallengeTitle = (title: string) => {
  const normalizedTitle = String(title || '').trim()
  if (!normalizedTitle || normalizedTitle === '发布打卡主题') {
    return ''
  }
  return normalizedTitle
}

const resolveCursor = (content: string, cursor: number) => {
  if (!Number.isFinite(cursor)) {
    return content.length
  }
  return Math.max(0, Math.min(cursor, content.length))
}

const insertContentByCursor = (content: string, cursor: number, insertedText: string) => {
  const safeCursor = resolveCursor(content, cursor)
  const nextContent = `${content.slice(0, safeCursor)}${insertedText}${content.slice(safeCursor)}`.slice(0, MAX_CONTENT_LENGTH)
  const nextCursor = Math.min(nextContent.length, safeCursor + insertedText.length)

  return {
    content: nextContent,
    cursor: nextCursor,
  }
}

Page({
  data: {
    challengeId: '',
    groupId: '',
    challengeTitle: '发布打卡主题',
    content: '',
    contentCursor: 0,
    imageList: [] as string[],
    submitting: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const challengeId = options.id || ''
    const groupId = resolvePlanetIdFromOptions(options, ['groupId', 'planetId'])
    if (!challengeId || !groupId) {
      navigateToPlanetIndex('打卡参数缺失')
      return
    }

    this.setData({
      challengeId,
      groupId,
      challengeTitle: options.title ? decodeURIComponent(options.title) : '发布打卡主题',
    })
  },

  onInput(e: WechatMiniprogram.CustomEvent<TextareaEventDetail>) {
    const content = String(e.detail.value || '').slice(0, MAX_CONTENT_LENGTH)
    this.setData({
      content,
      contentCursor: resolveCursor(content, Number(e.detail.cursor)),
    })
  },

  onTextareaBlur(e: WechatMiniprogram.CustomEvent<TextareaEventDetail>) {
    const content = String(this.data.content || '')
    this.setData({
      contentCursor: resolveCursor(content, Number(e.detail.cursor)),
    })
  },

  async onChooseImage() {
    const remainCount = Math.max(0, MAX_IMAGE_COUNT - this.data.imageList.length)
    if (!remainCount) {
      wx.showToast({
        title: '最多添加9张图片',
        icon: 'none',
      })
      return
    }

    try {
      const result = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: remainCount,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })

      const nextImages = (Array.isArray(result.tempFiles) ? result.tempFiles : [])
        .map((item) => item.tempFilePath || '')
        .filter(Boolean)

      this.setData({
        imageList: this.data.imageList.concat(nextImages).slice(0, MAX_IMAGE_COUNT),
      })
    } catch {
      wx.showToast({
        title: '选择图片失败',
        icon: 'none',
      })
    }
  },

  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index)) {
      return
    }

    this.setData({
      imageList: this.data.imageList.filter((_, currentIndex) => currentIndex !== index),
    })
  },

  onPreviewImage(e: WechatMiniprogram.TouchEvent) {
    const current = String(e.currentTarget.dataset.url || '')
    const urls = this.data.imageList.filter(Boolean)
    if (!current || !urls.length) {
      return
    }

    wx.previewImage({
      current,
      urls,
    })
  },

  onCancel() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
      })
      return
    }

    if (this.data.challengeId) {
      wx.redirectTo({
        url: `/pages/planet/checkin-detail?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
      })
      return
    }

    if (this.data.groupId) {
      wx.redirectTo({
        url: `/pages/planet/checkin?groupId=${this.data.groupId}`,
      })
      return
    }

    wx.navigateBack({
      delta: 1,
    })
  },

  applyInsertedContent(insertedText: string) {
    if (!insertedText) {
      return
    }

    const currentContent = String(this.data.content || '')
    const currentCursor = resolveCursor(currentContent, Number(this.data.contentCursor))
    const nextState = insertContentByCursor(currentContent, currentCursor, insertedText)

    this.setData({
      content: nextState.content,
      contentCursor: nextState.cursor,
    })
  },

  onInsertTemplate() {
    const challengeTitle = resolveChallengeTitle(this.data.challengeTitle)
    const challengeLine = challengeTitle ? `#${challengeTitle}#\n` : ''

    this.applyInsertedContent(
      `${challengeLine}日期：${buildTodayLabel()}\n今日目标：\n完成情况：\n遇到问题：\n下一步：\n`
    )
  },

  onInsertMood() {
    const insertOptions = [
      {
        label: '插入推进状态',
        value: '今天状态不错，继续推进。\n',
      },
      {
        label: '插入完成总结',
        value: '今天完成了既定目标，关键结果如下：\n',
      },
      {
        label: '插入问题复盘',
        value: '今天遇到的卡点是：\n我准备这样解决：\n',
      },
    ]

    wx.showActionSheet({
      itemList: insertOptions.map((item) => item.label),
      success: ({ tapIndex }) => {
        const selectedOption = insertOptions[tapIndex]
        if (!selectedOption) {
          return
        }
        this.applyInsertedContent(selectedOption.value)
      },
    })
  },

  onInsertTopic() {
    const challengeTitle = resolveChallengeTitle(this.data.challengeTitle)
    const topicOptions = [`#今日进度#`, '#复盘记录#', '#遇到的问题#']

    if (challengeTitle) {
      topicOptions.unshift(`#${challengeTitle}#`)
    }

    wx.showActionSheet({
      itemList: topicOptions.map((item) => `插入${item}`),
      success: ({ tapIndex }) => {
        const selectedTopic = topicOptions[tapIndex]
        if (!selectedTopic) {
          return
        }
        this.applyInsertedContent(`${selectedTopic} `)
      },
    })
  },

  confirmClearContent() {
    if (!this.data.content) {
      return
    }

    wx.showModal({
      title: '清空正文',
      content: '确认清空当前打卡正文吗？',
      success: ({ confirm }) => {
        if (!confirm) {
          return
        }

        this.setData({
          content: '',
          contentCursor: 0,
        })
      },
    })
  },

  confirmClearImages() {
    if (!this.data.imageList.length) {
      return
    }

    wx.showModal({
      title: '清空图片',
      content: '确认移除当前已选择的全部图片吗？',
      success: ({ confirm }) => {
        if (!confirm) {
          return
        }

        this.setData({
          imageList: [],
        })
      },
    })
  },

  onOpenMoreActions() {
    const challengeTitle = resolveChallengeTitle(this.data.challengeTitle)
    const actionItems = [
      '插入今天日期',
      challengeTitle ? '插入挑战标题' : '',
      this.data.content ? '清空正文' : '',
      this.data.imageList.length ? '清空图片' : '',
    ].filter(Boolean)

    if (!actionItems.length) {
      wx.showToast({
        title: '当前没有更多可操作项',
        icon: 'none',
      })
      return
    }

    wx.showActionSheet({
      itemList: actionItems,
      success: ({ tapIndex }) => {
        const selectedAction = actionItems[tapIndex]
        if (!selectedAction) {
          return
        }

        if (selectedAction === '插入今天日期') {
          this.applyInsertedContent(`日期：${buildTodayLabel()}\n`)
          return
        }

        if (selectedAction === '插入挑战标题') {
          this.applyInsertedContent(`#${challengeTitle}# `)
          return
        }

        if (selectedAction === '清空正文') {
          this.confirmClearContent()
          return
        }

        if (selectedAction === '清空图片') {
          this.confirmClearImages()
        }
      },
    })
  },

  onToolbarTap(e: WechatMiniprogram.TouchEvent) {
    const action = String(e.currentTarget.dataset.action || '')
    if (!action) {
      return
    }

    if (action === 'template') {
      this.onInsertTemplate()
      return
    }

    if (action === 'mood') {
      this.onInsertMood()
      return
    }

    if (action === 'topic') {
      this.onInsertTopic()
      return
    }

    if (action === 'more') {
      this.onOpenMoreActions()
    }
  },

  async onSubmit() {
    const content = this.data.content.trim()
    if (!content && !this.data.imageList.length) {
      wx.showToast({
        title: '先写点今天的打卡内容或上传图片',
        icon: 'none',
      })
      return
    }

    if (this.data.submitting) {
      return
    }

    const session = getStoredSession()
    if (!this.data.challengeId) {
      wx.showToast({
        title: '缺少挑战信息，请返回重试',
        icon: 'none',
      })
      return
    }

    this.setData({
      submitting: true,
    })

    try {
      wx.showLoading({
        title: '发布中',
        mask: true,
      })

      const uploadedImages: string[] = []
      let useLocalFallback = false

      try {
        if (!session || !session.id || !session.sessionToken) {
          throw new Error('使用本地打卡保存')
        }

        for (const imagePath of this.data.imageList) {
          const uploadResponse = await uploadPlanetImage(
            imagePath,
            session.sessionToken
          )

          if (!uploadResponse || !uploadResponse.ok || !uploadResponse.data || !uploadResponse.data.url) {
            throw new Error('图片上传失败，请重试')
          }

          uploadedImages.push(uploadResponse.data.url)
        }

        const response = await publishPlanetCheckinPost({
          challengeId: this.data.challengeId,
          content,
          images: uploadedImages,
          sessionToken: session.sessionToken,
          userId: session.id,
        })

        if (!response || !response.ok) {
          throw new Error('发布打卡失败')
        }
      } catch {
        useLocalFallback = true
        const fallbackImages = uploadedImages.concat(this.data.imageList.slice(uploadedImages.length))
        joinCheckinChallenge(this.data.challengeId)
        appendCheckinPost(this.data.challengeId, {
          content,
          images: fallbackImages,
          authorId: session && session.id ? session.id : '',
          authorName: session && session.nickname ? session.nickname : '',
          authorAvatarUrl: session && session.avatarUrl ? session.avatarUrl : '',
        })
      }

      wx.hideLoading()

      wx.showToast({
        title: useLocalFallback ? '已保存本地打卡' : '打卡已发布',
        icon: 'success',
      })

      setTimeout(() => {
        const pages = getCurrentPages()
        if (pages.length > 1) {
          wx.navigateBack({
            delta: 1,
          })
          return
        }

        wx.redirectTo({
          url: `/pages/planet/checkin-detail?id=${this.data.challengeId}&groupId=${this.data.groupId}`,
        })
      }, 240)
    } catch (error) {
      wx.hideLoading()

      wx.showToast({
        title: error instanceof Error ? error.message : '发布打卡失败',
        icon: 'none',
      })
    } finally {
      this.setData({
        submitting: false,
      })
    }
  },
})
