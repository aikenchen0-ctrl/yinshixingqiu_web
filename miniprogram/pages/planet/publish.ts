import { addPost } from '../../utils/planet'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

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
  title: string
  imageInput: string
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
}

type EditorContext = WechatMiniprogram.EditorContext

const MAX_TITLE_LENGTH = 40
const MAX_TEXT_LENGTH = 5000

let editorCtx: EditorContext | null = null

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

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

Page({
  data: {
    planetId: '',
    planetName: '饮视星球',
    title: '',
    imageInput: '',
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
  } as PublishPageData,

  onLoad(options: Record<string, string>) {
    editorCtx = null
    const planetId = resolvePlanetIdFromOptions(options, ['planetId', 'id', 'groupId'])
    if (!planetId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    this.setData({
      planetId,
      planetName: options.planetName ? decodeURIComponent(options.planetName) : '饮视星球',
    })
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

  onImageInput(e: WechatMiniprogram.Input) {
    const imageInput = e.detail.value
    const imagePreviewList = imageInput
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => /^https?:\/\//.test(item))
      .slice(0, 9)

    this.setData({
      imageInput,
      imagePreviewList,
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

  onInsertImages() {
    if (!editorCtx) {
      wx.showToast({
        title: '编辑器还没准备好',
        icon: 'none',
      })
      return
    }

    if (!this.data.imagePreviewList.length) {
      wx.showToast({
        title: '先输入图片地址',
        icon: 'none',
      })
      return
    }

    this.data.imagePreviewList.forEach((url) => {
      editorCtx!.insertImage({
        src: url,
        alt: '主题配图',
      })
    })

    wx.showToast({
      title: '已插入正文',
      icon: 'success',
    })
  },

  async onSubmit() {
    if (this.data.submitting) {
      return
    }

    const editorContent = await this.syncEditorContent()
    const title = this.data.title.trim()
    const editorHtml = editorContent ? editorContent.html : this.data.editorHtml
    const editorText = editorContent ? editorContent.text : this.data.editorText
    const normalizedText = stripHtml(editorHtml || editorText)

    if (!title && !normalizedText) {
      wx.showToast({
        title: '标题或正文至少填一项',
        icon: 'none',
      })
      return
    }

    const tags = this.data.tagInput
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4)
    const imageUrls = extractImageUrls(editorHtml)
    const summary = buildSummary(title, normalizedText)
    const richContent = title ? `<h2>${escapeHtml(title)}</h2>${editorHtml}` : editorHtml

    this.setData({
      submitting: true,
    })

    try {
      const post = addPost({
        planetId: this.data.planetId,
        content: summary,
        richContent,
        tags,
        images: imageUrls.length ? imageUrls : this.data.imagePreviewList,
      })

      wx.redirectTo({
        url: `/pages/planet/post?id=${post.id}&planetId=${this.data.planetId}`,
      })
    } finally {
      this.setData({
        submitting: false,
      })
    }
  },
})
