import { getPostById, PlanetPost } from '../../utils/planet'

interface PostDetailView extends PlanetPost {
  displayAuthor: string
}

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

Page({
  data: {
    post: createFallbackPost() as PostDetailView,
  },

  onLoad(options: Record<string, string>) {
    const id = options.id || ''
    const post = getPostById(id)
    const nextPost: PostDetailView = post
      ? {
          ...post,
          displayAuthor: post.author,
        }
      : createFallbackPost()

    this.setData({
      post: nextPost,
    })
  },
})
