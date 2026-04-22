import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getArticleDetail, type ArticleItem } from '../../services/articleWebService'
import {
  getPlanetHome,
  getPlanetPostDetail,
  resolvePlanetAssetUrl,
  type PostDetailItem,
} from '../../services/planetWebService'

interface DetailVideoItem {
  name: string
  poster: string
  url: string
}

interface DetailViewData {
  id: string
  title: string
  authorName: string
  publishedAt: string
  readingCount: number
  commentCount: number
  likeCount: number
  summary: string
  richContent: string
  paragraphs: string[]
  images: string[]
  videos: DetailVideoItem[]
  tags: string[]
  columnTitle: string
  showSummary: boolean
}

function formatPostTime(value?: string | null) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function normalizeAssetUrls(value: unknown) {
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

function normalizeVideoAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()

  return value
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
    .filter((item): item is DetailVideoItem => Boolean(item))
}

function normalizeRichContentHtml(value: unknown) {
  const html = typeof value === 'string' ? value.trim() : ''
  if (!html || typeof DOMParser === 'undefined') {
    return html
  }

  const document = new DOMParser().parseFromString(html, 'text/html')

  Array.from(document.querySelectorAll('img[src]')).forEach((node) => {
    const currentSrc = node.getAttribute('src')?.trim() || ''
    node.setAttribute('src', resolvePlanetAssetUrl(currentSrc))
  })

  Array.from(document.querySelectorAll('video[src]')).forEach((node) => {
    const currentSrc = node.getAttribute('src')?.trim() || ''
    node.setAttribute('src', resolvePlanetAssetUrl(currentSrc))
  })

  Array.from(document.querySelectorAll('video[poster]')).forEach((node) => {
    const currentPoster = node.getAttribute('poster')?.trim() || ''
    node.setAttribute('poster', resolvePlanetAssetUrl(currentPoster))
  })

  return document.body.innerHTML.trim()
}

function readTagList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function buildParagraphs(text: string) {
  return text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeComparableText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[，。！？；：、“”"'‘’,.!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, '')
    .trim()
}

function shouldShowStandaloneSummary(summary: string, richContent: string, paragraphs: string[]) {
  const normalizedSummary = normalizeComparableText(summary)
  if (!normalizedSummary) {
    return false
  }

  if (String(richContent || '').trim()) {
    return false
  }

  const normalizedParagraphPreview = normalizeComparableText((Array.isArray(paragraphs) ? paragraphs : []).slice(0, 3).join(' '))
  if (!normalizedParagraphPreview) {
    return true
  }

  return (
    normalizedParagraphPreview.indexOf(normalizedSummary) < 0 && normalizedSummary.indexOf(normalizedParagraphPreview) < 0
  )
}

function buildPostDetailView(post: PostDetailItem | null) {
  if (!post) {
    return null
  }

  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const columnTitle = typeof metadata.columnTitle === 'string' ? metadata.columnTitle.trim() : ''
  const richContent = normalizeRichContentHtml(metadata.richContent)
  const paragraphs = buildParagraphs(post.contentText || post.summary || '')

  return {
    id: post.id,
    title: post.title || '未命名文章',
    authorName: post.author.nickname || '当前成员',
    publishedAt: post.publishedAt || post.createdAt || '',
    readingCount: post.readingCount,
    commentCount: post.commentCount,
    likeCount: post.likeCount,
    summary: post.summary || '',
    richContent,
    paragraphs,
    images: normalizeAssetUrls(metadata.images).slice(0, 9),
    videos: normalizeVideoAttachments(metadata.videoAttachments).slice(0, 5),
    tags: readTagList(metadata.tags),
    columnTitle,
    showSummary: shouldShowStandaloneSummary(post.summary || '', richContent, paragraphs),
  } satisfies DetailViewData
}

function buildArticleDetailView(article: ArticleItem | null) {
  if (!article) {
    return null
  }

  const metadata = article.metadata && typeof article.metadata === 'object' ? article.metadata : {}
  const columnTitle = typeof metadata.columnTitle === 'string' ? metadata.columnTitle.trim() : ''
  const richContent = normalizeRichContentHtml(article.richContent || article.previewRichContent || metadata.richContent)
  const paragraphs = buildParagraphs(article.contentText || article.summary || '')

  return {
    id: article.id,
    title: article.title || '未命名文章',
    authorName:
      article.authorDisplay?.name ||
      (article.contentSource === 'planet' ? '知识星球' : article.contentSource === 'wechat' ? '微信公众号' : '当前成员'),
    publishedAt: article.publishedAt || article.createdAt,
    readingCount: article.readingCount,
    commentCount: article.commentCount,
    likeCount: article.likeCount,
    summary: article.summary || '',
    richContent,
    paragraphs,
    images: normalizeAssetUrls(article.attachments || metadata.images).slice(0, 9),
    videos: normalizeVideoAttachments(metadata.videoAttachments).slice(0, 5),
    tags: readTagList(article.tags),
    columnTitle,
    showSummary: shouldShowStandaloneSummary(article.summary || '', richContent, paragraphs),
  } satisfies DetailViewData
}

export function PostDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, postId } = useParams()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const isArticleEntity = searchParams.get('entity') === 'article'
  const isAdminMode = searchParams.get('from') === 'admin'
  const backTarget = isAdminMode ? `/activity/content?groupId=${encodeURIComponent(groupId || '')}` : groupId ? `/group/${groupId}` : '/group_data'
  const backLabel = isAdminMode ? '返回后台' : '返回星球'
  const [groupName, setGroupName] = useState('')
  const [post, setPost] = useState<PostDetailItem | null>(null)
  const [article, setArticle] = useState<ArticleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!groupId || !postId) {
      setLoading(false)
      setError('缺少帖子信息')
      return undefined
    }

    const resolvedGroupId = groupId
    const resolvedPostId = postId
    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError('')

      try {
        const homePayloadPromise = getPlanetHome(resolvedGroupId).catch(() => null)

        if (isArticleEntity) {
          const [articlePayload, homePayload] = await Promise.all([
            getArticleDetail(resolvedPostId, !isAdminMode),
            homePayloadPromise,
          ])

          if (cancelled) return
          setArticle(articlePayload)
          setPost(null)
          setGroupName(homePayload?.group.name || '')
        } else {
          const [postPayload, homePayload] = await Promise.all([
            getPlanetPostDetail(resolvedPostId),
            homePayloadPromise,
          ])

          if (cancelled) return
          setPost(postPayload)
          setArticle(null)
          setGroupName(homePayload?.group.name || '')
        }
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载文章详情失败')
        setPost(null)
        setArticle(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [groupId, isAdminMode, isArticleEntity, postId])

  const detailView = useMemo(
    () => (isArticleEntity ? buildArticleDetailView(article) : buildPostDetailView(post)),
    [article, isArticleEntity, post],
  )

  return (
    <div className="zsxq-page-shell article-detail-shell">
      <main className="article-detail-page">
        <section className="article-detail-card">
          <div className="article-detail-topline">
            <button className="article-detail-back" onClick={() => navigate(backTarget)} type="button">
              {backLabel}
            </button>
            <span>{groupName ? `发布到 ${groupName}` : '文章详情'}</span>
          </div>

          {loading ? <div className="article-detail-state">正在加载文章详情...</div> : null}
          {!loading && error ? <div className="article-detail-state is-error">{error}</div> : null}

          {!loading && !error && detailView ? (
            <>
              {detailView.columnTitle ? <div className="article-detail-column">{detailView.columnTitle}</div> : null}
              <h1>{detailView.title}</h1>
              <div className="article-detail-meta">
                <span>{detailView.authorName}</span>
                <span>{formatPostTime(detailView.publishedAt)}</span>
                <span>阅读 {detailView.readingCount}</span>
                <span>评论 {detailView.commentCount}</span>
                <span>点赞 {detailView.likeCount}</span>
              </div>
              {detailView.showSummary ? <p className="article-detail-summary">{detailView.summary}</p> : null}

              {detailView.richContent ? (
                <div
                  className="article-editor-preview-content article-detail-rich-content"
                  dangerouslySetInnerHTML={{ __html: detailView.richContent }}
                />
              ) : (
                <div className="article-detail-fallback">
                  {detailView.paragraphs.map((paragraph, index) => (
                    <p key={`${detailView.id}_paragraph_${index + 1}`}>{paragraph}</p>
                  ))}

                  {detailView.images.length ? (
                    <div className={detailView.images.length === 1 ? 'group-feed-media-grid is-single' : 'group-feed-media-grid'}>
                      {detailView.images.map((url, index) => (
                        <div className="group-feed-media-item" key={`${detailView.id}_fallback_image_${index + 1}`}>
                          <img
                            alt={detailView.title ? `${detailView.title} 配图 ${index + 1}` : `帖子配图 ${index + 1}`}
                            className="group-feed-media-image"
                            src={url}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {detailView.videos.length ? (
                    <div className="group-feed-video-list">
                      {detailView.videos.map((item, index) => (
                        <video
                          className="group-feed-video"
                          controls
                          key={`${detailView.id}_fallback_video_${index + 1}`}
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
              )}

              {detailView.tags.length ? (
                <div className="article-detail-tag-list">
                  {detailView.tags.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
