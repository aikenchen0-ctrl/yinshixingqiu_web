import {
  addComment,
  getPinnedPostById,
  getPostById,
  loadComments,
  PlanetComment,
  PlanetPost,
  toggleLike,
} from '../../utils/planet'

interface PostDetailView extends PlanetPost {
  displayAuthor: string
}

interface PinnedPostDetailView {
  id: string
  author: string
  avatar: string
  time: string
  content: string
  tags: string[]
  images: string[]
  likeCount: number
  commentCount: number
  liked: boolean
  displayAuthor: string
}

let currentPostId = ''
let currentPlanetId = 'planet_2'

const createFallbackPost = (): PostDetailView => ({
  id: '',
  author: '易安 星空',
  avatar: '',
  time: '2026/03/31 10:00',
  content: '官方下场，这实属是偷家了，A普要如何应对',
  tags: [],
  images: [],
  likeCount: 0,
  commentCount: 0,
  liked: false,
  displayAuthor: '易安 星空',
})

const createPinnedPostView = (
  id: string,
): PinnedPostDetailView => {
  const pinnedPost = getPinnedPostById(id)
  if (!pinnedPost) {
    return createFallbackPost()
  }

  return {
    id: pinnedPost.id,
    author: pinnedPost.author,
    avatar: '',
    time: pinnedPost.time,
    content: pinnedPost.content,
    tags: [],
    images: pinnedPost.images,
    likeCount: pinnedPost.likeCount,
    commentCount: pinnedPost.commentCount,
    liked: !!pinnedPost.liked,
    displayAuthor: pinnedPost.author,
  }
}

Page({
  data: {
    post: createFallbackPost() as PostDetailView,
    commentInput: '',
    comments: [] as PlanetComment[],
    canLike: true,
  },

  onLoad(options: Record<string, string>) {
    currentPostId = options.id || ''
    currentPlanetId = options.planetId || 'planet_2'
    this.refreshPostDetail()
  },

  onShow() {
    this.refreshPostDetail()
  },

  refreshPostDetail() {
    const id = currentPostId || ''
    const pinnedPost = getPinnedPostById(id)
    const post = getPostById(id)
    const nextPost: PostDetailView = post
      ? {
          ...post,
          displayAuthor: post.author,
        }
      : pinnedPost
      ? createPinnedPostView(id)
      : createFallbackPost()
    const comments = id ? loadComments(id) : []

    this.setData({
      post: nextPost,
      comments,
      canLike: !!id,
    })
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({
      commentInput: e.detail.value,
    })
  },

  onCommentConfirm() {
    const content = this.data.commentInput.trim()
    const postId = this.data.post.id

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

    addComment(postId, content)
    const nextComments = loadComments(postId)
    const nextPost = getPostById(postId)
    const nextPinnedPost = getPinnedPostById(postId)

    this.setData({
      post: nextPost
        ? {
            ...nextPost,
            displayAuthor: nextPost.author,
          }
        : nextPinnedPost
        ? createPinnedPostView(postId)
        : this.data.post,
      comments: nextComments,
      commentInput: '',
    })

    wx.showToast({
      title: '观点已发布',
      icon: 'success',
    })
  },

  onLikeTap() {
    const postId = this.data.post.id
    if (!postId) {
      wx.showToast({
        title: '当前文章不可点赞',
        icon: 'none',
      })
      return
    }

    const result = toggleLike(postId)
    if (!result) {
      wx.showToast({
        title: '点赞失败，请稍后重试',
        icon: 'none',
      })
      return
    }

    if (result.type === 'post') {
      this.setData({
        post: {
          ...result.post,
          displayAuthor: result.post.author,
        },
      })
      return
    }

    this.setData({
      post: createPinnedPostView(postId),
    })
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

  onShareAppMessage() {
    const { post } = this.data
    const shareTitle = post.content.length > 26 ? `${post.content.slice(0, 26)}...` : post.content

    return {
      title: shareTitle || '文章详情',
      path: `/pages/planet/post?id=${post.id}`,
      imageUrl: post.images[0] || '',
    }
  },

  onShareTimeline() {
    const { post } = this.data
    const shareTitle = post.content.length > 26 ? `${post.content.slice(0, 26)}...` : post.content

    return {
      title: shareTitle || '文章详情',
      query: `id=${post.id}`,
      imageUrl: post.images[0] || '',
    }
  },
})
