import { getPlanetById } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import {
  createPlanetComment,
  fetchPlanetComments,
  fetchPlanetPostDetail,
  togglePlanetCommentLike,
  togglePlanetPostLike,
} from '../../utils/planet-api'

interface CommentView {
  id: string
  author: string
  time: string
  content: string
  likeCount: number
  liked: boolean
}

interface PostDetailView {
  id: string
  authorId: string
  displayAuthor: string
  avatar: string
  time: string
  title: string
  richContent: string
  tags: string[]
  images: string[]
  likeCount: number
  commentCount: number
  liked: boolean
  isRichContent: boolean
}

let currentPostId = ''
let currentPlanetId = 'grp_datawhale_001'

const legacyPlanetIdMap: Record<string, string> = {
  planet_1: 'grp_datawhale_001',
}

const resolvePlanetId = (planetId: string) => legacyPlanetIdMap[planetId] || planetId

const formatPostTime = (value?: string) => {
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

const isImageUrl = (value: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value)

const createFallbackPost = (): PostDetailView => ({
  id: '',
  authorId: '',
  displayAuthor: '当前成员',
  avatar: '',
  time: '',
  title: '',
  richContent: '',
  tags: [],
  images: [],
  likeCount: 0,
  commentCount: 0,
  liked: false,
  isRichContent: false,
})

const extractImages = (post: Record<string, any>) => {
  const attachments = Array.isArray(post.attachments) ? post.attachments : []
  const attachmentImages = attachments
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return item.url.trim()
      }
      return ''
    })
    .filter((item) => /^https?:\/\//.test(item) && isImageUrl(item))

  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const metadataImages = Array.isArray(metadata.images)
    ? metadata.images.filter(
        (item: unknown) => typeof item === 'string' && /^https?:\/\//.test(item) && isImageUrl(item)
      )
    : []

  return Array.from(new Set(attachmentImages.concat(metadataImages))).slice(0, 9)
}

const mapRemotePost = (post: Record<string, any>): PostDetailView => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const richContent = typeof metadata.richContent === 'string' ? metadata.richContent : ''
  const title = String(post.title || '').trim()

  return {
    id: String(post.id || ''),
    authorId:
      post.author && typeof post.author === 'object' && typeof post.author.id === 'string'
        ? post.author.id
        : '',
    displayAuthor:
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : '当前成员',
    avatar:
      post.author && typeof post.author === 'object' && typeof post.author.avatarUrl === 'string'
        ? post.author.avatarUrl
        : '',
    time: formatPostTime(post.publishedAt || post.createdAt || ''),
    title: title || String(post.contentText || '').trim(),
    richContent,
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item: unknown) => typeof item === 'string') : [],
    images: extractImages(post),
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    liked: !!post.viewerLiked,
    isRichContent: !!richContent,
  }
}

const mapRemoteComment = (comment: Record<string, any>): CommentView => ({
  id: String(comment.id || ''),
  author:
    comment.author && typeof comment.author === 'object' && typeof comment.author.nickname === 'string'
      ? comment.author.nickname
      : '当前成员',
  time: formatPostTime(comment.createdAt || ''),
  content: String(comment.content || '').trim(),
  likeCount: Number(comment.likeCount || 0),
  liked: !!comment.viewerLiked,
})

Page({
  data: {
    post: createFallbackPost(),
    commentInput: '',
    comments: [] as CommentView[],
    canLike: true,
    canEdit: false,
  },

  onLoad(options: Record<string, string>) {
    currentPostId = options.id || ''
    currentPlanetId = resolvePlanetId(options.planetId || 'grp_datawhale_001')
    void this.refreshPostDetail()
  },

  onShow() {
    void this.refreshPostDetail()
  },

  canCurrentUserEditPost(post: PostDetailView) {
    const session = getStoredSession()
    return !!(session && session.id && post.authorId && session.id === post.authorId)
  },

  async refreshPostDetail() {
    const postId = currentPostId
    if (!postId) {
      this.setData({
        post: createFallbackPost(),
        comments: [],
        canLike: false,
        canEdit: false,
      })
      return
    }

    try {
      const session = getStoredSession()
      const sessionToken = session && session.sessionToken ? session.sessionToken : ''
      const [postResponse, commentsResponse] = await Promise.all([
        fetchPlanetPostDetail(postId, true, sessionToken),
        fetchPlanetComments(postId, sessionToken),
      ])

      if (!postResponse.ok || !postResponse.data) {
        throw new Error('帖子不存在')
      }

      const post = mapRemotePost(postResponse.data)
      const comments =
        commentsResponse.ok && Array.isArray(commentsResponse.data)
          ? commentsResponse.data.map(mapRemoteComment)
          : []

      this.setData({
        post,
        comments,
        canLike: true,
        canEdit: this.canCurrentUserEditPost(post),
      })
    } catch (error) {
      this.setData({
        post: createFallbackPost(),
        comments: [],
        canLike: false,
        canEdit: false,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '帖子加载失败',
        icon: 'none',
      })
    }
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({
      commentInput: e.detail.value,
    })
  },

  async onCommentConfirm() {
    const content = this.data.commentInput.trim()
    const postId = this.data.post.id
    const session = getStoredSession()

    if (!postId) {
      wx.showToast({
        title: '当前文章不可评论',
        icon: 'none',
      })
      return
    }

    if (!content) {
      wx.showToast({
        title: '请输入观点内容',
        icon: 'none',
      })
      return
    }

    if (!session || !session.id || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    try {
      const response = await createPlanetComment({
        postId,
        userId: session.id,
        content,
        sessionToken: session.sessionToken,
      })

      if (!response.ok) {
        throw new Error('评论失败')
      }

      this.setData({
        commentInput: '',
      })
      await this.refreshPostDetail()

      wx.showToast({
        title: '观点已发布',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '评论失败',
        icon: 'none',
      })
    }
  },

  async onLikeTap() {
    const postId = this.data.post.id
    const session = getStoredSession()
    if (!postId) {
      wx.showToast({
        title: '当前文章不可点赞',
        icon: 'none',
      })
      return
    }

    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    try {
      const response = await togglePlanetPostLike({
        postId,
        increment: !this.data.post.liked,
        sessionToken: session.sessionToken,
      })

      if (!response.ok || !response.data) {
        throw new Error('点赞失败')
      }

      const nextPost = mapRemotePost(response.data)
      nextPost.liked = !!response.data.viewerLiked
      this.setData({
        post: nextPost,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '点赞失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  async onCommentLikeTap(e: WechatMiniprogram.TouchEvent) {
    const commentId = String(e.currentTarget.dataset.id || '')
    const session = getStoredSession()

    if (!commentId) {
      return
    }

    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    const targetComment = this.data.comments.find((item) => item.id === commentId)
    if (!targetComment) {
      return
    }

    try {
      const response = await togglePlanetCommentLike({
        commentId,
        increment: !targetComment.liked,
        sessionToken: session.sessionToken,
      })

      if (!response.ok || !response.data) {
        throw new Error('评论点赞失败')
      }

      const nextComments = this.data.comments.map((item) =>
        item.id === commentId
          ? {
              ...item,
              likeCount: Number(response.data.likeCount || 0),
              liked: !!response.data.viewerLiked,
            }
          : item
      )

      this.setData({
        comments: nextComments,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '评论点赞失败',
        icon: 'none',
      })
    }
  },

  onGeneratePoster() {
    const postId = this.data.post.id
    if (!postId) {
      wx.showToast({
        title: '当前文章不可生成长图',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet/poster?id=${postId}&planetId=${currentPlanetId}`,
    })
  },

  onEditPost() {
    const postId = this.data.post.id
    if (!postId || !this.data.canEdit) {
      wx.showToast({
        title: '当前帖子不可编辑',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet-publish/index?planetId=${currentPlanetId}&planetName=${encodeURIComponent((getPlanetById(currentPlanetId) || { name: '知识星球' }).name)}&postId=${postId}`,
    })
  },

  onShareAppMessage() {
    const { post } = this.data
    const shareTitle = post.title.length > 26 ? `${post.title.slice(0, 26)}...` : post.title

    return {
      title: shareTitle || '文章详情',
      path: `/pages/planet/post?id=${post.id}`,
      imageUrl: post.images[0] || '',
    }
  },

  onShareTimeline() {
    const { post } = this.data
    const shareTitle = post.title.length > 26 ? `${post.title.slice(0, 26)}...` : post.title

    return {
      title: shareTitle || '文章详情',
      query: `id=${post.id}`,
      imageUrl: post.images[0] || '',
    }
  },
})
