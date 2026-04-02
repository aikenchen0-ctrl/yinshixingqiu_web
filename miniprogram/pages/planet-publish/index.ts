import { getPlanetById } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { createPlanetPost, fetchPlanetPostDetail, updatePlanetPost, uploadPlanetImage } from '../../utils/planet-api'

const PLANET_PUBLISH_REFRESH_KEY = 'planet_publish_refresh_v1'
const legacyPlanetIdMap: Record<string, string> = {
  planet_1: 'grp_datawhale_001',
}

interface EditorStatusPayload {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  header?: string
  list?: string
}

interface PublishPageData {
  planetId: string
  planetName: string
  postId: string
  isEditMode: boolean
  title: string
  tagInput: string
  imagePreviewList: string[]
  editorReady: boolean
  editorHtml: string
  editorText: string
  toolbarStatus: {
    bold: boolean
    italic: boolean
    underline: boolean
    heading: boolean
    bulletList: boolean
  }
  submitting: boolean
  uploadingImages: boolean
}

type EditorContext = WechatMiniprogram.EditorContext

const MAX_TITLE_LENGTH = 40
const MAX_TEXT_LENGTH = 5000

let editorCtx: EditorContext | null = null
let pendingEditorHtml = ''

const resolvePlanetId = (planetId: string) => legacyPlanetIdMap[planetId] || planetId

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripHtml = (html: string) =>
  html
    .replace(/<img[^>]*>/gi, ' [图片] ')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const extractImageUrls = (html: string) => {
  const matched = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []
  const urls = matched
    .map((item) => {
      const srcMatch = item.match(/src=["']([^"']+)["']/i)
      return srcMatch ? srcMatch[1] : ''
    })
    .filter((item) => /^https?:\/\//.test(item))

  return Array.from(new Set(urls)).slice(0, 9)
}

const buildSummary = (title: string, text: string) => {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  if (title && normalizedText) {
    return `${title} ${normalizedText}`.slice(0, 120)
  }
  return (title || normalizedText).slice(0, 120)
}

const toEditorHtml = (value: string) => {
  const content = String(value || '').trim()
  if (!content) {
    return ''
  }

  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content
  }

  return content
    .split(/\n+/)
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('')
}

const stripLeadingTitleFromHtml = (html: string, title: string) => {
  const normalizedTitle = title.trim()
  if (!normalizedTitle || !html) {
    return html
  }

  const headingPattern = new RegExp(
    `^\\s*<(h1|h2|h3|p|div)[^>]*>\\s*${escapeRegExp(escapeHtml(normalizedTitle))}\\s*<\\/\\1>\\s*`,
    'i'
  )
  return html.replace(headingPattern, '').trim()
}

const stripImageTags = (html: string) => html.replace(/<img[^>]*>/gi, '').trim()

const extractImageUrlsFromPost = (post: Record<string, any>, richContent: string) => {
  const attachmentImages = Array.isArray(post.attachments)
    ? post.attachments.filter((item: unknown) => typeof item === 'string' && /^https?:\/\//.test(item))
    : []
  const richImages = extractImageUrls(richContent)
  return Array.from(new Set(attachmentImages.concat(richImages))).slice(0, 9)
}

const parseRemotePostDraft = (post: Record<string, any>) => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const title = typeof post.title === 'string' ? post.title : ''
  const richContent = typeof metadata.richContent === 'string' ? metadata.richContent : ''
  const cleanedHtml = stripImageTags(stripLeadingTitleFromHtml(richContent || toEditorHtml(String(post.contentText || '')), title))

  return {
    title: title.slice(0, MAX_TITLE_LENGTH),
    editorHtml: cleanedHtml,
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item: unknown) => typeof item === 'string') : [],
    images: extractImageUrlsFromPost(post, richContent),
  }
}

Page<PublishPageData>({
  data: {
    planetId: 'grp_datawhale_001',
    planetName: '知识星球',
    postId: '',
    isEditMode: false,
    title: '',
    tagInput: '',
    imagePreviewList: [],
    editorReady: false,
    editorHtml: '',
    editorText: '',
    toolbarStatus: {
      bold: false,
      italic: false,
      underline: false,
      heading: false,
      bulletList: false,
    },
    submitting: false,
    uploadingImages: false,
  },

  async onLoad(options: Record<string, string>) {
    editorCtx = null
    pendingEditorHtml = ''

    const planetId = resolvePlanetId(options.planetId || 'grp_datawhale_001')
    const postId = options.postId || ''
    const currentPlanet = getPlanetById(planetId)
    const planetName =
      options.planetName
        ? decodeURIComponent(options.planetName)
        : currentPlanet && currentPlanet.name
          ? currentPlanet.name
          : '知识星球'

    this.setData({
      planetId,
      planetName,
      postId,
      isEditMode: !!postId,
    })

    if (!postId) {
      return
    }

    try {
      const session = getStoredSession()
      const response = await fetchPlanetPostDetail(postId, false, session && session.sessionToken ? session.sessionToken : '')
      if (!response.ok || !response.data) {
        throw new Error('原帖子不存在')
      }

      const draft = parseRemotePostDraft(response.data)
      pendingEditorHtml = draft.editorHtml

      this.setData({
        title: draft.title,
        tagInput: draft.tags.join(', '),
        imagePreviewList: draft.images,
        editorHtml: draft.editorHtml,
        editorText: stripHtml(draft.editorHtml),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '读取帖子失败',
        icon: 'none',
      })
    }
  },

  onUnload() {
    editorCtx = null
  },

  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      title: e.detail.value.slice(0, MAX_TITLE_LENGTH),
    })
  },

  onTagInput(e: WechatMiniprogram.Input) {
    this.setData({
      tagInput: e.detail.value.slice(0, 60),
    })
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select('#planet-editor')
      .context((res) => {
        const context = res && 'context' in res ? (res.context as EditorContext) : null
        editorCtx = context

        this.setData({
          editorReady: !!context,
        })

        if (context && pendingEditorHtml) {
          context.setContents({
            html: pendingEditorHtml,
          })
          void this.syncEditorContent()
        }
      })
      .exec()
  },

  onEditorInput() {
    void this.syncEditorContent()
  },

  onEditorStatusChange(e: WechatMiniprogram.CustomEvent<EditorStatusPayload>) {
    const status = e.detail || {}

    this.setData({
      toolbarStatus: {
        bold: !!status.bold,
        italic: !!status.italic,
        underline: !!status.underline,
        heading: String(status.header || '').toUpperCase() === 'H2',
        bulletList: status.list === 'bullet',
      },
    })
  },

  async syncEditorContent() {
    if (!editorCtx) {
      return null
    }

    return new Promise<{ html: string; text: string } | null>((resolve) => {
      editorCtx!.getContents({
        success: (res) => {
          const html = (res && res.html ? res.html : '').trim()
          const text = (res && res.text ? res.text : '').trim().slice(0, MAX_TEXT_LENGTH)

          this.setData({
            editorHtml: html,
            editorText: text,
          })

          resolve({
            html,
            text,
          })
        },
        fail: () => resolve(null),
      })
    })
  },

  execFormat(command: string, value?: string) {
    if (!editorCtx) {
      wx.showToast({
        title: '编辑器还没准备好',
        icon: 'none',
      })
      return
    }

    editorCtx.focus()
    editorCtx.format(command, value)
  },

  onToolbarTap(e: WechatMiniprogram.TouchEvent) {
    const command = String(e.currentTarget.dataset.command || '')
    const value = e.currentTarget.dataset.value

    if (!command || !editorCtx) {
      return
    }

    if (command === 'clear') {
      editorCtx.clear({
        success: () => {
          this.setData({
            editorHtml: '',
            editorText: '',
            toolbarStatus: {
              bold: false,
              italic: false,
              underline: false,
              heading: false,
              bulletList: false,
            },
          })
        },
      })
      return
    }

    if (command === 'insertDivider') {
      editorCtx.insertDivider({})
      return
    }

    if (command === 'removeFormat') {
      editorCtx.removeFormat({})
      return
    }

    this.execFormat(command, typeof value === 'string' ? value : undefined)
  },

  async onChooseImages() {
    const session = getStoredSession()
    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    const remainCount = Math.max(0, 9 - this.data.imagePreviewList.length)
    if (!remainCount) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none',
      })
      return
    }

    try {
      const chooseResult = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
        wx.chooseMedia({
          count: remainCount,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        })
      })

      const files = Array.isArray(chooseResult.tempFiles) ? chooseResult.tempFiles : []
      if (!files.length) {
        return
      }

      this.setData({
        uploadingImages: true,
      })

      wx.showLoading({
        title: '上传图片中',
        mask: true,
      })

      const uploadedUrls: string[] = []
      for (const file of files) {
        if (!file.tempFilePath) {
          continue
        }

        const response = await uploadPlanetImage(file.tempFilePath, session.sessionToken)
        if (!response.ok || !response.data || !response.data.url) {
          throw new Error('图片上传失败')
        }
        uploadedUrls.push(response.data.url)
      }

      const imagePreviewList = Array.from(new Set(this.data.imagePreviewList.concat(uploadedUrls))).slice(0, 9)
      this.setData({
        imagePreviewList,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '图片上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({
        uploadingImages: false,
      })
    }
  },

  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index) || index < 0) {
      return
    }

    const nextList = this.data.imagePreviewList.filter((_, currentIndex) => currentIndex !== index)
    this.setData({
      imagePreviewList: nextList,
    })
  },

  async onSubmit() {
    if (this.data.submitting) {
      return
    }

    const session = getStoredSession()
    if (!session || !session.id || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    const editorContent = await this.syncEditorContent()
    const title = this.data.title.trim()
    const editorHtml = editorContent ? editorContent.html : this.data.editorHtml
    const editorText = editorContent ? editorContent.text : this.data.editorText
    const normalizedText = stripHtml(editorHtml || editorText)

    if (!normalizedText) {
      wx.showToast({
        title: '请先填写正文内容',
        icon: 'none',
      })
      return
    }

    const tags = this.data.tagInput
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4)
    const nextImages = this.data.imagePreviewList
    const summary = buildSummary(title, normalizedText)
    const richContent = editorHtml

    this.setData({
      submitting: true,
    })

    try {
      const payload = {
        postId: this.data.postId,
        groupId: this.data.planetId,
        userId: session.id,
        sessionToken: session.sessionToken,
        title,
        summary,
        contentText: normalizedText,
        attachments: nextImages,
        metadata: {
          tags,
          richContent,
          images: nextImages,
        },
      }

      const response = this.data.isEditMode && this.data.postId ? await updatePlanetPost(payload) : await createPlanetPost(payload)

      if (!response.ok) {
        throw new Error(this.data.isEditMode ? '修改失败' : '发布失败')
      }

      wx.setStorageSync(PLANET_PUBLISH_REFRESH_KEY, this.data.planetId)

      wx.showToast({
        title: this.data.isEditMode ? '修改成功' : '发布成功',
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
          url: `/pages/planet/home?id=${this.data.planetId}&name=${encodeURIComponent(this.data.planetName)}&source=joined`,
        })
      }, 280)
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '发布失败，请稍后再试',
        icon: 'none',
      })
    } finally {
      setTimeout(() => {
        this.setData({
          submitting: false,
        })
      }, 300)
    }
  },
})
