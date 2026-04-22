import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getPlanetHome,
  getPlanetPosts,
  resolvePlanetAssetUrl,
  uploadPlanetImage,
  type GroupHomePayload,
  type PostSummaryItem,
} from '../../services/planetWebService'
import { getAdminPaywallHighlights, updateAdminPaywallHighlights } from '../../services/paywallOptimizationService'

const EXAMPLE_CASES = [
  {
    name: '心理老师成长联盟',
    posterUrl: 'https://wx.zsxq.com/assets_dweb/resources/simple-poster-1-min.f40c1a070b3b83d8.png',
  },
  {
    name: '我们的设计日记',
    posterUrl: 'https://wx.zsxq.com/assets_dweb/resources/simple-poster-2-min.25ec8d54bd97b422.png',
  },
  {
    name: '生财有术',
    posterUrl: 'https://wx.zsxq.com/assets_dweb/resources/simple-poster-3-min.7833cb6b8e97d87b.png',
  },
] as const

const MAX_HIGHLIGHT_IMAGES = 4
const MAX_HIGHLIGHT_FILE_SIZE = 2 * 1024 * 1024
const PREVIEW_NOTICE_ITEMS = [
  '付费加入后，可查看星球内已公开的历史内容和后续更新。',
  '部分主题预览仅用于展示真实内容氛围，实际可见范围以星球当前权限设置为准。',
  '知识服务属于虚拟内容服务，加入成功后暂不支持退款，请确认后支付。',
  '若页面展示有效期、续费或优惠规则，以当前星球加入规则和价格说明为准。',
] as const

type HighlightImage = {
  id: string
  name: string
  url: string
}

function normalizeHighlightStorageUrl(url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return ''
  }

  if (/^\//.test(normalizedUrl)) {
    return normalizedUrl
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl
  }

  try {
    const parsedUrl = new URL(normalizedUrl)
    if (!/^\/uploads(?:\/|$)/i.test(parsedUrl.pathname)) {
      return normalizedUrl
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
  } catch {
    return normalizedUrl
  }
}

function buildHighlightImageItems(images: Array<{ name: string; url: string }>) {
  return images
    .filter((item) => item && item.url)
    .slice(0, MAX_HIGHLIGHT_IMAGES)
    .map((item, index) => ({
      id: `saved_${index}_${normalizeHighlightStorageUrl(item.url)}`,
      name: item.name || `亮点图${index + 1}`,
      url: normalizeHighlightStorageUrl(item.url),
    }))
}

function formatJoinType(value: string) {
  if (value === 'PAID') return '付费加入'
  if (value === 'FREE') return '免费加入'
  if (value === 'INVITE_ONLY') return '仅邀请加入'
  return value || '-'
}

function formatBillingPeriod(value: string) {
  if (value === 'YEAR') return '按年'
  if (value === 'QUARTER') return '按季度'
  if (value === 'MONTH') return '按月'
  return value || '-'
}

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`
}

function buildPageMeta(pathname: string) {
  if (pathname.startsWith('/tools/')) {
    return {
      title: '付费页优化',
      subtitle: '按照管理端参考稿整理亮点案例、上传入口和前端预览能力。',
      tag: '运营工具',
    }
  }

  return {
    title: '付费页优化',
    subtitle: '围绕星球亮点海报、案例参考和上传预览，整理更接近原管理端的付费页工作台。',
    tag: '推广拉新',
  }
}

function buildCurrentSummary(data: GroupHomePayload | null) {
  if (!data) return '正在加载当前星球信息...'

  return [formatMoney(data.group.priceAmount), formatJoinType(data.group.joinType), data.policy?.allowPreview ? '允许预览' : '关闭预览']
    .filter(Boolean)
    .join(' · ')
}

function clampPreviewText(value: string | null | undefined, limit: number) {
  const normalizedValue = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue.length > limit ? `${normalizedValue.slice(0, limit)}...` : normalizedValue
}

function formatPreviewPostTime(value?: string | null) {
  if (!value) return '刚刚'

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '刚刚'

  return date
    .toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    })
    .replace(/\//g, '-')
}

function formatPreviewCount(value?: number) {
  if (!Number.isFinite(value)) return '--'

  if ((value || 0) >= 10000) {
    const normalizedValue = Number((value! / 10000).toFixed(value! >= 100000 ? 0 : 1))
    return `${normalizedValue}w`
  }

  return String(value)
}

function buildPreviewPostText(post: PostSummaryItem) {
  return clampPreviewText(post.title || post.summary || post.contentText, 54)
}

export function PaywallOptimizationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadSectionRef = useRef<HTMLElement | null>(null)
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [data, setData] = useState<GroupHomePayload | null>(null)
  const [showSpec, setShowSpec] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [highlightImages, setHighlightImages] = useState<HighlightImage[]>([])
  const [previewPosts, setPreviewPosts] = useState<PostSummaryItem[]>([])

  useEffect(() => {
    setHighlightImages([])
    setPreviewOpen(false)
    setShowSpec(false)
    setError('')
    setNotice('')
    setPreviewPosts([])
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      setData(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.all([getPlanetHome(groupId), getAdminPaywallHighlights(groupId).catch(() => null)])
      .then(([payload, savedHighlights]) => {
        if (!active) return
        setData(payload)
        setHighlightImages(buildHighlightImageItems(savedHighlights?.images || []))
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载付费页配置失败')
        setData(null)
        setHighlightImages([])
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      setPreviewPosts([])
      return
    }

    let active = true

    getPlanetPosts(groupId, 'latest')
      .then((payload) => {
        if (!active) return
        setPreviewPosts(payload.items.slice(0, 3))
      })
      .catch(() => {
        if (!active) return
        setPreviewPosts([])
      })

    return () => {
      active = false
    }
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

  const meta = useMemo(() => buildPageMeta(location.pathname), [location.pathname])
  const groupLabel = data?.group.name || currentGroup?.name || groupId || '未分配星球'
  const resolvedCoverUrl = useMemo(() => resolvePlanetAssetUrl(data?.group.coverUrl), [data?.group.coverUrl])
  const resolvedOwnerAvatarUrl = useMemo(() => resolvePlanetAssetUrl(data?.owner.avatarUrl), [data?.owner.avatarUrl])
  const currentSummary = useMemo(() => buildCurrentSummary(data), [data])
  const previewStats = useMemo(
    () => [
      { label: '成员', value: formatPreviewCount(data?.group.memberCount) },
      { label: '主题', value: formatPreviewCount(data?.group.contentCount) },
      { label: '精华', value: formatPreviewCount(data?.stats.featuredCount) },
    ],
    [data],
  )
  const previewPrimaryImage = highlightImages[0] || null
  const previewIntro = useMemo(
    () =>
      clampPreviewText(
        data?.group.description || data?.group.intro || '上传亮点图后，这里会按前端付费页的方式展示星球价值和核心亮点。',
        46,
      ),
    [data?.group.description, data?.group.intro],
  )
  const previewJoinNote = useMemo(() => {
    if (!data) return '付费页移动端预览'
    return [formatMoney(data.group.priceAmount), formatJoinType(data.group.joinType), formatBillingPeriod(data.group.billingPeriod)]
      .filter(Boolean)
      .join(' · ')
  }, [data])
  const previewPostCards = useMemo(() => {
    if (previewPosts.length) {
      return previewPosts.slice(0, 3).map((item, index) => ({
        id: item.id,
        authorName: item.author.nickname || data?.owner.nickname || '星主',
        authorAvatar: resolvePlanetAssetUrl(item.author.avatarUrl || data?.owner.avatarUrl),
        body:
          buildPreviewPostText(item) ||
          clampPreviewText(data?.group.intro || `欢迎加入 ${groupLabel}，这里会展示星球内最新主题的预览内容。`, 54),
        timeLabel: formatPreviewPostTime(item.publishedAt || item.createdAt),
        badge: index === 0 ? '最新' : '主题',
      }))
    }

    return [
      {
        id: 'placeholder_preview_post_1',
        authorName: data?.owner.nickname || '星主',
        authorAvatar: resolvedOwnerAvatarUrl,
        body: clampPreviewText(`欢迎加入 ${groupLabel}，这里会展示星球内最新主题的预览内容。`, 54),
        timeLabel: '刚刚',
        badge: '最新',
      },
      {
        id: 'placeholder_preview_post_2',
        authorName: data?.owner.nickname || '星主',
        authorAvatar: resolvedOwnerAvatarUrl,
        body: clampPreviewText(data?.group.intro || '上传亮点图后，付费页预览会更接近用户真实看到的页面效果。', 54),
        timeLabel: '预览中',
        badge: '主题',
      },
      {
        id: 'placeholder_preview_post_3',
        authorName: data?.owner.nickname || '星主',
        authorAvatar: resolvedOwnerAvatarUrl,
        body: '持续更新内容、整理精华主题，能让新用户在付费前更快理解星球价值。',
        timeLabel: '预览中',
        badge: '主题',
      },
    ]
  }, [previewPosts, data?.owner.nickname, data?.owner.avatarUrl, data?.group.intro, groupLabel, resolvedOwnerAvatarUrl])

  function handlePickRequest() {
    if (!groupId) {
      setError('请先选择可管理的星球')
      return
    }
    if (uploading || saving || highlightImages.length >= MAX_HIGHLIGHT_IMAGES) {
      return
    }
    fileInputRef.current?.click()
  }

  function handleScrollToUpload() {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      handlePickRequest()
    }, 180)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) return

    if (!groupId) {
      setError('请先选择可管理的星球')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('仅支持上传图片文件')
      return
    }

    if (file.size > MAX_HIGHLIGHT_FILE_SIZE) {
      setError('单张图片不能超过 2MB')
      return
    }

    if (highlightImages.length >= MAX_HIGHLIGHT_IMAGES) {
      setError(`最多可上传 ${MAX_HIGHLIGHT_IMAGES} 张亮点图片`)
      return
    }

    setUploading(true)
    setError('')

    try {
      const url = await uploadPlanetImage(file)
      setHighlightImages((currentValue) => [
        ...currentValue,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url: normalizeHighlightStorageUrl(url),
        },
      ])
      setNotice('亮点图片已上传，可继续补充或直接预览')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '亮点图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveImage(imageId: string) {
    setHighlightImages((currentValue) => currentValue.filter((item) => item.id !== imageId))
    if (highlightImages.length <= 1) {
      setPreviewOpen(false)
    }
    setNotice('已移除亮点图片')
  }

  function handlePreviewSubmit() {
    if (!groupId) {
      setError('请先选择可管理的星球')
      return
    }
    if (!highlightImages.length) {
      setError('请先上传至少 1 张亮点图片，再提交预览')
      return
    }

    setError('')
    setPreviewOpen(true)
    setNotice('已生成当前亮点预览，可继续检查页面效果')
  }

  async function handleSubmitOnly() {
    if (!groupId) {
      setError('请先选择可管理的星球')
      return
    }
    if (!highlightImages.length) {
      setError('请先上传至少 1 张亮点图片，再提交')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = await updateAdminPaywallHighlights({
        groupId,
        images: highlightImages.map((item) => ({
          name: item.name,
          url: normalizeHighlightStorageUrl(item.url),
        })),
      })
      setHighlightImages(buildHighlightImageItems(payload.images))
      setNotice('星球亮点已提交并保存')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交亮点图片失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout
      title={meta.title}
      subtitle={meta.subtitle}
      tag={meta.tag}
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="admin-resource-page paywall-highlight-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-inline-tip">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? <div className="admin-inline-tip">当前账号还没有可管理的星球。</div> : null}

        <div className="paywall-highlight-shell">
          <div className="paywall-highlight-group-name">{groupLabel}</div>
          <div className="paywall-highlight-title-bar">
            <div className="paywall-highlight-title-copy">
              <div className="paywall-highlight-title">付费页优化 - 星球亮点</div>
              <div className="paywall-highlight-title-subtitle">把付费页亮点内容整理成更接近原管理端的案例展示和上传预览页。</div>
            </div>
            <button className="admin-resource-ghost" disabled={!groupId} onClick={() => navigate(`/preview/${groupId}`)} type="button">
              打开用户预览页
            </button>
          </div>

          <section className="paywall-highlight-card paywall-highlight-case-card">
            <div className="paywall-highlight-section-title">星球亮点是什么？</div>
            <div className="paywall-highlight-introduce">
              <p>· 「星球亮点」是一个提供在付费页自定义展示星球特色内容的功能</p>
              <p>· 星主可上传图片，展示星球特色、用户权益、未来规划，以便用户浏览付费页时快速获取信息，提升用户付费意愿</p>
            </div>

            <div className="paywall-highlight-section-title is-spaced">优秀案例</div>
            <div className="paywall-highlight-case-grid">
              {EXAMPLE_CASES.map((item) => (
                <article className="paywall-highlight-case-item" key={item.name}>
                  <div className="paywall-highlight-case-poster" style={{ backgroundImage: `url(${item.posterUrl})` }} />
                  <div className="paywall-highlight-case-name-row">
                    <span>{item.name}</span>
                    <span className="paywall-highlight-case-hint">扫码查看实际效果</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="paywall-highlight-on-list">
              <div className="paywall-highlight-on-list-copy">
                <div className="paywall-highlight-on-list-icon">+</div>
                <div className="paywall-highlight-on-list-text">我的亮点也不错</div>
              </div>
              <button className="paywall-highlight-on-list-button" onClick={handleScrollToUpload} type="button">
                我要上榜
              </button>
            </div>
          </section>

          <section className="paywall-highlight-card paywall-highlight-upload-card" ref={uploadSectionRef}>
            <div className="paywall-highlight-section-title">上传星球亮点</div>
            <div className="paywall-highlight-upload-tip-row">
              <span>支持 JPG/PNG/JPEG 文件，最大可支持 2MB 的图片，详情可见</span>
              <button className="paywall-highlight-spec-button" onClick={() => setShowSpec((currentValue) => !currentValue)} type="button">
                上传规范
              </button>
            </div>
            <div className="paywall-highlight-current-summary">{`当前星球：${groupLabel} · ${currentSummary}`}</div>

            {showSpec ? (
              <div className="paywall-highlight-spec-card">
                <div className="paywall-highlight-spec-title">上传规范</div>
                <div className="paywall-highlight-spec-item">建议使用竖版海报比例，重点突出星球价值、成员权益和内容特色。</div>
                <div className="paywall-highlight-spec-item">单张图片不超过 2MB，避免使用模糊、拉伸或信息堆叠过多的海报。</div>
                <div className="paywall-highlight-spec-item">文案尽量聚焦结果、交付内容和更新节奏，不要把联系方式直接铺在主视觉里。</div>
              </div>
            ) : null}

            {loading ? <div className="paywall-highlight-loading">正在加载当前星球信息...</div> : null}

            <div className="paywall-highlight-upload-grid">
              {highlightImages.map((item) => (
                <article className="paywall-highlight-upload-item" key={item.id}>
                  <button className="paywall-highlight-remove-button" onClick={() => handleRemoveImage(item.id)} type="button">
                    ×
                  </button>
                  <img alt={item.name} src={resolvePlanetAssetUrl(item.url)} />
                  <div className="paywall-highlight-upload-name">{item.name}</div>
                </article>
              ))}

              {highlightImages.length < MAX_HIGHLIGHT_IMAGES ? (
                <button className="paywall-highlight-upload-button" disabled={uploading || !groupId} onClick={handlePickRequest} type="button">
                  <span className="paywall-highlight-upload-plus">{uploading ? '...' : '+'}</span>
                  <span className="paywall-highlight-upload-label">{uploading ? '上传中' : '添加亮点图'}</span>
                </button>
              ) : null}
            </div>
          </section>

          <div className="paywall-highlight-actions">
            <button
              className={`paywall-highlight-action paywall-highlight-action-preview${highlightImages.length ? ' is-active' : ''}`}
              disabled={!highlightImages.length || uploading || saving || !groupId}
              onClick={handlePreviewSubmit}
              type="button"
            >
              {uploading ? '图片上传中...' : saving ? '保存中...' : '预览'}
            </button>
            <button
              className={`paywall-highlight-action paywall-highlight-action-submit${highlightImages.length ? ' is-active' : ''}`}
              disabled={!highlightImages.length || uploading || saving || !groupId}
              onClick={() => void handleSubmitOnly()}
              type="button"
            >
              {uploading ? '图片上传中...' : saving ? '提交中...' : '提交'}
            </button>
          </div>

          <div className="paywall-highlight-review-tips">
            <span>关注「饮视星球」服务号获取官方最新消息</span>
            <button
              className="paywall-highlight-service-button"
              onClick={() => setNotice('当前版本已按参考稿完成前端预览，正式保存接口后续可继续补上')}
              type="button"
            >
              说明
            </button>
          </div>

          <input accept="image/*" hidden onChange={handleFileChange} ref={fileInputRef} type="file" />
        </div>

        {previewOpen ? (
          <div className="paywall-highlight-preview-layer" role="presentation">
            <div className="paywall-highlight-preview-dialog" role="dialog" aria-modal="true" aria-label="付费页亮点预览">
              <div className="paywall-highlight-preview-stage">
                <div className="paywall-highlight-preview-phone">
                  <div className="paywall-highlight-preview-statusbar">
                    <span>14:21</span>
                    <div className="paywall-highlight-preview-status-icons" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="paywall-highlight-preview-topbar">
                    <button className="paywall-highlight-preview-topbar-button" onClick={() => setPreviewOpen(false)} type="button">
                      ×
                    </button>
                    <div className="paywall-highlight-preview-topbar-title">{groupLabel}</div>
                    <div className="paywall-highlight-preview-topbar-more">···</div>
                  </div>
                  <div className="paywall-highlight-preview-banner">
                    {highlightImages.length > 1
                      ? `已上传 ${highlightImages.length} 张亮点图，提交后会按前端样式展示`
                      : '星球亮点会展示在付费页中，帮助用户更快理解你的星球价值'}
                  </div>

                  <div className="paywall-highlight-preview-scroll">
                    <section className="paywall-highlight-preview-section">
                      <div className="paywall-highlight-preview-section-title">星球介绍</div>
                      <div className="paywall-highlight-preview-intro-card">
                        <div className="paywall-highlight-preview-intro-main">
                          <div className="paywall-highlight-preview-group-name">{groupLabel}</div>
                          <div className="paywall-highlight-preview-group-meta">
                            {data ? `${data.group.memberCount} 位成员` : '成员信息加载中'}
                          </div>
                          <div className="paywall-highlight-preview-group-intro">{previewIntro}</div>
                        </div>
                        <div
                          className={`paywall-highlight-preview-group-cover${resolvedCoverUrl ? '' : ' is-empty'}`}
                          style={resolvedCoverUrl ? { backgroundImage: `url(${resolvedCoverUrl})` } : undefined}
                        >
                          {resolvedCoverUrl ? null : '封面'}
                        </div>
                      </div>

                      <div className="paywall-highlight-preview-owner-row">
                        {resolvedOwnerAvatarUrl ? (
                          <img alt={data?.owner.nickname || '星主头像'} src={resolvedOwnerAvatarUrl} />
                        ) : (
                          <div className="paywall-highlight-preview-avatar-fallback">{(data?.owner.nickname || '星').slice(0, 1)}</div>
                        )}
                        <div className="paywall-highlight-preview-owner-copy">
                          <div className="paywall-highlight-preview-owner-name">{data?.owner.nickname || '星主'}</div>
                          <div className="paywall-highlight-preview-owner-role">
                            {clampPreviewText(data?.owner.bio || '星球创建者', 28)}
                          </div>
                        </div>
                        <span className="paywall-highlight-preview-owner-tag">星主</span>
                      </div>

                      <div className="paywall-highlight-preview-stats">
                        {previewStats.map((item) => (
                          <div className="paywall-highlight-preview-stat" key={item.label}>
                            <strong>{item.value}</strong>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="paywall-highlight-preview-section">
                      <div className="paywall-highlight-preview-section-title-row">
                        <div className="paywall-highlight-preview-section-title">星球亮点</div>
                        {highlightImages.length > 1 ? (
                          <span className="paywall-highlight-preview-section-tip">{`共 ${highlightImages.length} 张`}</span>
                        ) : null}
                      </div>
                      <div className="paywall-highlight-preview-highlight-card">
                        {previewPrimaryImage ? <img alt={previewPrimaryImage.name} src={resolvePlanetAssetUrl(previewPrimaryImage.url)} /> : null}
                      </div>
                    </section>

                    <section className="paywall-highlight-preview-section">
                      <div className="paywall-highlight-preview-section-title">部分主题预览</div>
                      <div className="paywall-highlight-preview-post-list">
                        {previewPostCards.map((item) => (
                          <article className="paywall-highlight-preview-post" key={item.id}>
                            <div className="paywall-highlight-preview-post-header">
                              {item.authorAvatar ? (
                                <img alt={item.authorName} src={item.authorAvatar} />
                              ) : (
                                <div className="paywall-highlight-preview-avatar-fallback">{item.authorName.slice(0, 1)}</div>
                              )}
                              <div className="paywall-highlight-preview-post-meta">
                                <div className="paywall-highlight-preview-post-author-row">
                                  <span className="paywall-highlight-preview-post-author">{item.authorName}</span>
                                  <span className="paywall-highlight-preview-post-badge">{item.badge}</span>
                                </div>
                                <div className="paywall-highlight-preview-post-time">{item.timeLabel}</div>
                              </div>
                            </div>
                            <div className="paywall-highlight-preview-post-body">{item.body}</div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="paywall-highlight-preview-section is-last">
                      <div className="paywall-highlight-preview-section-title">付费须知</div>
                      <div className="paywall-highlight-preview-notice-list">
                        {PREVIEW_NOTICE_ITEMS.map((item, index) => (
                          <div className="paywall-highlight-preview-notice-item" key={item}>
                            <span className="paywall-highlight-preview-notice-index">{index + 1}</span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="paywall-highlight-preview-bottom">
                    <div className="paywall-highlight-preview-bottom-note">{previewJoinNote}</div>
                    <button className="paywall-highlight-preview-cta" type="button">
                      进入星球
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
