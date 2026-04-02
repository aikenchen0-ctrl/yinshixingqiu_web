import { fetchSessionProfile, pingBackend } from '../../utils/auth-api'
import { getStoredSession } from '../../utils/auth'
import { fetchDiscoverPlanets, fetchJoinedPlanets, fetchMyPlanetPosts } from '../../utils/planet-api'
import { getApiBaseUrl, request } from '../../utils/request'

interface DebugActionItem {
  id: string
  title: string
  desc: string
}

const debugActions: DebugActionItem[] = [
  {
    id: 'health',
    title: '健康检查',
    desc: '查看当前本地服务是否在线',
  },
  {
    id: 'session',
    title: '当前会话',
    desc: '读取当前登录用户的 session 信息',
  },
  {
    id: 'mine',
    title: '我的星球',
    desc: '查看当前用户可见的我的星球接口返回',
  },
  {
    id: 'joined',
    title: '我加入的星球',
    desc: '查看当前用户真实已加入的星球列表',
  },
  {
    id: 'my-posts',
    title: '我的发帖',
    desc: '查看当前登录账号在后端帖子表里的发帖记录',
  },
  {
    id: 'discover',
    title: '发现星球',
    desc: '查看发现页真实接口返回',
  },
  {
    id: 'state',
    title: '调试状态',
    desc: '查看后端调试快照数据',
  },
]

const formatResponse = (payload: unknown) => {
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

Page({
  data: {
    actions: debugActions,
    activeBaseUrl: '',
    sessionToken: '',
    sessionTokenDisplay: '当前还没有 sessionToken',
    sessionNickname: '未登录',
    sessionMobile: '未绑定',
    loadingAction: '',
    responseTitle: '接口返回',
    responseText: '点下面任意一个调试操作，就会把真实接口回包展示在这里。',
  },

  onShow() {
    this.refreshSessionInfo()
  },

  refreshSessionInfo() {
    const session = getStoredSession()

    this.setData({
      activeBaseUrl: getApiBaseUrl(),
      sessionToken: session && session.sessionToken ? session.sessionToken : '',
      sessionTokenDisplay:
        session && session.sessionToken ? session.sessionToken : '当前还没有 sessionToken',
      sessionNickname: session && session.nickname ? session.nickname : '未登录',
      sessionMobile: session && session.mobile ? session.mobile : '未绑定',
    })
  },

  async onActionTap(e: WechatMiniprogram.TouchEvent) {
    const action = String(e.currentTarget.dataset.action || '')

    if (!action || this.data.loadingAction) {
      return
    }

    this.setData({
      loadingAction: action,
      responseTitle: `正在请求 ${action}`,
      responseText: '请求中...',
    })

    try {
      const payload = await this.executeAction(action)
      this.refreshSessionInfo()
      this.setData({
        loadingAction: '',
        responseTitle: `接口返回 / ${action}`,
        responseText: formatResponse(payload),
      })
    } catch (error) {
      this.refreshSessionInfo()
      this.setData({
        loadingAction: '',
        responseTitle: `请求失败 / ${action}`,
        responseText: formatResponse({
          ok: false,
          message: error instanceof Error ? error.message : '请求失败',
        }),
      })
    }
  },

  onCopyResponse() {
    if (!this.data.responseText) {
      wx.showToast({
        title: '当前没有可复制内容',
        icon: 'none',
      })
      return
    }

    wx.setClipboardData({
      data: this.data.responseText,
      success: () => {
        wx.showToast({
          title: '接口返回已复制',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败，请重试',
          icon: 'none',
        })
      },
    })
  },

  async executeAction(action: string) {
    const sessionToken = this.data.sessionToken

    if (action === 'health') {
      return pingBackend()
    }

    if (action === 'session') {
      if (!sessionToken) {
        throw new Error('当前没有 sessionToken，请先去“我的”完成登录')
      }

      return fetchSessionProfile(sessionToken)
    }

    if (action === 'mine') {
      if (!sessionToken) {
        throw new Error('当前没有 sessionToken，请先去“我的”完成登录')
      }

      return request({
        url: `/api/planets/mine?sessionToken=${encodeURIComponent(sessionToken)}`,
      })
    }

    if (action === 'joined') {
      if (!sessionToken) {
        throw new Error('当前没有 sessionToken，请先去“我的”完成登录')
      }

      return fetchJoinedPlanets(sessionToken)
    }

    if (action === 'discover') {
      return fetchDiscoverPlanets(sessionToken || '', 12)
    }

    if (action === 'my-posts') {
      const session = getStoredSession()
      const nickname = session && session.nickname ? session.nickname.trim() : ''
      const userId = session && session.id ? session.id.trim() : ''
      const sessionToken = session && session.sessionToken ? session.sessionToken.trim() : ''

      if (!sessionToken) {
        throw new Error('当前没有登录信息，请先去“我的”完成登录')
      }

      const response = await fetchMyPlanetPosts(sessionToken)
      if (!response.ok || !Array.isArray(response.data)) {
        throw new Error('读取我的发帖失败')
      }

      const minePosts = response.data.map((post) => {
        const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
        const tags = Array.isArray(metadata.tags)
          ? metadata.tags.filter((item: unknown) => typeof item === 'string')
          : []

        return {
          id: post.id || '',
          planetId: post.groupId || '',
          planetName: post.group && typeof post.group === 'object' ? post.group.name || '未识别星球' : '未识别星球',
          authorId: post.author && typeof post.author === 'object' ? post.author.id || '' : '',
          author: post.author && typeof post.author === 'object' ? post.author.nickname || nickname : nickname,
          time: post.publishedAt || post.createdAt || '',
          content: post.title || post.summary || post.contentText || '',
          tags,
          imageCount: Array.isArray(post.attachments) ? post.attachments.length : 0,
          likeCount: Number(post.likeCount || 0),
          commentCount: Number(post.commentCount || 0),
        }
      })

      return {
        ok: true,
        source: 'backend-post-storage',
        userId,
        nickname,
        total: minePosts.length,
        posts: minePosts,
      }
    }

    if (action === 'state') {
      return request({
        url: '/api/debug/state',
      })
    }

    throw new Error('暂不支持的调试动作')
  },

  onPlanetTabChange(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const key = String((e.detail && e.detail.key) || '')

    if (!key || key === 'debug') {
      return
    }

    if (key === 'planet') {
      wx.redirectTo({
        url: '/pages/planet/index',
      })
      return
    }

    if (key === 'discover') {
      wx.redirectTo({
        url: '/pages/planet/lobby',
      })
      return
    }

    if (key === 'mine') {
      wx.redirectTo({
        url: '/pages/planet/mine',
      })
    }
  },
})
