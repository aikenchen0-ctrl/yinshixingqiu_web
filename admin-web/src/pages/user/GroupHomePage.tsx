import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { logoutCurrentSession } from '../../services/authWebService'
import {
  createPlanetPostComment,
  deletePlanetPost,
  getDiscoverPlanets,
  getGroupDataSnapshot,
  getPlanetHome,
  getPlanetPostComments,
  getPlanetPosts,
  getPinnedPlanetPosts,
  reportPlanetPost,
  resolvePlanetAssetUrl,
  togglePlanetPostLike,
  updatePlanetPost,
  uploadPlanetImage,
  type CommentSummaryItem,
  type GroupHomePayload,
  type PlanetCardItem,
  type PostSummaryItem,
} from '../../services/planetWebService'

const feedTabs = ['最新', '等我回答', '精华', '只看星主', '问答', '文件'] as const

type FeedTab = (typeof feedTabs)[number]

const tabMap: Record<FeedTab, string> = {
  最新: 'latest',
  等我回答: 'answer',
  精华: 'featured',
  只看星主: 'latest',
  问答: 'answer',
  文件: 'files',
}

function formatPostTime(value?: string | null) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function buildPostBody(post: PostSummaryItem) {
  const text = post.contentText || post.summary || ''
  return text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
}

function normalizePostAssetUrls(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const urls: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    const resolvedUrl = resolvePlanetAssetUrl(typeof item === 'string' ? item : '')
    if (!resolvedUrl || seen.has(resolvedUrl)) {
      continue
    }
    seen.add(resolvedUrl)
    urls.push(resolvedUrl)
  }

  return urls
}

function looksLikeImageAsset(url: string) {
  return (
    /^data:image\//i.test(url) ||
    /\/uploads\/.+\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:[?#].*)?$/i.test(url) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:[?#].*)?$/i.test(url)
  )
}

function getPostImageUrls(post: PostSummaryItem) {
  const metadataImages = normalizePostAssetUrls(post.metadata.images)
  if (metadataImages.length) {
    return metadataImages.slice(0, 9)
  }

  return normalizePostAssetUrls(post.attachments).filter(looksLikeImageAsset).slice(0, 9)
}

function getPostVideoAttachments(post: PostSummaryItem) {
  if (!Array.isArray(post.metadata.videoAttachments)) {
    return []
  }

  const seen = new Set<string>()

  return post.metadata.videoAttachments
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const url = resolvePlanetAssetUrl(typeof record.url === 'string' ? record.url : '')
      if (!url || seen.has(url)) {
        return null
      }
      seen.add(url)

      return {
        name:
          (typeof record.name === 'string' && record.name.trim()) ||
          (typeof record.title === 'string' && record.title.trim()) ||
          `视频 ${index + 1}`,
        poster: resolvePlanetAssetUrl(typeof record.poster === 'string' ? record.poster : ''),
        url,
      }
    })
    .filter((item): item is { name: string; poster: string; url: string } => Boolean(item))
    .slice(0, 5)
}

function formatCommentTime(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function getPostMoreActions(
  post: PostSummaryItem,
  options: {
    canManage: boolean
    isAuthor: boolean
  },
) {
  const actions = ['复制链接']

  if (options.canManage || options.isAuthor) {
    actions.push('编辑标题', '修改主题')
  }

  if (options.canManage) {
    actions.push(post.isPinned ? '取消设为置顶' : '设为置顶')
    actions.push(post.isEssence ? '取消设为精华' : '设为精华')
  }

  if (!options.canManage && !options.isAuthor) {
    actions.push('投诉主题')
  }

  if (options.canManage || options.isAuthor) {
    actions.push('删除')
  }

  return actions
}

function UserTopbar({
  currentGroupId,
}: {
  currentGroupId: string
}) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logoutCurrentSession()
    navigate('/login', { replace: true })
  }

  return (
    <header className="zsxq-topbar">
      <div className="zsxq-topbar-brand">
        <div className="zsxq-topbar-logo">C</div>
        <div className="zsxq-topbar-name">饮视星球</div>
      </div>

      <div className="zsxq-topbar-actions">
        <button className="zsxq-topbar-link-button" onClick={() => navigate(`/activity/members?groupId=${currentGroupId}`)} type="button">
          管理后台
        </button>
        <button className="zsxq-topbar-link-button" onClick={handleLogout} type="button">
          退出
        </button>
        <button className="zsxq-topbar-upgrade" onClick={() => navigate(`/activity/scoreboard?groupId=${currentGroupId}`)} type="button">
          积分榜
        </button>
      </div>
    </header>
  )
}

function LeftSidebar({
  home,
  createdGroups,
  joinedGroups,
  recommendedGroups,
  currentGroupId,
  onOpenGroup,
  onOpenPreview,
}: {
  home: GroupHomePayload | null
  createdGroups: PlanetCardItem[]
  joinedGroups: PlanetCardItem[]
  recommendedGroups: PlanetCardItem[]
  currentGroupId: string
  onOpenGroup: (groupId: string) => void
  onOpenPreview: (groupId: string) => void
}) {
  return (
    <aside className="group-home-left">
      <div className="group-home-section-label">
        <span>所有星球 · 最新动态</span>
      </div>

      <div className="group-home-block">
        <div className="group-home-dropdown">创建/管理的星球 ▾</div>
        {createdGroups.length ? (
          createdGroups.map((group) => (
            <button
              className={group.id === currentGroupId ? 'group-home-current' : 'group-home-link-row'}
              key={group.id}
              onClick={() => onOpenGroup(group.id)}
              type="button"
            >
              <span>{group.name}</span>
            </button>
          ))
        ) : (
          <button className="group-home-current" type="button">
            <span>{home?.group.name ?? '当前星球'}</span>
          </button>
        )}
      </div>

      <div className="group-home-block">
        <div className="group-home-dropdown">加入的星球 ▾</div>
        {joinedGroups.map((group) => (
          <button className="group-home-link-row" key={group.id} onClick={() => onOpenGroup(group.id)} type="button">
            <span>{group.name}</span>
          </button>
        ))}
      </div>

      <div className="group-home-block">
        <div className="group-home-more">更多优质星球:</div>
        {recommendedGroups.map((group) => (
          <button
            className="group-home-link-row is-compact"
            key={group.id}
            onClick={() => onOpenPreview(group.id)}
            type="button"
          >
            <span>{group.name}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function ComposerCard({
  disabled,
  onCompose,
}: {
  disabled: boolean
  onCompose: () => void
}) {
  return (
    <section className="group-card group-composer-card">
      <button className="group-composer-ghost" disabled={disabled} onClick={onCompose} type="button">
        <div className="group-composer-head">
          <div className="group-avatar small" />
          <div className="group-composer-input">{disabled ? '请先选择可用星球...' : '点击进入文章编辑器...'}</div>
        </div>
      </button>
    </section>
  )
}

function FeedCard({
  actions,
  commentAttachments,
  busy,
  commentDraft,
  comments,
  commentsLoading,
  commentSubmitting,
  commentUploading,
  expandedComments,
  isMenuOpen,
  onAction,
  onComment,
  onCommentImagePick,
  onCommentDraftChange,
  onCommentSubmit,
  onLike,
  onOpenPost,
  onToggleMenu,
  post,
}: {
  actions: string[]
  commentAttachments: string[]
  busy: boolean
  commentDraft: string
  comments: CommentSummaryItem[]
  commentsLoading: boolean
  commentSubmitting: boolean
  commentUploading: boolean
  expandedComments: boolean
  isMenuOpen: boolean
  onAction: (action: string, post: PostSummaryItem) => void
  onComment: (post: PostSummaryItem) => void
  onCommentImagePick: (postId: string, file: File) => void
  onCommentDraftChange: (postId: string, value: string) => void
  onCommentSubmit: (post: PostSummaryItem) => void
  onLike: (post: PostSummaryItem) => void
  onOpenPost: (post: PostSummaryItem) => void
  onToggleMenu: () => void
  post: PostSummaryItem
}) {
  const paragraphs = buildPostBody(post)
  const postImageUrls = getPostImageUrls(post)
  const postVideoAttachments = getPostVideoAttachments(post)
  const isArticlePost = post.type === 'ARTICLE'
  const shouldShowInlineMedia = !isArticlePost
  const articleThumbnailUrls = isArticlePost ? postImageUrls.slice(0, 3) : []
  const articleHiddenImageCount = Math.max(postImageUrls.length - articleThumbnailUrls.length, 0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleOpenPostKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onOpenPost(post)
  }

  return (
    <article className="group-card group-feed-card">
      <div className="group-feed-header">
        <div className="group-avatar" />
        <div className="group-feed-meta">
          <div className="group-feed-author">{post.author.nickname || '当前成员'}</div>
          <div className="group-feed-time">
            <span>{formatPostTime(post.publishedAt || post.createdAt)}</span>
            <span>阅读人数 {post.readingCount}</span>
          </div>
        </div>
        <button
          aria-label="更多操作"
          className={isMenuOpen ? 'group-feed-more is-open' : 'group-feed-more'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleMenu()
          }}
          type="button"
        >
          ···
        </button>
        {isMenuOpen ? (
          <div
            className="group-feed-more-menu"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {actions.map((item) => (
              <button
                className={item === '删除' ? 'group-feed-more-item is-danger' : 'group-feed-more-item'}
                key={item}
                onClick={() => onAction(item, post)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        aria-label={post.title || '打开文章详情'}
        className="group-feed-entry"
        onClick={() => onOpenPost(post)}
        onKeyDown={handleOpenPostKeyDown}
        role="button"
        tabIndex={0}
      >
        <div className="group-feed-title">{post.title || post.summary || post.contentText.slice(0, 64)}</div>

        {paragraphs.length ? (
          <div className="group-feed-body">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {isArticlePost && articleThumbnailUrls.length ? (
          <div className="group-feed-thumbnail-row">
            {articleThumbnailUrls.map((url, index) => (
              <div className="group-feed-thumbnail-item" key={`${post.id}_thumb_${index + 1}`}>
                <img
                  alt={post.title ? `${post.title} 缩略图 ${index + 1}` : `文章缩略图 ${index + 1}`}
                  className="group-feed-thumbnail-image"
                  src={url}
                />
              </div>
            ))}
            {articleHiddenImageCount ? (
              <div
                aria-label={`还有 ${articleHiddenImageCount} 张图片`}
                className="group-feed-thumbnail-item is-more"
              >
                +{articleHiddenImageCount}
              </div>
            ) : null}
          </div>
        ) : null}

        {shouldShowInlineMedia && postImageUrls.length ? (
          <div className={postImageUrls.length === 1 ? 'group-feed-media-grid is-single' : 'group-feed-media-grid'}>
            {postImageUrls.map((url, index) => (
              <div className="group-feed-media-item" key={`${post.id}_image_${index + 1}`}>
                <img
                  alt={post.title ? `${post.title} 配图 ${index + 1}` : `帖子配图 ${index + 1}`}
                  className="group-feed-media-image"
                  src={url}
                />
              </div>
            ))}
          </div>
        ) : null}

        {shouldShowInlineMedia && postVideoAttachments.length ? (
          <div className="group-feed-video-list">
            {postVideoAttachments.map((item, index) => (
              <video
                className="group-feed-video"
                controls
                key={`${post.id}_video_${index + 1}`}
                playsInline
                poster={item.poster || undefined}
                preload="metadata"
                src={item.url}
                title={item.name}
              />
            ))}
          </div>
        ) : null}
        </div>

      <div className="group-feed-actions">
        <button
          className={post.viewerLiked ? 'is-active' : ''}
          disabled={busy}
          onClick={() => onLike(post)}
          type="button"
        >
          {post.viewerLiked ? '♥' : '♡'} {post.likeCount}
        </button>
        <button disabled={busy} onClick={() => onComment(post)} type="button">
          ▢ {post.commentCount}
        </button>
        <button className="group-feed-text-action" onClick={() => onComment(post)} type="button">
          {expandedComments ? '收起评论' : '展开评论'}
        </button>
      </div>

      {expandedComments ? (
        <div className="group-comment-panel">
          <div className="group-comment-composer">
            <input
              className="group-comment-input"
              onChange={(event) => onCommentDraftChange(post.id, event.target.value)}
              placeholder="写下你的评论..."
              value={commentDraft}
            />
            {commentAttachments.length ? (
              <div className="group-comment-attachments">
                {commentAttachments.map((url) => (
                  <img alt="" className="group-comment-attachment-image" key={url} src={url} />
                ))}
              </div>
            ) : null}
            <div className="group-comment-toolbar">
              <input
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    onCommentImagePick(post.id, file)
                  }
                  event.currentTarget.value = ''
                }}
                ref={fileInputRef}
                type="file"
              />
              <div className="group-comment-toolbar-icons">
                <button type="button">☺</button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="上传图片"
                  type="button"
                >
                  {commentUploading ? '↻' : '▣'}
                </button>
              </div>
              <button
                className="group-comment-submit"
                disabled={commentSubmitting || commentUploading || (!commentDraft.trim() && !commentAttachments.length)}
                onClick={() => onCommentSubmit(post)}
                type="button"
              >
                {commentSubmitting ? '发布中' : '评论'}
              </button>
            </div>
          </div>

          {commentsLoading ? <div className="group-comment-empty">正在加载评论...</div> : null}

          {!commentsLoading && comments.length ? (
            <div className="group-comment-list">
              {comments.map((comment) => {
                const commentAttachments = Array.isArray(comment.attachments) ? comment.attachments : []

                return (
                  <div className="group-comment-item" key={comment.id}>
                    <div className="group-comment-header">
                      <span className="group-comment-author">{comment.author.nickname}</span>
                      <span className="group-comment-content">{comment.content}</span>
                    </div>
                    {commentAttachments.length ? (
                      <div className="group-comment-attachments is-readonly">
                        {commentAttachments.map((url) => (
                          <img alt="" className="group-comment-attachment-image" key={url} src={url} />
                        ))}
                      </div>
                    ) : null}
                    <div className="group-comment-footer">
                      <span>{formatCommentTime(comment.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function PinnedPostsBar({
  items,
  onOpenPost,
}: {
  items: PostSummaryItem[]
  onOpenPost: (post: PostSummaryItem) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (!items.length) return null

  const preview = items[0]
  const previewText = preview.title || preview.summary || preview.contentText
  const secondaryItems = expanded ? items.slice(1) : items.slice(1, 3)

  return (
    <section className="group-card group-pinned-bar">
      <button className="group-pinned-main" onClick={() => onOpenPost(preview)} type="button">
        <span className="group-pinned-badge">置顶</span>
        <span className="group-pinned-text">
          {previewText.length > 72 ? `${previewText.slice(0, 72)}...` : previewText}
        </span>
      </button>

      {items.length > 1 ? (
        <div className="group-pinned-secondary">
          {secondaryItems.map((item) => (
            <button className="group-pinned-secondary-item" key={item.id} onClick={() => onOpenPost(item)} type="button">
              <span className="group-pinned-folder">▣</span>
              <span className="group-pinned-secondary-text">
                {item.title || item.summary || item.contentText.slice(0, 28)}
              </span>
            </button>
          ))}
          {items.length > 3 ? (
            <button className="group-pinned-expand" onClick={() => setExpanded((currentValue) => !currentValue)} type="button">
              {expanded ? '收起 ▴' : '展开 ▾'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function GroupHomePage() {
  const navigate = useNavigate()
  const { groupId } = useParams()
  const [activeTab, setActiveTab] = useState<FeedTab>('最新')
  const [home, setHome] = useState<GroupHomePayload | null>(null)
  const [posts, setPosts] = useState<PostSummaryItem[]>([])
  const [pinnedPosts, setPinnedPosts] = useState<PostSummaryItem[]>([])
  const [commentAttachmentsByPostId, setCommentAttachmentsByPostId] = useState<Record<string, string[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, CommentSummaryItem[]>>({})
  const [createdGroups, setCreatedGroups] = useState<PlanetCardItem[]>([])
  const [joinedGroups, setJoinedGroups] = useState<PlanetCardItem[]>([])
  const [recommendedGroups, setRecommendedGroups] = useState<PlanetCardItem[]>([])
  const [loadingHome, setLoadingHome] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingSidebar, setLoadingSidebar] = useState(true)
  const [mutatingPostId, setMutatingPostId] = useState('')
  const [expandedCommentPostId, setExpandedCommentPostId] = useState('')
  const [loadingCommentPostId, setLoadingCommentPostId] = useState('')
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState('')
  const [uploadingCommentPostId, setUploadingCommentPostId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [menuPostId, setMenuPostId] = useState('')

  const currentGroupId =
    groupId ?? createdGroups[0]?.id ?? joinedGroups[0]?.id ?? home?.group.id ?? ''
  const viewerId = home?.viewer?.id || ''
  const canManagePosts = Boolean(home?.role.canManage)

  function resolvePostActions(post: PostSummaryItem) {
    return getPostMoreActions(post, {
      canManage: canManagePosts,
      isAuthor: viewerId === post.author.id,
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadSidebar() {
      setLoadingSidebar(true)
      try {
        const [snapshot, discover] = await Promise.all([getGroupDataSnapshot(), getDiscoverPlanets()])
        if (cancelled) return
        setCreatedGroups(snapshot.createdGroups)
        setJoinedGroups(snapshot.joinedGroups)
        setRecommendedGroups(discover)
      } catch {
        if (cancelled) return
        setCreatedGroups([])
        setJoinedGroups([])
        setRecommendedGroups([])
      } finally {
        if (!cancelled) {
          setLoadingSidebar(false)
        }
      }
    }

    void loadSidebar()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!menuPostId) return

    function handleWindowClick() {
      setMenuPostId('')
    }

    window.addEventListener('click', handleWindowClick)
    return () => {
      window.removeEventListener('click', handleWindowClick)
    }
  }, [menuPostId])

  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    if (groupId || loadingSidebar) return
    if (currentGroupId) {
      navigate(`/group/${currentGroupId}`, { replace: true })
      return
    }
    navigate('/group_data', { replace: true })
  }, [currentGroupId, groupId, loadingSidebar, navigate])

  useEffect(() => {
    let cancelled = false

    async function loadHome() {
      if (!currentGroupId) return
      setLoadingHome(true)
      setError('')

      try {
        const payload = await getPlanetHome(currentGroupId)
        if (cancelled) return
        setHome(payload)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载星球首页失败')
      } finally {
        if (!cancelled) {
          setLoadingHome(false)
        }
      }
    }

    void loadHome()

    return () => {
      cancelled = true
    }
  }, [currentGroupId])

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      const serverTab = tabMap[activeTab]

      setLoadingPosts(true)

      try {
        const [payload, pinned] = await Promise.all([
          getPlanetPosts(currentGroupId, serverTab),
          getPinnedPlanetPosts(currentGroupId),
        ])
        if (cancelled) return

        const nextItems =
          activeTab === '只看星主' && home
            ? payload.items.filter((item) => item.author.id === home.owner.id)
            : payload.items

        setPosts(nextItems)
        setPinnedPosts(pinned)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载内容流失败')
        setPosts([])
        setPinnedPosts([])
      } finally {
        if (!cancelled) {
          setLoadingPosts(false)
        }
      }
    }

    void loadPosts()

    return () => {
      cancelled = true
    }
  }, [activeTab, currentGroupId, home])

  function handleCompose() {
    if (!currentGroupId) {
      setNotice('请先选择一个星球')
      return
    }

    navigate(`/group/${currentGroupId}/write`)
  }

  async function reloadCurrentFeed(nextTab: FeedTab = activeTab) {
    const serverTab = tabMap[nextTab]
    const [payload, pinned] = await Promise.all([
      getPlanetPosts(currentGroupId, serverTab),
      getPinnedPlanetPosts(currentGroupId),
    ])
    const nextItems =
      nextTab === '只看星主' && home ? payload.items.filter((item) => item.author.id === home.owner.id) : payload.items
    setPosts(nextItems)
    setPinnedPosts(pinned)
  }

  async function handlePostAction(action: string, post: PostSummaryItem) {
    setMenuPostId('')
    setError('')
    setNotice('')

    try {
      if (action === '复制链接') {
        const nextLink = `${window.location.origin}/group/${post.groupId}`
        await navigator.clipboard.writeText(nextLink)
        setNotice('已复制帖子链接')
        return
      }

      if (action === '编辑标题') {
        const nextTitle = window.prompt('请输入新的标题', post.title || '')
        if (nextTitle === null) return
        setMutatingPostId(post.id)
        await updatePlanetPost(post.id, {
          title: nextTitle,
          summary: post.summary,
          contentText: post.contentText,
          metadata: post.metadata,
        })
        await reloadCurrentFeed()
        setNotice('标题已更新')
        return
      }

      if (action === '修改主题') {
        const nextContent = window.prompt('请输入新的主题内容', post.contentText || post.summary || post.title)
        if (nextContent === null) return
        setMutatingPostId(post.id)
        await updatePlanetPost(post.id, {
          title: post.title,
          summary: post.summary,
          contentText: nextContent,
          metadata: post.metadata,
        })
        await reloadCurrentFeed()
        setNotice('主题内容已更新')
        return
      }

      if (action === '设为置顶' || action === '取消设为置顶') {
        setMutatingPostId(post.id)
        await updatePlanetPost(post.id, {
          isPinned: !post.isPinned,
        })
        await reloadCurrentFeed()
        setNotice(post.isPinned ? '已取消置顶' : '已设为置顶')
        return
      }

      if (action === '设为精华' || action === '取消设为精华') {
        setMutatingPostId(post.id)
        await updatePlanetPost(post.id, {
          isEssence: !post.isEssence,
        })
        await reloadCurrentFeed()
        setNotice(post.isEssence ? '已取消精华' : '已设为精华')
        return
      }

      if (action === '添加标签') {
        const rawValue = window.prompt(
          '请输入标签，多个标签用逗号分隔',
          Array.isArray(post.metadata.tags) ? String(post.metadata.tags.join(',')) : '',
        )
        if (rawValue === null) return
        const tags = rawValue
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8)
        setMutatingPostId(post.id)
        await updatePlanetPost(post.id, {
          title: post.title,
          summary: post.summary,
          contentText: post.contentText,
          metadata: {
            ...post.metadata,
            tags,
          },
        })
        await reloadCurrentFeed()
        setNotice('标签已更新')
        return
      }

      if (action === '删除') {
        const confirmed = window.confirm('确认删除这条主题吗？删除后将不再显示。')
        if (!confirmed) return
        setMutatingPostId(post.id)
        await deletePlanetPost(post.id)
        await reloadCurrentFeed()
        setNotice('主题已删除')
        return
      }

      if (action === '投诉主题') {
        const rawReason = window.prompt('请输入投诉原因（最多 120 字）', '')
        if (rawReason === null) return
        const reason = rawReason.trim()
        if (!reason) {
          setNotice('请输入投诉原因')
          return
        }

        setMutatingPostId(post.id)
        const payload = await reportPlanetPost(post.id, reason)
        setNotice(payload.idempotent ? '你已经提交过待处理投诉' : '投诉已提交，管理员会尽快处理')
        return
      }

      throw new Error(`未识别的帖子操作：${action}`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} 失败`)
    } finally {
      setMutatingPostId('')
    }
  }

  async function handlePostLike(post: PostSummaryItem) {
    setError('')
    setNotice('')
    setMutatingPostId(post.id)

    try {
      const updated = await togglePlanetPostLike(post.id, !post.viewerLiked)
      setPosts((current) => current.map((item) => (item.id === post.id ? updated : item)))
      setPinnedPosts((current) => current.map((item) => (item.id === post.id ? updated : item)))
      setNotice(updated.viewerLiked ? '已点赞' : '已取消点赞')
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : '点赞失败')
    } finally {
      setMutatingPostId('')
    }
  }

  async function handlePostComment(post: PostSummaryItem) {
    setError('')
    setNotice('')
    const nextExpanded = expandedCommentPostId === post.id ? '' : post.id
    setExpandedCommentPostId(nextExpanded)

    if (!nextExpanded || commentsByPostId[post.id]) {
      return
    }

    setLoadingCommentPostId(post.id)
    try {
      const comments = await getPlanetPostComments(post.id)
      setCommentsByPostId((current) => ({
        ...current,
        [post.id]: comments,
      }))
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : '加载评论失败')
    } finally {
      setLoadingCommentPostId('')
    }
  }

  async function handleCommentSubmit(post: PostSummaryItem) {
    const content = commentDrafts[post.id] || ''
    const attachments = commentAttachmentsByPostId[post.id] || []
    if (!content.trim() && !attachments.length) {
      setNotice('评论内容不能为空')
      return
    }

    setSubmittingCommentPostId(post.id)

    try {
      console.log('[comment] submit payload', {
        postId: post.id,
        contentLength: content.trim().length,
        attachments,
      })
      await createPlanetPostComment(post.id, content.trim(), attachments)
      const comments = await getPlanetPostComments(post.id)
      setCommentsByPostId((current) => ({
        ...current,
        [post.id]: comments,
      }))
      setCommentDrafts((current) => ({
        ...current,
        [post.id]: '',
      }))
      setCommentAttachmentsByPostId((current) => ({
        ...current,
        [post.id]: [],
      }))
      await reloadCurrentFeed()
      setNotice('评论已发布')
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : '发表评论失败')
    } finally {
      setSubmittingCommentPostId('')
    }
  }

  async function handleCommentImagePick(postId: string, file: File) {
    setError('')
    setNotice('')
    setUploadingCommentPostId(postId)

    try {
      const url = await uploadPlanetImage(file)
      console.log('[comment] image uploaded', {
        postId,
        url,
      })
      setCommentAttachmentsByPostId((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), url].slice(0, 3),
      }))
      setNotice('图片已上传')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败')
    } finally {
      setUploadingCommentPostId('')
    }
  }

  return (
    <div className="zsxq-page-shell">
      {notice ? <div className="group-top-toast">{notice}</div> : null}
      <UserTopbar currentGroupId={currentGroupId} />

      <main className="group-home-page">
        <LeftSidebar
          createdGroups={createdGroups}
          currentGroupId={currentGroupId}
          home={home}
          joinedGroups={joinedGroups}
          onOpenGroup={(nextGroupId) => navigate(`/group/${nextGroupId}`)}
          onOpenPreview={(nextGroupId) => navigate(`/preview/${nextGroupId}`)}
          recommendedGroups={recommendedGroups}
        />

        <section className="group-home-center">
          <ComposerCard disabled={!currentGroupId} onCompose={handleCompose} />

          <div className="group-feed-tabs">
            {feedTabs.map((tab) => (
              <button
                className={activeTab === tab ? 'is-active' : ''}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <PinnedPostsBar items={pinnedPosts} onOpenPost={(post) => navigate(`/group/${post.groupId}/post/${post.id}`)} />

          {error ? <div className="group-feed-empty">{error}</div> : null}
          {loadingSidebar || loadingHome || loadingPosts ? (
            <div className="group-feed-empty">正在加载真实内容...</div>
          ) : null}

          {!loadingPosts && !posts.length ? (
            <div className="group-feed-empty">这个分类暂时没有内容，或后端还未产出对应数据。</div>
          ) : null}

          {posts.map((post) => (
            <FeedCard
              actions={resolvePostActions(post)}
              busy={mutatingPostId === post.id}
              commentAttachments={commentAttachmentsByPostId[post.id] || []}
              commentDraft={commentDrafts[post.id] || ''}
              comments={commentsByPostId[post.id] || []}
              commentsLoading={loadingCommentPostId === post.id}
              commentSubmitting={submittingCommentPostId === post.id}
              commentUploading={uploadingCommentPostId === post.id}
              expandedComments={expandedCommentPostId === post.id}
              isMenuOpen={menuPostId === post.id}
              key={post.id}
              onAction={handlePostAction}
              onComment={handlePostComment}
              onCommentImagePick={handleCommentImagePick}
              onCommentDraftChange={(postId, value) =>
                setCommentDrafts((current) => ({
                  ...current,
                  [postId]: value,
                }))
              }
              onCommentSubmit={handleCommentSubmit}
              onLike={handlePostLike}
              onOpenPost={(post) => navigate(`/group/${post.groupId}/post/${post.id}`)}
              onToggleMenu={() => setMenuPostId((current) => (current === post.id ? '' : post.id))}
              post={post}
            />
          ))}

          <div className="group-feed-empty">没有更多了</div>
          <div className="group-home-group-id">groupId: {currentGroupId}</div>
        </section>
      </main>

    </div>
  )
}
