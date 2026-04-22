import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  listArticles,
  updateArticleStatus,
  type ArticleAccessType,
  type ArticleContentSource,
  type ArticleItem,
  type ArticleListPayload,
  type ArticleStatus,
} from '../../services/articleWebService'

const PAGE_SIZE = 10

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ').replace(/-/g, '/')
}

function getStatusLabel(status: string) {
  if (status === 'PUBLISHED') return '已发布'
  if (status === 'DRAFT') return '草稿'
  if (status === 'HIDDEN') return '已隐藏'
  if (status === 'DELETED') return '已删除'
  return status || '-'
}

function getStatusChipClass(status: string) {
  if (status === 'PUBLISHED') return 'resource-table-chip is-success'
  if (status === 'HIDDEN') return 'resource-table-chip is-warning'
  if (status === 'DELETED') return 'resource-table-chip is-danger'
  return 'resource-table-chip is-muted'
}

function getSourceLabel(contentSource: ArticleContentSource) {
  if (contentSource === 'wechat') return '微信文章'
  if (contentSource === 'planet') return '知识星球'
  return '未知来源'
}

function getAccessLabel(article: ArticleItem) {
  if (article.access?.accessType === 'paid') {
    const previewMode = article.access.previewMode === 'ratio' ? '按比例试看' : '按段试看'
    const previewText =
      article.access.previewMode === 'ratio'
        ? `${Math.round((article.access.previewValue || 0) * 100)}%`
        : `${article.access.previewValue || 0} 段`

    return `付费 ${article.access.priceLabel || '¥0'} / ${previewMode} ${previewText}`
  }

  return '免费全文'
}

function getReadStateLabel(readState?: string) {
  if (readState === 'paid_unlocked') return '可读全文'
  if (readState === 'paid_locked') return '试看中'
  if (readState === 'free_full') return '免费全文'
  return '-'
}

function buildArticleTitle(item: ArticleItem) {
  return item.title || item.summary || '未命名文章'
}

function buildArticleSummary(item: ArticleItem) {
  return item.summary || item.previewContentText || item.contentText || ''
}

function buildActionLabel(status: string) {
  if (status === 'PUBLISHED') return '隐藏'
  if (status === 'HIDDEN' || status === 'DRAFT') return '发布'
  return ''
}

function buildNextStatus(status: string): Exclude<ArticleStatus, 'ALL'> | '' {
  if (status === 'PUBLISHED') return 'HIDDEN'
  if (status === 'HIDDEN' || status === 'DRAFT') return 'PUBLISHED'
  return ''
}

export function ActivityContentPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [status, setStatus] = useState<ArticleStatus>('ALL')
  const [contentSource, setContentSource] = useState<ArticleContentSource>('' as ArticleContentSource)
  const [accessType, setAccessType] = useState<ArticleAccessType | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatingArticleId, setUpdatingArticleId] = useState('')
  const [data, setData] = useState<ArticleListPayload | null>(null)

  useEffect(() => {
    setStatus('ALL')
    setContentSource('' as ArticleContentSource)
    setAccessType('')
    setSearchInput('')
    setSearchKeyword('')
    setPage(1)
    setError('')
    setNotice('')
    setData(null)
  }, [groupId])

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    if (!groupId) {
      setData(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    listArticles({
      groupId,
      status,
      contentSource,
      accessType,
      search: searchKeyword,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((payload) => {
        if (!active) return
        setData(payload)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载文章管理列表失败')
        setData(null)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [accessType, contentSource, groupId, page, reloadToken, searchKeyword, status])

  const hasActiveFilters = Boolean(status !== 'ALL' || contentSource || accessType || searchInput.trim())
  const pagination = data
  const groupName = currentGroup?.name || groupId || '未分配星球'
  const pageSubtitle = useMemo(() => {
    const sourceLabel = contentSource ? getSourceLabel(contentSource) : '全部来源'
    const accessLabel = accessType === 'paid' ? '付费文章' : accessType === 'free' ? '免费文章' : '全部访问类型'
    const statusLabel = status === 'ALL' ? '全部状态' : getStatusLabel(status)
    const keywordLabel = searchKeyword ? `关键词「${searchKeyword}」` : '无关键词'

    return `${statusLabel} / ${sourceLabel} / ${accessLabel} / ${keywordLabel}`
  }, [accessType, contentSource, searchKeyword, status])

  function handleSearchCommit() {
    setSearchKeyword(searchInput.trim())
    setPage(1)
  }

  function handleResetFilters() {
    setStatus('ALL')
    setContentSource('' as ArticleContentSource)
    setAccessType('')
    setSearchInput('')
    setSearchKeyword('')
    setPage(1)
  }

  async function handleToggleStatus(article: ArticleItem) {
    const nextStatus = buildNextStatus(article.status)
    if (!nextStatus) {
      return
    }

    setUpdatingArticleId(article.id)
    setError('')

    try {
      await updateArticleStatus({
        articleId: article.id,
        status: nextStatus,
      })
      setNotice(`${buildArticleTitle(article)} 已${nextStatus === 'PUBLISHED' ? '发布' : '隐藏'}`)
      setReloadToken((value) => value + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新文章状态失败')
    } finally {
      setUpdatingArticleId('')
    }
  }

  return (
    <AdminLayout
      title="文章管理"
      subtitle="按文章维度筛选、查看、编辑和上下架。"
      tag="内容后台"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="进入社群首页"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="activity-content-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <div className="activity-content-group-name">{groupName}</div>

            <section className="admin-resource-panel">
              <div className="resource-section-header">
                <div>
                  <div className="resource-section-title">文章工作台</div>
                  <div className="resource-section-subtitle">{pageSubtitle}</div>
                </div>
                <button
                  className="admin-resource-submit"
                  disabled={!groupId}
                  onClick={() => navigate(`/group/${groupId}/write?from=admin`)}
                  type="button"
                >
                  新建文章
                </button>
              </div>

              <div className="activity-content-filter-grid">
                <label className="admin-resource-field">
                  <span>发布状态</span>
                  <select
                    onChange={(event) => {
                      setStatus(event.target.value as ArticleStatus)
                      setPage(1)
                    }}
                    value={status}
                  >
                    <option value="ALL">全部状态</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="DRAFT">草稿</option>
                    <option value="HIDDEN">已隐藏</option>
                  </select>
                </label>

                <label className="admin-resource-field">
                  <span>内容来源</span>
                  <select
                    onChange={(event) => {
                      setContentSource(event.target.value as ArticleContentSource)
                      setPage(1)
                    }}
                    value={contentSource}
                  >
                    <option value="">全部来源</option>
                    <option value="wechat">微信文章</option>
                    <option value="planet">知识星球</option>
                  </select>
                </label>

                <label className="admin-resource-field">
                  <span>访问类型</span>
                  <select
                    onChange={(event) => {
                      setAccessType(event.target.value as ArticleAccessType | '')
                      setPage(1)
                    }}
                    value={accessType}
                  >
                    <option value="">全部访问类型</option>
                    <option value="free">免费全文</option>
                    <option value="paid">付费试看</option>
                  </select>
                </label>

                <label className="admin-resource-field admin-resource-field-search">
                  <span>关键词</span>
                  <input
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSearchCommit()
                      }
                    }}
                    placeholder="搜索标题、摘要、正文"
                    value={searchInput}
                  />
                </label>

                <div className="activity-content-filter-actions">
                  <button className="admin-resource-submit" onClick={handleSearchCommit} type="button">
                    搜索
                  </button>
                  <button className="admin-resource-ghost" disabled={!hasActiveFilters} onClick={handleResetFilters} type="button">
                    重置
                  </button>
                </div>
              </div>

              {loading ? <div className="admin-resource-empty">加载中...</div> : null}

              {!loading && data ? (
                data.items.length ? (
                  <>
                    <div className="resource-table">
                      <div className="resource-table-row resource-table-head resource-table-article">
                        <span>文章信息</span>
                        <span>来源</span>
                        <span>作者</span>
                        <span>发布时间</span>
                        <span>访问/阅读态</span>
                        <span>阅读</span>
                        <span>点赞</span>
                        <span>评论</span>
                        <span>状态</span>
                        <span>操作</span>
                      </div>

                      {data.items.map((item) => {
                        const actionLabel = buildActionLabel(item.status)
                        const isUpdating = updatingArticleId === item.id

                        return (
                          <div className="resource-table-row resource-table-article" key={item.id}>
                            <span className="resource-table-strong">
                              <span className="activity-content-table-title">{buildArticleTitle(item)}</span>
                              <span className="resource-table-chip-row">
                                <span className={`resource-table-chip ${item.isEssence ? 'is-warning' : 'is-muted'}`}>
                                  {item.isEssence ? '精选' : '普通'}
                                </span>
                                <span className={`resource-table-chip ${item.isPinned ? 'is-success' : 'is-muted'}`}>
                                  {item.isPinned ? '置顶' : '未置顶'}
                                </span>
                              </span>
                              {buildArticleSummary(item) ? <span className="resource-table-meta-line">{buildArticleSummary(item)}</span> : null}
                            </span>

                            <span>{getSourceLabel(item.contentSource)}</span>
                            <span>{item.authorDisplay?.name || '-'}</span>
                            <span>{formatDateTime(item.publishedAt || item.createdAt)}</span>
                            <span className="resource-table-strong">
                              <span>{getAccessLabel(item)}</span>
                              <em>{getReadStateLabel(item.readState)}</em>
                            </span>
                            <span>{item.readingCount}</span>
                            <span>{item.likeCount}</span>
                            <span>{item.commentCount}</span>
                            <span>
                              <span className={getStatusChipClass(item.status)}>{getStatusLabel(item.status)}</span>
                            </span>
                            <span className="resource-table-action-cell">
                              <div className="resource-table-inline-actions">
                                <button
                                  className="admin-resource-ghost"
                                  onClick={() => navigate(`/group/${item.groupId}/post/${item.id}?from=admin&entity=article`)}
                                  type="button"
                                >
                                  查看
                                </button>
                                <button
                                  className="admin-resource-submit"
                                  onClick={() => navigate(`/group/${item.groupId}/write?articleId=${item.id}&from=admin`)}
                                  type="button"
                                >
                                  编辑
                                </button>
                                {actionLabel ? (
                                  <button
                                    className="admin-resource-ghost"
                                    disabled={isUpdating}
                                    onClick={() => void handleToggleStatus(item)}
                                    type="button"
                                  >
                                    {isUpdating ? '处理中...' : actionLabel}
                                  </button>
                                ) : null}
                              </div>
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <div className="admin-resource-footer">
                      <span>{`第 ${pagination?.page ?? 1} / ${pagination?.totalPages ?? 1} 页，共 ${pagination?.total ?? 0} 篇文章`}</span>
                      <div className="admin-resource-pager">
                        <button
                          disabled={(pagination?.page ?? 1) <= 1}
                          onClick={() => setPage((pagination?.page ?? 1) - 1)}
                          type="button"
                        >
                          上一页
                        </button>
                        <button
                          disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)}
                          onClick={() => setPage((pagination?.page ?? 1) + 1)}
                          type="button"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="admin-resource-empty">当前筛选条件下没有文章。</div>
                )
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
