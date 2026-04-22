import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  createAdminColumn,
  getAdminColumns,
  downloadAdminContentExport,
  downloadAdminMembersExport,
  getAdminContent,
  getAdminMembers,
  type AdminMemberSourceType,
  updateAdminContent,
  type AdminColumnItem,
  updateAdminMemberReview,
  type AdminMemberActivitySummary,
  type AdminContentItem,
  type AdminContentPayload,
  type AdminContentTrendItem,
  type AdminMemberItem,
  type AdminMembersPayload,
  type AdminMemberTrendItem,
} from '../../services/adminResourceService'

type ResourceMode = 'members' | 'content'
type ReviewWorkbenchFilter = { status: string; sourceType: AdminMemberSourceType }

type ContentDraftState = {
  status: string
  reviewStatus: string
  reviewReason: string
  reportStatus: string
  reportResolutionNote: string
  reportTotal: number
  reportPendingCount: number
  isPinned: boolean
  isEssence: boolean
  columnId: string
}

const quickRangeDays = [7, 15, 30]

function normalizeMemberSourceType(value: string | null): AdminMemberSourceType {
  return value === 'MEMBER' || value === 'APPLICATION' ? value : 'ALL'
}

function normalizeMemberStatus(value: string | null, sourceType: AdminMemberSourceType) {
  const normalizedValue = String(value || 'ALL').toUpperCase()
  const allowedValues =
    sourceType === 'APPLICATION'
      ? ['ALL', 'PENDING', 'REJECTED']
      : sourceType === 'MEMBER'
        ? ['ALL', 'ACTIVE', 'EXPIRED', 'BANNED', 'QUIT']
        : ['ALL', 'ACTIVE', 'EXPIRED', 'BANNED', 'QUIT', 'PENDING', 'REJECTED']

  return allowedValues.includes(normalizedValue) ? normalizedValue : 'ALL'
}

function normalizeContentStatus(value: string | null) {
  const normalizedValue = String(value || 'ALL').toUpperCase()
  return ['ALL', 'PUBLISHED', 'HIDDEN', 'DRAFT', 'DELETED'].includes(normalizedValue) ? normalizedValue : 'ALL'
}

function normalizeContentType(value: string | null) {
  const normalizedValue = String(value || 'ALL').toUpperCase()
  return ['ALL', 'TOPIC', 'ARTICLE', 'NOTICE', 'CHECKIN', 'ASSIGNMENT'].includes(normalizedValue) ? normalizedValue : 'ALL'
}

function normalizeContentReviewStatus(value: string | null) {
  const normalizedValue = String(value || 'ALL').toUpperCase()
  return ['ALL', 'APPROVED', 'PENDING', 'REJECTED', 'UNSET'].includes(normalizedValue) ? normalizedValue : 'ALL'
}

function normalizeContentReportStatus(value: string | null) {
  const normalizedValue = String(value || 'ALL').toUpperCase()
  return ['ALL', 'PENDING', 'RESOLVED', 'IGNORED', 'UNSET'].includes(normalizedValue) ? normalizedValue : 'ALL'
}

function parseRangeDays(value: string | null) {
  const parsedValue = Number(value)
  return quickRangeDays.includes(parsedValue) ? parsedValue : 7
}

function parsePage(value: string | null) {
  const parsedValue = Number(value)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 1
}

function readResourceQuery(mode: ResourceMode, locationSearch: string) {
  const searchParams = new URLSearchParams(locationSearch)
  const sourceType = normalizeMemberSourceType(searchParams.get('sourceType'))

  return {
    status:
      mode === 'members'
        ? normalizeMemberStatus(searchParams.get('status'), sourceType)
        : normalizeContentStatus(searchParams.get('status')),
    sourceType,
    type: normalizeContentType(searchParams.get('type')),
    reviewStatus: normalizeContentReviewStatus(searchParams.get('reviewStatus')),
    reportStatus: normalizeContentReportStatus(searchParams.get('reportStatus')),
    columnFilter: searchParams.get('columnId') || '',
    search: (searchParams.get('search') || '').trim(),
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    rangeDays: parseRangeDays(searchParams.get('rangeDays')),
    page: parsePage(searchParams.get('page')),
    memberId: searchParams.get('memberId') || '',
    contentId: searchParams.get('contentId') || '',
  }
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

function formatDateOnly(value: string) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function buildRateWidth(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '12%'
  }

  return `${Math.max(12, Math.min(100, Math.round(value * 100)))}%`
}

function buildJoinSourceLabel(value: string) {
  if (value === 'QR_CODE') {
    return '渠道码'
  }

  if (value === 'DIRECT') {
    return '直接加入'
  }

  return value || '-'
}

function buildMemberSourceLabel(value: AdminMemberSourceType) {
  if (value === 'APPLICATION') {
    return '申请'
  }

  if (value === 'MEMBER') {
    return '成员'
  }

  return '成员与申请'
}

function buildApplicationStatusLabel(value: string) {
  if (value === 'PENDING') {
    return '待审核申请'
  }

  if (value === 'REJECTED') {
    return '已驳回申请'
  }

  return '全部申请'
}

function buildContentReportChipClass(value: string) {
  if (value === 'PENDING') {
    return 'is-warning'
  }

  if (value === 'RESOLVED') {
    return 'is-success'
  }

  if (value === 'IGNORED') {
    return 'is-muted'
  }

  return 'is-muted'
}

function buildMemberExportLabel(sourceType: AdminMemberSourceType, scope: 'current' | 'all') {
  const subject =
    sourceType === 'APPLICATION' ? (scope === 'all' ? '全部申请' : '当前申请') : sourceType === 'MEMBER' ? (scope === 'all' ? '全部成员' : '当前成员') : scope === 'all' ? '全部数据' : '当前数据'

  return `导出${subject}`
}

function buildMemberEmptyStateMessage(sourceType: AdminMemberSourceType, status: string) {
  if (sourceType === 'APPLICATION' || status === 'PENDING' || status === 'REJECTED') {
    if (status === 'PENDING') {
      return '当前没有待审核申请。'
    }

    if (status === 'REJECTED') {
      return '当前没有已驳回申请。'
    }

    return '当前筛选条件下没有加入申请。'
  }

  if (status === 'ACTIVE') {
    return '当前没有有效成员。'
  }

  if (status === 'EXPIRED') {
    return '当前没有已过期成员。'
  }

  if (status === 'BANNED') {
    return '当前没有已封禁成员。'
  }

  if (status === 'QUIT') {
    return '当前没有已退出成员。'
  }

  if (sourceType === 'MEMBER') {
    return '当前筛选条件下没有成员数据。'
  }

  return '当前筛选条件下没有成员或申请数据。'
}

function buildMemberSearchPlaceholder(sourceType: AdminMemberSourceType, canViewMemberContact: boolean) {
  if (canViewMemberContact) {
    return '昵称 / 手机号 / 微信号'
  }

  if (sourceType === 'MEMBER') {
    return '昵称'
  }

  return '昵称 / 申请单号 / 审核备注'
}

function formatMemberContactValue(value: string, canViewMemberContact: boolean) {
  if (!canViewMemberContact) {
    return '无权限查看'
  }

  return value || '-'
}

function buildReviewWorkbenchFilterKey(filter: ReviewWorkbenchFilter) {
  return `${filter.sourceType}:${filter.status}`
}

function buildContentDraft(item: AdminContentItem): ContentDraftState {
  return {
    status: item.status,
    reviewStatus: item.reviewStatus,
    reviewReason: item.reviewReason,
    reportStatus: item.reportStatus,
    reportResolutionNote: item.reportResolutionNote,
    reportTotal: item.reportTotal,
    reportPendingCount: item.reportPendingCount,
    isPinned: item.isPinned,
    isEssence: item.isEssence,
    columnId: item.columnId,
  }
}

function buildContentDraftChangedSections(draft: ContentDraftState, baseDraft: ContentDraftState) {
  const changedSections: string[] = []

  if (draft.status !== baseDraft.status) {
    changedSections.push('内容状态')
  }

  if (draft.columnId !== baseDraft.columnId) {
    changedSections.push('专栏归属')
  }

  if (draft.reviewStatus !== baseDraft.reviewStatus || draft.reviewReason !== baseDraft.reviewReason) {
    changedSections.push('审核设置')
  }

  if (draft.reportStatus !== baseDraft.reportStatus || draft.reportResolutionNote !== baseDraft.reportResolutionNote) {
    changedSections.push('举报处理')
  }

  if (draft.isPinned !== baseDraft.isPinned || draft.isEssence !== baseDraft.isEssence) {
    changedSections.push('置顶/精华')
  }

  return changedSections
}

function buildContentReportDecisionDraft(baseDraft: ContentDraftState, action: 'hideResolve' | 'ignore'): ContentDraftState {
  return action === 'hideResolve'
    ? {
        ...baseDraft,
        status: 'HIDDEN',
        reportStatus: 'RESOLVED',
        reportResolutionNote: baseDraft.reportResolutionNote || '已根据举报先隐藏内容，等待进一步复核。',
      }
    : {
        ...baseDraft,
        reportStatus: 'IGNORED',
        reportResolutionNote: baseDraft.reportResolutionNote || '已复核当前内容，暂未发现需要下架的问题。',
      }
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function OverviewCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint: string
}) {
  return (
    <article className="resource-overview-card">
      <div className="resource-overview-label">{label}</div>
      <div className="resource-overview-value">{value}</div>
      <div className="resource-overview-hint">{hint}</div>
    </article>
  )
}

function ReviewWorkbenchSection({
  currentFilter,
  onSelectFilter,
  pendingCount,
  rejectedCount,
  applicationCount,
  mixedCount,
  reapplyCount,
  urgentCount,
}: {
  currentFilter: ReviewWorkbenchFilter
  onSelectFilter: (value: ReviewWorkbenchFilter) => void
  pendingCount: number
  rejectedCount: number
  applicationCount: number
  mixedCount: number
  reapplyCount: number
  urgentCount: number
}) {
  const activeFilterKey = buildReviewWorkbenchFilterKey(currentFilter)
  const cards = [
    {
      filter: { status: 'PENDING', sourceType: 'APPLICATION' as const },
      label: '待审核申请',
      value: pendingCount,
      hint: urgentCount ? `其中 ${urgentCount} 条已重提，建议优先处理` : '已支付但尚未处理',
    },
    {
      filter: { status: 'REJECTED', sourceType: 'APPLICATION' as const },
      label: '已驳回申请',
      value: rejectedCount,
      hint: reapplyCount ? `${reapplyCount} 条出现过重新提交` : '用于跟进驳回原因与用户反馈',
    },
    {
      filter: { status: 'ALL', sourceType: 'APPLICATION' as const },
      label: '全部申请',
      value: applicationCount,
      hint: '集中处理所有待审核和已驳回申请',
    },
    {
      filter: { status: 'ALL', sourceType: 'ALL' as const },
      label: '成员与申请',
      value: mixedCount,
      hint: '回到成员与申请混合视图',
    },
  ]

  return (
    <section className="admin-resource-panel review-workbench-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">审核工作台</div>
          <div className="resource-section-subtitle">把待审核、已驳回和重提申请收拢到一屏里，便于连续处理。</div>
        </div>
      </div>

      <div className="review-workbench-grid">
        {cards.map((card) => (
          <button
            className={`review-workbench-card ${activeFilterKey === buildReviewWorkbenchFilterKey(card.filter) ? 'is-active' : ''}`}
            key={buildReviewWorkbenchFilterKey(card.filter)}
            onClick={() => onSelectFilter(card.filter)}
            type="button"
          >
            <span className="review-workbench-label">{card.label}</span>
            <strong className="review-workbench-value">{card.value}</strong>
            <span className="review-workbench-hint">{card.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ApplicationQueueSection({
  filteredCount,
  statusLabel,
  oldestPendingAt,
  latestSubmittedAt,
  latestReappliedAt,
}: {
  filteredCount: number
  statusLabel: string
  oldestPendingAt: string
  latestSubmittedAt: string
  latestReappliedAt: string
}) {
  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">审核队列</div>
          <div className="resource-section-subtitle">申请视图下只保留审核口径，避免把成员活跃指标混入审核判断。</div>
        </div>
      </div>

      <div className="resource-overview-grid resource-overview-grid-members">
        <OverviewCard label="当前筛选命中" value={filteredCount} hint={`当前状态：${statusLabel}`} />
        <OverviewCard
          label="最早待处理"
          value={oldestPendingAt ? formatDateTime(oldestPendingAt) : '-'}
          hint={oldestPendingAt ? '用于判断是否存在积压申请' : '当前没有待审核积压'}
        />
        <OverviewCard
          label="最近提交"
          value={latestSubmittedAt ? formatDateTime(latestSubmittedAt) : '-'}
          hint={latestSubmittedAt ? '方便核对最近一次入圈申请时间' : '当前没有新的申请提交'}
        />
        <OverviewCard
          label="最近重提"
          value={latestReappliedAt ? formatDateTime(latestReappliedAt) : '-'}
          hint={latestReappliedAt ? '用于优先处理反复补充资料的用户' : '当前没有重提记录'}
        />
      </div>
    </section>
  )
}

function ContentReportWorkbenchSection({
  currentFilter,
  latestReportedAt,
  onSelectFilter,
  pendingCount,
  resolvedCount,
  ignoredCount,
  totalCount,
}: {
  currentFilter: string
  latestReportedAt: string
  onSelectFilter: (value: string) => void
  pendingCount: number
  resolvedCount: number
  ignoredCount: number
  totalCount: number
}) {
  const cards = [
    {
      filter: 'PENDING',
      label: '待处理举报',
      value: pendingCount,
      hint: pendingCount ? '优先处理当前仍在排队的举报内容' : '当前没有待处理举报',
    },
    {
      filter: 'RESOLVED',
      label: '已处理举报',
      value: resolvedCount,
      hint: '用于复核已处理内容和处理备注',
    },
    {
      filter: 'IGNORED',
      label: '已忽略举报',
      value: ignoredCount,
      hint: '保留误报或无需处理的举报记录',
    },
    {
      filter: 'ALL',
      label: '全部举报',
      value: totalCount,
      hint: latestReportedAt ? `最近举报 ${formatDateTime(latestReportedAt)}` : '当前还没有举报数据',
    },
  ]

  return (
    <section className="admin-resource-panel review-workbench-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">举报工作台</div>
          <div className="resource-section-subtitle">把待处理、已处理和已忽略举报收拢到一屏里，便于连续处理内容投诉。</div>
        </div>
      </div>

      <div className="review-workbench-grid">
        {cards.map((card) => (
          <button
            className={`review-workbench-card ${currentFilter === card.filter ? 'is-active' : ''}`}
            key={card.filter}
            onClick={() => onSelectFilter(card.filter)}
            type="button"
          >
            <span className="review-workbench-label">{card.label}</span>
            <strong className="review-workbench-value">{card.value}</strong>
            <span className="review-workbench-hint">{card.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function MemberHealthSection({ summary }: { summary: AdminMemberActivitySummary }) {
  const monthActiveRate = summary.totalCurrent ? summary.monthActiveCount / summary.totalCurrent : 0
  const ratioBars = [
    { label: '总成员数', value: summary.totalCurrent, ratio: 1 },
    {
      label: '近7天活跃成员数',
      value: summary.weeklyActiveCount,
      ratio: summary.totalCurrent ? summary.weeklyActiveCount / summary.totalCurrent : 0,
    },
    {
      label: 'App 下载成员',
      value: summary.appDownloadedCount,
      ratio: summary.appDownloadRate,
    },
  ]

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">活跃情况</div>
          <div className="resource-section-subtitle">先按真实后台的区块层级补齐周活跃、月活跃和 App 下载相关指标。</div>
        </div>
      </div>

      <div className="member-health-grid">
        <article className="member-health-primary">
          <div className="member-health-primary-head">
            <div>
              <div className="member-health-kicker">有效期内成员周活跃比例</div>
              <div className="member-health-rate">{formatPercent(summary.weeklyActiveRate)}</div>
              <div className="member-health-caption">{`近7天活跃 ${summary.weeklyActiveCount} 人 / 总成员 ${summary.totalCurrent} 人`}</div>
            </div>
            <div className="member-health-pill">{`${summary.totalCurrent} 总成员`}</div>
          </div>

          <div className="member-health-bars">
            {ratioBars.map((item) => (
              <div className="member-health-bar-row" key={item.label}>
                <div className="member-health-bar-meta">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="member-health-bar-track">
                  <div className="member-health-bar-fill" style={{ width: buildRateWidth(item.ratio) }} />
                </div>
              </div>
            ))}
          </div>

          <div className="member-health-note">{`App 下载率 ${formatPercent(summary.appDownloadRate)}，后续可以继续叠加召回和续期触达建议。`}</div>
        </article>

        <div className="member-health-secondary-grid">
          <article className="member-health-stat">
            <div className="member-health-stat-label">近30天活跃成员</div>
            <div className="member-health-stat-value">{summary.monthActiveCount}</div>
            <div className="member-health-stat-hint">{`月活跃比例 ${formatPercent(monthActiveRate)}`}</div>
          </article>
          <article className="member-health-stat">
            <div className="member-health-stat-label">未过期的活跃成员</div>
            <div className="member-health-stat-value">{summary.validMonthActiveCount}</div>
            <div className="member-health-stat-hint">当前有效成员中的活跃盘</div>
          </article>
          <article className="member-health-stat">
            <div className="member-health-stat-label">已过期的活跃成员</div>
            <div className="member-health-stat-value">{summary.expiredMonthActiveCount}</div>
            <div className="member-health-stat-hint">可作为续期召回的重点对象</div>
          </article>
          <article className="member-health-stat">
            <div className="member-health-stat-label">App 下载成员</div>
            <div className="member-health-stat-value">{summary.appDownloadedCount}</div>
            <div className="member-health-stat-hint">{`下载率 ${formatPercent(summary.appDownloadRate)}`}</div>
          </article>
        </div>
      </div>
    </section>
  )
}

function MemberTrendSection({
  rangeDays,
  setRangeDays,
  trend,
}: {
  rangeDays: number
  setRangeDays: (days: number) => void
  trend: AdminMemberTrendItem[]
}) {
  const peakCount = Math.max(1, ...trend.map((item) => item.totalMemberCount))

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">成员活跃数据</div>
          <div className="resource-section-subtitle">每日 8 点前更新昨日数据，趋势和报表使用同一批后端统计数据。</div>
        </div>
        <div className="resource-range-tabs">
          {quickRangeDays.map((item) => (
            <button
              className={item === rangeDays ? 'is-active' : ''}
              key={item}
              onClick={() => setRangeDays(item)}
              type="button"
            >
              {`近${item}天`}
            </button>
          ))}
        </div>
      </div>

      <div className="resource-trend-grid">
        <div className="resource-mini-chart">
          {trend.map((item) => (
            <div className="resource-mini-chart-column" key={item.date}>
              <div
                className="resource-mini-chart-bar"
                style={{ height: `${Math.max(14, Math.round((item.totalMemberCount / peakCount) * 132))}px` }}
                title={`${item.label} / 总成员 ${item.totalMemberCount}`}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="resource-trend-metrics">
          {trend.slice(-3).map((item) => (
            <article className="resource-trend-metric" key={item.date}>
              <div className="resource-trend-metric-day">{item.label}</div>
              <div>{`总成员 ${item.totalMemberCount}`}</div>
              <div>{`近7天活跃 ${item.activeMemberCount7d}`}</div>
              <div>{`周活跃比例 ${formatPercent(item.weeklyActiveRate)}`}</div>
              <div>{`App 下载率 ${formatPercent(item.appDownloadRate)}`}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContentTrendSection({
  subtitle,
  rangeDays,
  setRangeDays,
  trend,
}: {
  subtitle: string
  rangeDays: number
  setRangeDays: (days: number) => void
  trend: AdminContentTrendItem[]
}) {
  const peakValue = Math.max(1, ...trend.flatMap((item) => [item.topicCount, item.commentCount, item.likeCount]))

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">成员互动数据</div>
          <div className="resource-section-subtitle">{subtitle}</div>
        </div>
        <div className="resource-range-tabs">
          {quickRangeDays.map((item) => (
            <button
              className={item === rangeDays ? 'is-active' : ''}
              key={item}
              onClick={() => setRangeDays(item)}
              type="button"
            >
              {`近${item}天`}
            </button>
          ))}
        </div>
      </div>

      <div className="resource-trend-grid">
        <div className="content-trend-board">
          <div className="content-trend-legend">
            <span><i className="is-topic" />主题</span>
            <span><i className="is-comment" />评论</span>
            <span><i className="is-like" />点赞</span>
          </div>

          <div className="content-trend-chart">
            {trend.map((item) => (
              <div className="content-trend-column" key={item.date}>
                <div className="content-trend-bars">
                  <div
                    className="content-trend-bar is-topic"
                    style={{ height: `${Math.max(10, Math.round((item.topicCount / peakValue) * 132))}px` }}
                    title={`${item.label} / 主题 ${item.topicCount}`}
                  />
                  <div
                    className="content-trend-bar is-comment"
                    style={{ height: `${Math.max(10, Math.round((item.commentCount / peakValue) * 132))}px` }}
                    title={`${item.label} / 评论 ${item.commentCount}`}
                  />
                  <div
                    className="content-trend-bar is-like"
                    style={{ height: `${Math.max(10, Math.round((item.likeCount / peakValue) * 132))}px` }}
                    title={`${item.label} / 点赞 ${item.likeCount}`}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="resource-trend-metrics">
          {trend.slice(-3).map((item) => (
            <article className="resource-trend-metric" key={item.date}>
              <div className="resource-trend-metric-day">{item.label}</div>
              <div>{`主题 ${item.topicCount}`}</div>
              <div>{`文件 ${item.fileCount} / 图片 ${item.imageCount}`}</div>
              <div>{`评论 ${item.commentCount}`}</div>
              <div>{`点赞 ${item.likeCount}`}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function MemberDetailDrawer({
  canManage,
  canViewMemberContact,
  item,
  onClose,
  onApprove,
  onReject,
  saving,
}: {
  canManage: boolean
  canViewMemberContact: boolean
  item: AdminMemberItem | null
  onClose: () => void
  onApprove: (reason: string) => void
  onReject: (reason: string) => void
  saving: boolean
}) {
  const [reviewReason, setReviewReason] = useState('')

  useEffect(() => {
    setReviewReason(item?.reviewReason || '')
  }, [item?.id, item?.reviewReason])

  if (!item) return null

  const isApplication = item.sourceType === 'APPLICATION'
  const isRejected = item.status === 'REJECTED'

  return (
    <aside className="resource-drawer">
      <div className="resource-drawer-header">
        <div>
          <div className="resource-drawer-title">{item.nickname}</div>
          <div className="resource-drawer-subtitle">{`${item.roleLabel} · ${item.statusLabel}`}</div>
        </div>
        <button onClick={onClose} type="button">
          关闭
        </button>
      </div>

      <div className="resource-drawer-section">
        <div className="resource-drawer-row">
          <span>手机号</span>
          <strong>{formatMemberContactValue(item.mobile, canViewMemberContact)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>微信号</span>
          <strong>{formatMemberContactValue(item.wechatNo, canViewMemberContact)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>成员编号</span>
          <strong>{item.memberNo ?? '-'}</strong>
        </div>
        {isApplication ? (
          <div className="resource-drawer-row">
            <span>申请单号</span>
            <strong>{item.orderNo || '-'}</strong>
          </div>
        ) : null}
        <div className="resource-drawer-row">
          <span>{isApplication ? '申请时间' : '首次加入时间'}</span>
          <strong>{formatDateTime(isApplication ? item.appliedAt || item.firstJoinedAt : item.firstJoinedAt)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>最后活跃时间</span>
          <strong>{formatDateTime(item.lastActiveAt)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>到期时间</span>
          <strong>{formatDateOnly(item.expireAt)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>已续期数</span>
          <strong>{item.renewTimes}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>主题数</span>
          <strong>{item.topicCount}</strong>
        </div>
        {isApplication ? (
          <div className="resource-drawer-row">
            <span>审核时间</span>
            <strong>{formatDateTime(item.reviewedAt || '')}</strong>
          </div>
        ) : null}
        {isApplication ? (
          <div className="resource-drawer-row">
            <span>重新提交次数</span>
            <strong>{item.reapplyCount || 0}</strong>
          </div>
        ) : null}
        {isApplication ? (
          <div className="resource-drawer-row">
            <span>最近重提时间</span>
            <strong>{formatDateTime(item.lastReappliedAt || '')}</strong>
          </div>
        ) : null}
        {isApplication ? (
          <div className="resource-drawer-row">
            <span>审核备注</span>
            <strong>{item.reviewReason || '-'}</strong>
          </div>
        ) : null}
      </div>

      {isApplication && !canManage ? (
        <div className="admin-inline-tip">当前角色仅可查看申请详情，不能执行通过或驳回。</div>
      ) : null}

      {isApplication && canManage ? (
        <>
          <div className="resource-drawer-form">
            <label className="resource-drawer-field">
              <span>审核备注</span>
              <textarea
                onChange={(event) => setReviewReason(event.target.value)}
                placeholder="驳回时填写原因，已驳回申请可以继续补充说明"
                rows={4}
                value={reviewReason}
              />
            </label>
          </div>

          <div className="resource-drawer-actions">
            <button className="admin-resource-submit" disabled={saving} onClick={() => onApprove(reviewReason)} type="button">
              {saving ? '处理中...' : isRejected ? '改为通过' : '通过审核'}
            </button>
            <button className="admin-resource-ghost" disabled={saving} onClick={() => onReject(reviewReason)} type="button">
              {saving ? '处理中...' : isRejected ? '更新驳回' : '驳回申请'}
            </button>
          </div>
        </>
      ) : null}
    </aside>
  )
}

function ContentDetailDrawer({
  canManage,
  canCreateColumn,
  changedSections,
  columns,
  columnsLoading,
  creatingColumn,
  createColumnDraft,
  draft,
  hasUnsavedChanges,
  item,
  onChange,
  onCreateColumn,
  onCreateColumnDraftChange,
  onClose,
  onQuickReportAction,
  onReset,
  onSave,
  saving,
}: {
  canManage: boolean
  canCreateColumn: boolean
  changedSections: string[]
  columns: AdminColumnItem[]
  columnsLoading: boolean
  creatingColumn: boolean
  createColumnDraft: string
  draft: ContentDraftState
  hasUnsavedChanges: boolean
  item: AdminContentItem | null
  onChange: (patch: Partial<ContentDraftState>) => void
  onCreateColumn: () => void
  onCreateColumnDraftChange: (value: string) => void
  onClose: () => void
  onQuickReportAction: (action: 'hideResolve' | 'ignore') => void
  onReset: () => void
  onSave: () => void
  saving: boolean
}) {
  if (!item) return null
  const hasReports = draft.reportTotal > 0
  const hasPendingReports = draft.reportStatus === 'PENDING' || draft.reportPendingCount > 0
  const reportTimeline = [...(item.reportLogs || [])].reverse()
  const reportStatusOptions = [
    draft.reportStatus === 'PENDING' || draft.reportPendingCount
      ? { value: 'PENDING', label: '待处理举报' }
      : null,
    hasReports || draft.reportStatus === 'RESOLVED'
      ? { value: 'RESOLVED', label: '已处理举报' }
      : null,
    hasReports || draft.reportStatus === 'IGNORED'
      ? { value: 'IGNORED', label: '已忽略举报' }
      : null,
  ].filter((itemValue): itemValue is { value: string; label: string } => Boolean(itemValue))

  return (
    <aside className="resource-drawer">
      <div className="resource-drawer-header">
        <div>
          <div className="resource-drawer-title">{item.title}</div>
          <div className="resource-drawer-subtitle">{`${item.authorName} · ${item.typeLabel}`}</div>
        </div>
        <button onClick={onClose} type="button">
          关闭
        </button>
      </div>

      <div className="resource-drawer-section">
        <div className="resource-drawer-row">
          <span>发布时间</span>
          <strong>{formatDateTime(item.publishedAt || item.createdAt)}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>阅读 / 点赞 / 评论</span>
          <strong>{`${item.readingCount} / ${item.likeCount} / ${item.commentCount}`}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>专栏</span>
          <strong>{item.columnTitle || item.columnId || '-'}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>举报状态</span>
          <strong>{hasReports ? `${item.reportStatusLabel} · 共 ${item.reportTotal} 条` : '当前没有举报记录'}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>举报概览</span>
          <strong>{hasReports ? `待处理 ${item.reportPendingCount} · 已处理 ${item.reportResolvedCount} · 已忽略 ${item.reportIgnoredCount}` : '-'}</strong>
        </div>
        <div className="resource-drawer-row">
          <span>最近举报</span>
          <strong>{item.latestReportedAt ? `${formatDateTime(item.latestReportedAt)} · ${item.latestReportReason || '未填写原因'}` : '-'}</strong>
        </div>
      </div>

      {hasReports ? (
        <div className="resource-drawer-section">
          <div className="resource-drawer-report-header">
            <div className="resource-drawer-report-title">举报时间线</div>
            <span className="resource-drawer-report-hint">{hasPendingReports ? '仍有待处理举报' : '当前举报已处理完成'}</span>
          </div>
          {hasPendingReports && canManage ? (
            <div className="resource-drawer-quick-actions">
              <button className="admin-resource-submit" disabled={saving} onClick={() => onQuickReportAction('hideResolve')} type="button">
                {saving ? '处理中...' : '隐藏并处理'}
              </button>
              <button className="admin-resource-ghost" disabled={saving} onClick={() => onQuickReportAction('ignore')} type="button">
                {saving ? '处理中...' : '忽略举报'}
              </button>
            </div>
          ) : null}
          <div className="resource-drawer-report-list">
            {reportTimeline.length ? (
              reportTimeline.map((report) => (
                <div className="resource-drawer-report-item" key={report.id}>
                  <div className="resource-drawer-report-top">
                    <strong>{report.reporterName || '匿名成员'}</strong>
                    <span className={`resource-table-chip ${buildContentReportChipClass(report.status)}`}>{report.statusLabel}</span>
                  </div>
                  <div className="resource-drawer-report-meta">{`举报于 ${formatDateTime(report.createdAt)}`}</div>
                  <div className="resource-drawer-report-reason">{report.reason || '未填写举报原因'}</div>
                  {report.resolvedAt ? <div className="resource-drawer-report-meta">{`处理于 ${formatDateTime(report.resolvedAt)}`}</div> : null}
                  {report.resolutionNote ? <div className="resource-drawer-report-note">{report.resolutionNote}</div> : null}
                </div>
              ))
            ) : (
              <div className="resource-drawer-report-item">
                <div className="resource-drawer-report-meta">当前只有举报统计，没有完整时间线记录。</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!canManage ? <div className="admin-inline-tip">当前角色仅可查看内容详情，不能修改状态、处理举报或调整专栏。</div> : null}
      {canManage && hasUnsavedChanges ? (
        <div className="admin-inline-tip">{`当前详情有未保存修改：${changedSections.join(' / ')}。`}</div>
      ) : null}

      <div className="resource-drawer-form">
        <label className="resource-drawer-field">
          <span>内容状态</span>
          <select disabled={!canManage} value={draft.status} onChange={(event) => onChange({ status: event.target.value })}>
            <option value="PUBLISHED">已发布</option>
            <option value="HIDDEN">已隐藏</option>
            <option value="DRAFT">草稿</option>
            <option value="DELETED">已删除</option>
          </select>
        </label>

        <label className="resource-drawer-field">
          <span>收进专栏</span>
          <select disabled={!canManage} value={draft.columnId} onChange={(event) => onChange({ columnId: event.target.value })}>
            <option value="">{columnsLoading ? '专栏加载中...' : '暂不收进专栏'}</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {`${column.title} · ${column.count} 篇`}
              </option>
            ))}
          </select>
          {!columnsLoading && !columns.length ? <span className="resource-drawer-field-hint">当前星球还没有专栏，保存时会按未归栏处理。</span> : null}
        </label>

        {canCreateColumn && canManage ? (
          <label className="resource-drawer-field">
            <span>新建专栏</span>
            <div className="resource-inline-input">
              <input
                maxLength={24}
                onChange={(event) => onCreateColumnDraftChange(event.target.value)}
                placeholder="例如：精华解读"
                value={createColumnDraft}
              />
              <button className="admin-resource-ghost" disabled={creatingColumn || !createColumnDraft.trim()} onClick={onCreateColumn} type="button">
                {creatingColumn ? '创建中...' : '创建'}
              </button>
            </div>
          </label>
        ) : null}

        <label className="resource-drawer-field">
          <span>审核状态</span>
          <select disabled={!canManage} value={draft.reviewStatus} onChange={(event) => onChange({ reviewStatus: event.target.value })}>
            <option value="UNSET">未审核</option>
            <option value="APPROVED">已通过</option>
            <option value="PENDING">审核中</option>
            <option value="REJECTED">已驳回</option>
          </select>
        </label>

        <label className="resource-drawer-field">
          <span>审核原因</span>
          <textarea
            disabled={!canManage}
            onChange={(event) => onChange({ reviewReason: event.target.value })}
            placeholder="审核驳回时填写"
            rows={4}
            value={draft.reviewReason}
          />
        </label>

        <label className="resource-drawer-field">
          <span>举报处理</span>
          <select disabled={!canManage || !hasReports} value={hasReports ? draft.reportStatus : 'UNSET'} onChange={(event) => onChange({ reportStatus: event.target.value })}>
            {!hasReports ? <option value="UNSET">当前没有举报</option> : null}
            {reportStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!hasReports ? <span className="resource-drawer-field-hint">用户侧尚未对这条内容发起投诉。</span> : null}
        </label>

        <label className="resource-drawer-field">
          <span>举报处理备注</span>
          <textarea
            disabled={!canManage || !hasReports}
            maxLength={120}
            onChange={(event) => onChange({ reportResolutionNote: event.target.value })}
            placeholder={hasReports ? '处理举报时填写，用户后续复核时可引用这段说明' : '当前没有举报记录'}
            rows={4}
            value={draft.reportResolutionNote}
          />
        </label>

        <label className="resource-drawer-check">
          <input checked={draft.isPinned} disabled={!canManage} onChange={(event) => onChange({ isPinned: event.target.checked })} type="checkbox" />
          <span>设为置顶</span>
        </label>
        <label className="resource-drawer-check">
          <input checked={draft.isEssence} disabled={!canManage} onChange={(event) => onChange({ isEssence: event.target.checked })} type="checkbox" />
          <span>设为精华</span>
        </label>
      </div>

      <div className="resource-drawer-actions">
        <button className="admin-resource-ghost" onClick={onClose} type="button">
          取消
        </button>
        <button className="admin-resource-ghost" disabled={!canManage || saving || !hasUnsavedChanges} onClick={onReset} type="button">
          恢复当前内容设置
        </button>
        <button className="admin-resource-submit" disabled={!canManage || saving} onClick={onSave} type="button">
          {saving ? '保存中...' : canManage ? '保存内容设置' : '当前为只读'}
        </button>
      </div>
    </aside>
  )
}

export function AdminResourcePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const mode: ResourceMode = location.pathname === '/activity/content' ? 'content' : 'members'
  const requestedQuery = useMemo(() => readResourceQuery(mode, location.search), [location.search, mode])
  const [status, setStatus] = useState(requestedQuery.status)
  const [sourceType, setSourceType] = useState<AdminMemberSourceType>(requestedQuery.sourceType)
  const [type, setType] = useState(requestedQuery.type)
  const [reviewStatus, setReviewStatus] = useState(requestedQuery.reviewStatus)
  const [reportStatus, setReportStatus] = useState(requestedQuery.reportStatus)
  const [columnFilter, setColumnFilter] = useState(requestedQuery.columnFilter)
  const [searchInput, setSearchInput] = useState(requestedQuery.search)
  const [search, setSearch] = useState(requestedQuery.search)
  const [startDate, setStartDate] = useState(requestedQuery.startDate)
  const [endDate, setEndDate] = useState(requestedQuery.endDate)
  const [rangeDays, setRangeDays] = useState(requestedQuery.rangeDays)
  const [page, setPage] = useState(requestedQuery.page)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [membersData, setMembersData] = useState<AdminMembersPayload['data'] | null>(null)
  const [contentData, setContentData] = useState<AdminContentPayload['data'] | null>(null)
  const [contentColumns, setContentColumns] = useState<AdminColumnItem[]>([])
  const [contentCanCreateColumn, setContentCanCreateColumn] = useState(false)
  const [contentColumnsLoading, setContentColumnsLoading] = useState(false)
  const [contentColumnDraft, setContentColumnDraft] = useState('')
  const [creatingContentColumn, setCreatingContentColumn] = useState(false)
  const [selectedMember, setSelectedMember] = useState<AdminMemberItem | null>(null)
  const [selectedContent, setSelectedContent] = useState<AdminContentItem | null>(null)
  const [contentDraft, setContentDraft] = useState<ContentDraftState | null>(null)
  const [inlineRejectTargetId, setInlineRejectTargetId] = useState('')
  const [inlineRejectReason, setInlineRejectReason] = useState('')
  const [savingMember, setSavingMember] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [exportingAction, setExportingAction] = useState('')

  const isApplicationFocused = mode === 'members' && (sourceType === 'APPLICATION' || status === 'PENDING' || status === 'REJECTED')
  const pageTitle = mode === 'members' ? (isApplicationFocused ? '成员审核' : '成员活跃') : '文章管理'
  const pageSubtitle =
    mode === 'members'
      ? isApplicationFocused
        ? '优先对齐真实后台里的成员审核工作台、申请队列和报表导出。'
        : '优先对齐真实后台里的数据概览、活跃情况、成员活跃数据和成员报表。'
      : '优先对齐文章列表、上下架、详情查看和文章运营工作台。'

  useEffect(() => {
    setStatus(requestedQuery.status)
    setSourceType(requestedQuery.sourceType)
    setType(requestedQuery.type)
    setReviewStatus(requestedQuery.reviewStatus)
    setReportStatus(requestedQuery.reportStatus)
    setColumnFilter(requestedQuery.columnFilter)
    setSearchInput(requestedQuery.search)
    setSearch(requestedQuery.search)
    setStartDate(requestedQuery.startDate)
    setEndDate(requestedQuery.endDate)
    setRangeDays(requestedQuery.rangeDays)
    setPage(requestedQuery.page)
    setSelectedMember(null)
    setSelectedContent(null)
    setContentDraft(null)
    setContentColumns([])
    setContentCanCreateColumn(false)
    setContentColumnDraft('')
    setInlineRejectTargetId('')
    setInlineRejectReason('')
    setNotice('')
    setError('')
  }, [
    groupId,
    mode,
    requestedQuery.columnFilter,
    requestedQuery.endDate,
    requestedQuery.page,
    requestedQuery.rangeDays,
    requestedQuery.reportStatus,
    requestedQuery.reviewStatus,
    requestedQuery.search,
    requestedQuery.sourceType,
    requestedQuery.startDate,
    requestedQuery.status,
    requestedQuery.type,
  ])

  useEffect(() => {
    const nextSearchParams = new URLSearchParams()

    if (groupId) {
      nextSearchParams.set('groupId', groupId)
    }

    if (status !== 'ALL') {
      nextSearchParams.set('status', status)
    }

    if (mode === 'members') {
      if (sourceType !== 'ALL') {
        nextSearchParams.set('sourceType', sourceType)
      }
    } else {
      if (type !== 'ALL') {
        nextSearchParams.set('type', type)
      }

      if (reviewStatus !== 'ALL') {
        nextSearchParams.set('reviewStatus', reviewStatus)
      }

      if (reportStatus !== 'ALL') {
        nextSearchParams.set('reportStatus', reportStatus)
      }

      if (columnFilter) {
        nextSearchParams.set('columnId', columnFilter)
      }
    }

    if (search) {
      nextSearchParams.set('search', search)
    }

    if (startDate) {
      nextSearchParams.set('startDate', startDate)
    }

    if (endDate) {
      nextSearchParams.set('endDate', endDate)
    }

    if (rangeDays !== 7) {
      nextSearchParams.set('rangeDays', String(rangeDays))
    }

    if (page > 1) {
      nextSearchParams.set('page', String(page))
    }

    if (mode === 'members' && selectedMember?.id) {
      nextSearchParams.set('memberId', selectedMember.id)
    }

    if (mode === 'content' && selectedContent?.id) {
      nextSearchParams.set('contentId', selectedContent.id)
    }

    const nextSearch = nextSearchParams.toString()
    const currentSearch = location.search.replace(/^\?/, '')

    if (nextSearch !== currentSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
        },
        { replace: true },
      )
    }
  }, [
    columnFilter,
    endDate,
    groupId,
    location.pathname,
    location.search,
    mode,
    navigate,
    page,
    rangeDays,
    reportStatus,
    reviewStatus,
    search,
    selectedContent?.id,
    selectedMember?.id,
    sourceType,
    startDate,
    status,
    type,
  ])

  useEffect(() => {
    if (!groupId) {
      setMembersData(null)
      setContentData(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    async function loadData() {
      try {
        if (mode === 'members') {
          const payload = await getAdminMembers({
            groupId,
            status,
            sourceType,
            search,
            startDate,
            endDate,
            rangeDays,
            page,
          })

          if (!active) return
          setMembersData(payload.data)
          setContentData(null)

          return
        }

        const payload = await getAdminContent({
          groupId,
          status,
          type,
          reviewStatus,
          reportStatus,
          columnId: columnFilter,
          search,
          startDate,
          endDate,
          rangeDays,
          page,
        })

        if (!active) return
        setContentData(payload.data)
        setMembersData(null)

      } catch (requestError) {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : '加载页面失败')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [mode, groupId, status, sourceType, type, reviewStatus, reportStatus, columnFilter, search, startDate, endDate, rangeDays, page])

  useEffect(() => {
    if (!groupId || mode !== 'content') {
      setContentColumns([])
      setContentCanCreateColumn(false)
      setContentColumnsLoading(false)
      return
    }

    let active = true
    setContentColumnsLoading(true)

    void getAdminColumns(groupId)
      .then((payload) => {
        if (!active) return
        setContentColumns(payload.data.items || [])
        setContentCanCreateColumn(Boolean(payload.data.canCreateColumn))
      })
      .catch(() => {
        if (!active) return
        setContentColumns([])
        setContentCanCreateColumn(false)
      })
      .finally(() => {
        if (active) {
          setContentColumnsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId, mode])

  useEffect(() => {
    if (!selectedMember || !membersData) return

    const nextItem = membersData.items.find((item) => item.id === selectedMember.id) || null
    if (!nextItem) {
      setSelectedMember(null)
      return
    }

    if (nextItem !== selectedMember) {
      setSelectedMember(nextItem)
    }
  }, [membersData, selectedMember])

  useEffect(() => {
    if (!selectedContent || !contentData) return

    const nextItem = contentData.items.find((item) => item.id === selectedContent.id) || null
    if (!nextItem) {
      setSelectedContent(null)
      setContentDraft(null)
      return
    }

    if (nextItem !== selectedContent) {
      setSelectedContent(nextItem)
      setContentDraft(buildContentDraft(nextItem))
    }
  }, [contentData, selectedContent])

  useEffect(() => {
    if (mode !== 'members') {
      return
    }

    if (!requestedQuery.memberId) {
      setSelectedMember(null)
      return
    }

    const nextItem = membersData?.items.find((item) => item.id === requestedQuery.memberId) || null
    setSelectedMember((currentValue) => (currentValue?.id === nextItem?.id ? currentValue : nextItem))
  }, [membersData, mode, requestedQuery.memberId])

  useEffect(() => {
    if (mode !== 'content') {
      return
    }

    if (!requestedQuery.contentId) {
      setSelectedContent(null)
      setContentDraft(null)
      return
    }

    const nextItem = contentData?.items.find((item) => item.id === requestedQuery.contentId) || null
    setSelectedContent((currentValue) => (currentValue?.id === nextItem?.id ? currentValue : nextItem))
    setContentDraft((currentValue) => {
      if (!nextItem) {
        return null
      }

      if (currentValue && selectedContent?.id === nextItem.id) {
        return currentValue
      }

      return buildContentDraft(nextItem)
    })
  }, [contentData, mode, requestedQuery.contentId, selectedContent?.id])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const currentMembersData = membersData
  const currentContentData = contentData
  const pagination = mode === 'members' ? currentMembersData?.pagination : currentContentData?.pagination
  const group = mode === 'members' ? currentMembersData?.group : currentContentData?.group
  const memberViewer = currentMembersData?.viewer || null
  const contentViewer = currentContentData?.viewer || null
  const canViewMemberContact = memberViewer?.capabilities.canViewMemberContact ?? currentGroup?.isOwner ?? false
  const canManageMembers = memberViewer?.capabilities.canManageMembers ?? currentGroup?.isOwner ?? false
  const canManageContent = contentViewer?.capabilities.canManageContent ?? currentGroup?.isOwner ?? false
  const memberSearchPlaceholder = buildMemberSearchPlaceholder(sourceType, canViewMemberContact)
  const hasApplicationRows = Boolean(currentMembersData?.items.some((item) => item.sourceType === 'APPLICATION'))
  const pendingApplicationCount = currentMembersData?.summary.pendingApproval || 0
  const rejectedApplicationCount = currentMembersData?.summary.rejectedApproval || 0
  const totalApplicationCount = currentMembersData?.summary.applicationTotal || 0
  const reapplyApplicationCount = currentMembersData?.summary.reappliedApproval || 0
  const urgentApplicationCount = currentMembersData?.summary.urgentPendingApproval || 0
  const latestApplicationSubmittedAt = currentMembersData?.summary.latestApplicationSubmittedAt || ''
  const oldestPendingApplicationAt = currentMembersData?.summary.oldestPendingApplicationAt || ''
  const latestApplicationReappliedAt = currentMembersData?.summary.latestReappliedAt || ''
  const contentPendingReportCount = currentContentData?.summary.reportPending || 0
  const contentResolvedReportCount = currentContentData?.summary.reportResolved || 0
  const contentIgnoredReportCount = currentContentData?.summary.reportIgnored || 0
  const contentReportTotalCount = currentContentData?.summary.reportTotal || 0
  const latestContentReportedAt = currentContentData?.summary.latestReportedAt || ''
  const memberRecordCount = currentMembersData
    ? currentMembersData.summary.active + currentMembersData.summary.expired + currentMembersData.summary.banned + currentMembersData.summary.quit
    : 0
  const mixedRecordCount = memberRecordCount + totalApplicationCount

  const memberOverview = currentMembersData
    ? isApplicationFocused
      ? [
          {
            label: '全部申请',
            value: totalApplicationCount,
            hint: latestApplicationSubmittedAt ? `最近提交 ${formatDateTime(latestApplicationSubmittedAt)}` : '当前没有待处理申请数据',
          },
          {
            label: '待审核申请',
            value: currentMembersData.summary.pendingApproval,
            hint: oldestPendingApplicationAt ? `最早待处理 ${formatDateTime(oldestPendingApplicationAt)}` : '当前没有待审核积压',
          },
          {
            label: '已驳回申请',
            value: currentMembersData.summary.rejectedApproval,
            hint: '便于核对驳回原因和用户侧提示',
          },
          {
            label: '已重提申请',
            value: reapplyApplicationCount,
            hint: latestApplicationReappliedAt ? `最近重提 ${formatDateTime(latestApplicationReappliedAt)}` : '当前没有重提记录',
          },
          {
            label: '重提待审核',
            value: urgentApplicationCount,
            hint: urgentApplicationCount ? '建议优先处理这些重复提交的申请' : '当前没有重提急件',
          },
          {
            label: '当前筛选命中',
            value: currentMembersData.pagination.total,
            hint: `当前视图：${buildApplicationStatusLabel(status)}`,
          },
        ]
      : [
          {
            label: '总成员数',
            value: currentMembersData.summary.overview.totalCurrent,
            hint: `昨日加入成员 ${currentMembersData.summary.overview.totalJoinedYesterday}`,
          },
          {
            label: '付费加入成员',
            value: currentMembersData.summary.overview.paidCurrent,
            hint: `昨日加入成员 ${currentMembersData.summary.overview.paidJoinedYesterday}`,
          },
          {
            label: '免费加入成员',
            value: currentMembersData.summary.overview.freeCurrent,
            hint: `昨日加入成员 ${currentMembersData.summary.overview.freeJoinedYesterday}`,
          },
          {
            label: '退出成员',
            value: currentMembersData.summary.overview.quitTotal,
            hint: `昨日退出成员 ${currentMembersData.summary.overview.quitYesterday}`,
          },
          {
            label: '待审核加入',
            value: currentMembersData.summary.pendingApproval,
            hint: '已支付但尚未通过成员审核',
          },
          {
            label: '已驳回申请',
            value: currentMembersData.summary.rejectedApproval,
            hint: '便于核对驳回原因和用户侧提示',
          },
        ]
    : []

  const contentOverview = currentContentData
    ? currentContentData.summary.filtersApplied
      ? [
          {
            label: '主题数',
            value: currentContentData.summary.filtered.topicTotal,
            hint: `当前筛选命中 ${currentContentData.summary.filtered.total} 条内容`,
          },
          {
            label: '文件数',
            value: currentContentData.summary.filtered.fileTotal,
            hint: `当前筛选内含文件内容 ${currentContentData.summary.filtered.fileTotal} 篇`,
          },
          {
            label: '图片数',
            value: currentContentData.summary.filtered.imageTotal,
            hint: `当前筛选内含图片内容 ${currentContentData.summary.filtered.imageTotal} 篇`,
          },
          {
            label: '评论数',
            value: currentContentData.summary.filtered.commentTotal,
            hint: '当前筛选结果的累计评论数',
          },
          {
            label: '点赞数',
            value: currentContentData.summary.filtered.likeTotal,
            hint: '当前筛选结果的累计点赞数',
          },
          {
            label: '专栏数',
            value: currentContentData.summary.filtered.columnCount,
            hint: currentContentData.summary.filtered.columnCount
              ? `当前筛选覆盖 ${currentContentData.summary.filtered.columnCount} 个专栏`
              : '当前筛选结果未归入任何专栏',
          },
        ]
      : [
          { label: '主题数', value: currentContentData.summary.overview.topicTotal, hint: `昨日新增主题 ${currentContentData.summary.overview.topicAddedYesterday}` },
          { label: '文件数', value: currentContentData.summary.overview.fileTotal, hint: `昨日新增文件 ${currentContentData.summary.overview.fileAddedYesterday}` },
          { label: '图片数', value: currentContentData.summary.overview.imageTotal, hint: `昨日新增图片 ${currentContentData.summary.overview.imageAddedYesterday}` },
          {
            label: '评论数',
            value: currentContentData.summary.overview.commentTotal,
            hint: `昨日新增评论 ${currentContentData.summary.overview.commentAddedYesterday}`,
          },
          { label: '点赞数', value: currentContentData.summary.overview.likeTotal, hint: `昨日新增点赞 ${currentContentData.summary.overview.likeAddedYesterday}` },
          {
            label: '专栏数',
            value: contentColumns.length,
            hint: contentColumns.length ? `当前已建 ${contentColumns.length} 个专栏` : '当前还没有建立专栏',
          },
        ]
    : []

  const selectedColumnMeta = columnFilter ? contentColumns.find((item) => item.id === columnFilter) || null : null
  const memberStatusOptions =
    sourceType === 'APPLICATION'
      ? [
          { value: 'ALL', label: '全部申请' },
          { value: 'PENDING', label: '待审核申请' },
          { value: 'REJECTED', label: '已驳回申请' },
        ]
      : sourceType === 'MEMBER'
        ? [
            { value: 'ALL', label: '全部成员' },
            { value: 'ACTIVE', label: '有效' },
            { value: 'EXPIRED', label: '已过期' },
            { value: 'BANNED', label: '已封禁' },
            { value: 'QUIT', label: '已退出' },
          ]
        : [
            { value: 'ALL', label: '全部' },
            { value: 'ACTIVE', label: '有效成员' },
            { value: 'EXPIRED', label: '已过期成员' },
            { value: 'BANNED', label: '已封禁成员' },
            { value: 'QUIT', label: '已退出成员' },
            { value: 'PENDING', label: '待审核申请' },
            { value: 'REJECTED', label: '已驳回申请' },
          ]
  const memberReportSubtitle =
    isApplicationFocused
      ? `当前仅按审核口径查看申请，全部申请 ${totalApplicationCount} 条，当前命中 ${currentMembersData?.pagination.total ?? 0} 条；导出和分页都只作用于申请队列。`
      : sourceType === 'MEMBER'
        ? '当前仅查看正式成员，审核申请已收拢到上方工作台快捷入口。'
        : '真实后台的成员报表以加入时间筛选为主，这里补充了成员 / 申请来源和状态搜索，便于验证多状态样本。'
  const memberCurrentExportLabel = buildMemberExportLabel(sourceType, 'current')
  const memberAllExportLabel = buildMemberExportLabel(sourceType, 'all')
  const memberEmptyStateMessage = buildMemberEmptyStateMessage(sourceType, status)
  const contentTrendFiltered =
    status !== 'ALL' || type !== 'ALL' || reviewStatus !== 'ALL' || reportStatus !== 'ALL' || Boolean(columnFilter) || Boolean(search)
  const hasContentDateFilter = Boolean(startDate || endDate)
  const contentTrendSubtitle = contentTrendFiltered
    ? '当前走势图已按状态、类型、审核、举报、专栏和搜索条件联动，时间范围仍由近 7 / 15 / 30 天控制。'
    : hasContentDateFilter
      ? '开始时间和结束时间只作用于报表与顶部概览，走势图仍展示近 7 / 15 / 30 天整体互动走势。'
      : '按真实后台的主图区结构，优先保留时间范围、导出动作和按日互动走势。'
  const contentReportSubtitle = currentContentData
    ? currentContentData.summary.filtersApplied
      ? `当前筛选命中 ${currentContentData.summary.filtered.total} 条内容，其中已发布 ${currentContentData.summary.filtered.published} / 草稿 ${currentContentData.summary.filtered.draft} / 隐藏 ${currentContentData.summary.filtered.hidden} / 已删除 ${currentContentData.summary.filtered.deleted}；举报队列中待处理 ${contentPendingReportCount} 条。${selectedColumnMeta ? ` 当前按专栏「${selectedColumnMeta.title}」筛选。` : currentContentData.summary.filtered.columnCount ? ` 当前筛选覆盖 ${currentContentData.summary.filtered.columnCount} 个专栏。` : ''}`
      : `已发布 ${currentContentData.summary.published} / 草稿 ${currentContentData.summary.draft} / 隐藏 ${currentContentData.summary.hidden} / 已删除 ${currentContentData.summary.deleted}，当前举报队列共 ${contentReportTotalCount} 条、待处理 ${contentPendingReportCount} 条。${selectedColumnMeta ? ` 当前按专栏「${selectedColumnMeta.title}」筛选。` : contentColumns.length ? ` 当前共维护 ${contentColumns.length} 个专栏。` : ''}`
    : '真实后台以主题发布时间报表为主，这里额外补了举报状态和处理备注，用于闭环验证内容投诉流。'
  const contentColumnLabelMap = useMemo(
    () => new Map(contentColumns.map((item) => [item.id, item.title])),
    [contentColumns],
  )

  const contentDraftBaseline = useMemo(() => (selectedContent ? buildContentDraft(selectedContent) : null), [selectedContent])
  const contentDraftChanged = useMemo(() => {
    if (!contentDraft || !contentDraftBaseline) return false
    return JSON.stringify(contentDraft) !== JSON.stringify(contentDraftBaseline)
  }, [contentDraft, contentDraftBaseline])
  const contentDraftChangedSections = useMemo(() => {
    if (!contentDraft || !contentDraftBaseline) return []
    return buildContentDraftChangedSections(contentDraft, contentDraftBaseline)
  }, [contentDraft, contentDraftBaseline])

  const confirmDiscardContentDraft = useCallback(() => {
    if (mode !== 'content' || !canManageContent || !contentDraftChanged || savingContent) {
      return true
    }

    return window.confirm('当前内容修改尚未保存，继续操作会丢失本次修改。是否继续？')
  }, [canManageContent, contentDraftChanged, mode, savingContent])

  useEffect(() => {
    if (mode !== 'content' || !canManageContent || !contentDraftChanged) {
      return undefined
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [canManageContent, contentDraftChanged, mode])

  const currentPageSize = pagination?.pageSize || 20
  const hasActiveFilters =
    status !== 'ALL' ||
    search !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    rangeDays !== 7 ||
    page !== 1 ||
    (mode === 'members'
      ? sourceType !== 'ALL'
      : type !== 'ALL' || reviewStatus !== 'ALL' || reportStatus !== 'ALL' || columnFilter !== '')

  function setContentRangeDays(nextValue: number) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setRangeDays(nextValue)
    setPage(1)
  }

  function setContentPage(nextValue: number) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setPage(nextValue)
  }

  function setContentStatus(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setStatus(nextValue)
    setPage(1)
  }

  function setContentTypeFilter(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setType(nextValue)
    setPage(1)
  }

  function setContentReviewStatusFilter(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setReviewStatus(nextValue)
    setPage(1)
  }

  function setContentReportStatusFilter(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setReportStatus(nextValue)
    setPage(1)
  }

  function setContentColumnFilterValue(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setColumnFilter(nextValue)
    setPage(1)
  }

  function setContentStartDate(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setStartDate(nextValue)
    setPage(1)
  }

  function setContentEndDate(nextValue: string) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setEndDate(nextValue)
    setPage(1)
  }

  function resetContentFilters() {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setStatus('ALL')
    setType('ALL')
    setReviewStatus('ALL')
    setReportStatus('ALL')
    setColumnFilter('')
    setSearchInput('')
    setSearch('')
    setStartDate('')
    setEndDate('')
    setRangeDays(7)
    setPage(1)
  }

  function handleSearchCommit() {
    if (mode === 'content' && !confirmDiscardContentDraft()) {
      return
    }

    setSearch(searchInput.trim())
    setPage(1)
  }

  function handleResetFilters() {
    if (mode === 'content') {
      resetContentFilters()
      return
    }

    setStatus('ALL')
    setSourceType('ALL')
    setType('ALL')
    setReviewStatus('ALL')
    setReportStatus('ALL')
    setColumnFilter('')
    setSearchInput('')
    setSearch('')
    setStartDate('')
    setEndDate('')
    setRangeDays(7)
    setPage(1)
  }

  function handleMemberSourceTypeChange(nextSourceType: AdminMemberSourceType) {
    setSourceType(nextSourceType)
    setPage(1)

    if (nextSourceType === 'APPLICATION' && !['ALL', 'PENDING', 'REJECTED'].includes(status)) {
      setStatus('ALL')
      return
    }

    if (nextSourceType === 'MEMBER' && ['PENDING', 'REJECTED'].includes(status)) {
      setStatus('ALL')
    }
  }

  function getContentColumnLabel(item: AdminContentItem) {
    if (!item.columnId) {
      return ''
    }

    return item.columnTitle || contentColumnLabelMap.get(item.columnId) || item.columnId
  }

  async function submitMemberReview(targetItem: AdminMemberItem, action: 'APPROVE' | 'REJECT', reason: string) {
    if (!targetItem.orderNo || !groupId || !canManageMembers) return false

    if (action === 'REJECT' && !reason.trim()) {
      setError('驳回申请时请填写原因')
      return false
    }

    setSavingMember(true)
    setError('')
    setNotice('')

    try {
      await updateAdminMemberReview({
        groupId,
        orderNo: targetItem.orderNo,
        action,
        reviewReason: reason.trim(),
      })

      const payload = await getAdminMembers({
        groupId,
        status,
        sourceType,
        search,
        startDate,
        endDate,
        rangeDays,
        page,
      })

      setMembersData(payload.data)
      setNotice(action === 'APPROVE' ? '成员申请已通过' : '成员申请已驳回')
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存成员审核失败')
      return false
    } finally {
      setSavingMember(false)
    }
  }

  async function handleReviewMember(action: 'APPROVE' | 'REJECT', reason: string) {
    if (!selectedMember) return
    await submitMemberReview(selectedMember, action, reason)
  }

  function handleInlineRejectToggle(item: AdminMemberItem) {
    if (inlineRejectTargetId === item.id) {
      setInlineRejectTargetId('')
      setInlineRejectReason('')
      return
    }

    setInlineRejectTargetId(item.id)
    setInlineRejectReason(item.reviewReason || '')
  }

  async function handleInlineRejectSubmit(item: AdminMemberItem) {
    const success = await submitMemberReview(item, 'REJECT', inlineRejectReason)
    if (!success) return
    setInlineRejectTargetId('')
    setInlineRejectReason('')
  }

  async function handleExport(scope: 'current' | 'all') {
    const actionLabel = mode === 'members' ? buildMemberExportLabel(sourceType, scope) : '导出数据'

    setExportingAction(actionLabel)
    setError('')
    setNotice('')

    try {
      const payload =
        mode === 'members'
          ? await downloadAdminMembersExport(
              {
                groupId,
                status,
                sourceType,
                search,
                startDate,
                endDate,
                rangeDays,
                page,
                pageSize: currentPageSize,
              },
              scope,
            )
          : await downloadAdminContentExport(
              {
                groupId,
                status,
                type,
                reviewStatus,
                reportStatus,
                columnId: columnFilter,
                search,
                startDate,
                endDate,
                rangeDays,
                page,
                pageSize: currentPageSize,
              },
              scope,
            )

      triggerBrowserDownload(payload.blob, payload.fileName)
      setNotice(`${actionLabel} 已生成`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `${actionLabel} 失败`)
    } finally {
      setExportingAction('')
    }
  }

  async function handleSaveContent() {
    if (!selectedContent || !contentDraft || !contentDraftChanged || !canManageContent) return

    await submitContentDraft(contentDraft, '内容状态已保存')
  }

  function handleResetContentDraft() {
    if (!canManageContent || !contentDraftBaseline || !contentDraftChanged) return

    if (!window.confirm('确定恢复为当前已保存的内容设置吗？未保存修改会被清空。')) {
      return
    }

    setError('')
    setNotice('已恢复为当前内容设置')
    setContentDraft(contentDraftBaseline)
  }

  async function submitContentDraft(nextDraft: ContentDraftState, successMessage: string, targetItem: AdminContentItem | null = selectedContent) {
    if (!targetItem || !canManageContent) return false

    setSavingContent(true)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminContent({
        postId: targetItem.id,
        status: nextDraft.status,
        reviewStatus: nextDraft.reviewStatus === 'UNSET' ? '' : nextDraft.reviewStatus,
        reviewReason: nextDraft.reviewReason,
        reportStatus:
          nextDraft.reportTotal > 0 && nextDraft.reportStatus !== 'UNSET'
            ? nextDraft.reportStatus
            : undefined,
        reportResolutionNote: nextDraft.reportTotal > 0 ? nextDraft.reportResolutionNote : undefined,
        isPinned: nextDraft.isPinned,
        isEssence: nextDraft.isEssence,
        columnId: nextDraft.columnId,
      })

      const updatedItem = response.data
      if (selectedContent && selectedContent.id === updatedItem.id) {
        setSelectedContent(updatedItem)
        setContentDraft(buildContentDraft(updatedItem))
      }
      setContentData((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              items: currentValue.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
            }
          : currentValue,
      )
      if (groupId) {
        const contentPayload = await getAdminContent({
          groupId,
          status,
          type,
          reviewStatus,
          reportStatus,
          columnId: columnFilter,
          search,
          startDate,
          endDate,
          rangeDays,
          page,
        })
        setContentData(contentPayload.data)
        const columnPayload = await getAdminColumns(groupId)
        setContentColumns(columnPayload.data.items || [])
      }
      setNotice(successMessage)
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存内容状态失败')
      return false
    } finally {
      setSavingContent(false)
    }
  }

  async function handleQuickReportAction(action: 'hideResolve' | 'ignore') {
    if (!selectedContent || !contentDraft || contentDraft.reportTotal <= 0 || !canManageContent) return

    const hasPendingReports = contentDraft.reportStatus === 'PENDING' || contentDraft.reportPendingCount > 0
    if (!hasPendingReports) return

    const nextDraft = buildContentReportDecisionDraft(contentDraft, action)

    await submitContentDraft(nextDraft, action === 'hideResolve' ? '举报已处理，内容已隐藏' : '举报已标记为忽略')
  }

  async function handleInlineContentReportAction(item: AdminContentItem, action: 'hideResolve' | 'ignore') {
    if (!item.reportTotal || !item.reportPendingCount || !canManageContent) return

    const baseDraft = buildContentDraft(item)
    const nextDraft = buildContentReportDecisionDraft(baseDraft, action)

    await submitContentDraft(nextDraft, action === 'hideResolve' ? '举报已处理，内容已隐藏' : '举报已标记为忽略', item)
  }

  function openMemberDetail(item: AdminMemberItem) {
    setSelectedMember(item)
  }

  function closeMemberDetail() {
    setSelectedMember(null)
  }

  function openContentDetail(item: AdminContentItem) {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setSelectedContent(item)
    setContentDraft(buildContentDraft(item))
  }

  function closeContentDetail() {
    if (!confirmDiscardContentDraft()) {
      return
    }

    setSelectedContent(null)
    setContentDraft(null)
  }

  async function handleCreateContentColumn() {
    if (!groupId || !contentCanCreateColumn || !canManageContent) return

    const title = contentColumnDraft.trim()
    if (!title) {
      setError('请输入专栏标题')
      return
    }

    setCreatingContentColumn(true)
    setError('')
    setNotice('')

    try {
      const payload = await createAdminColumn(groupId, title)
      const nextColumnsPayload = await getAdminColumns(groupId)
      setContentColumns(nextColumnsPayload.data.items || [])
      setContentCanCreateColumn(Boolean(nextColumnsPayload.data.canCreateColumn))
      setContentColumnDraft('')
      setContentDraft((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              columnId: payload.data.id,
            }
          : currentValue,
      )
      setNotice(`已创建专栏「${payload.data.title}」`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建专栏失败')
    } finally {
      setCreatingContentColumn(false)
    }
  }

  return (
    <AdminLayout
      title={pageTitle}
      subtitle={pageSubtitle}
      tag={mode === 'members' ? '用户活跃' : '内容分析'}
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
      onBeforeLeavePage={confirmDiscardContentDraft}
      onBeforeGroupChange={() => confirmDiscardContentDraft()}
    >
      <div className="admin-resource-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {!loading && mode === 'members' && currentMembersData && !canViewMemberContact ? (
          <div className="admin-inline-tip">当前角色未开启成员联系方式查看权限，手机号和微信号已在列表、详情和导出中隐藏。</div>
        ) : null}
        {!loading && mode === 'members' && currentMembersData && !canManageMembers ? (
          <div className="admin-inline-tip">当前角色仅可查看成员与申请数据，不能执行通过、驳回或补充审核备注。</div>
        ) : null}
        {!loading && mode === 'content' && currentContentData && !canManageContent ? (
          <div className="admin-inline-tip">当前角色仅可查看内容报表，不能修改内容状态、处理举报或调整专栏。</div>
        ) : null}
        {!loading && mode === 'content' && canManageContent && contentDraftChanged ? (
          <div className="admin-inline-tip">
            {`当前内容详情有未保存修改：${contentDraftChangedSections.join(' / ')}。切换菜单、返回上一页或切换到旧数据后台前会要求确认。`}
          </div>
        ) : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        <section className="admin-resource-panel resource-group-strip">
          <div>
            <div className="resource-group-name">{group?.name || currentGroup?.name || groupId || '未分配星球'}</div>
            <div className="resource-group-meta">
              <span>星主：{group?.ownerName || currentGroup?.ownerName || '-'}</span>
              <span>groupId：{groupId || '-'}</span>
            </div>
          </div>
          <div className="resource-group-status">{mode === 'members' ? (isApplicationFocused ? '成员审核' : '成员报表') : '内容报表'}</div>
        </section>

        <section className={`admin-resource-panel resource-overview-grid ${mode === 'members' ? 'resource-overview-grid-members' : ''}`}>
          {(mode === 'members' ? memberOverview : contentOverview).map((item) => (
            <OverviewCard hint={item.hint} key={item.label} label={item.label} value={item.value} />
          ))}
        </section>

        {mode === 'members' ? (
          <>
            {pendingApplicationCount || rejectedApplicationCount ? (
              <ReviewWorkbenchSection
                currentFilter={{ status, sourceType }}
                onSelectFilter={(value) => {
                  setSourceType(value.sourceType)
                  setStatus(value.status)
                  setPage(1)
                }}
                pendingCount={pendingApplicationCount}
                rejectedCount={rejectedApplicationCount}
                applicationCount={totalApplicationCount}
                mixedCount={mixedRecordCount}
                reapplyCount={reapplyApplicationCount}
                urgentCount={urgentApplicationCount}
              />
            ) : null}
            {isApplicationFocused ? (
              <ApplicationQueueSection
                filteredCount={currentMembersData?.pagination.total || 0}
                latestReappliedAt={latestApplicationReappliedAt}
                latestSubmittedAt={latestApplicationSubmittedAt}
                oldestPendingAt={oldestPendingApplicationAt}
                statusLabel={buildApplicationStatusLabel(status)}
              />
            ) : (
              <>
                {currentMembersData ? <MemberHealthSection summary={currentMembersData.summary.activity} /> : null}
                <MemberTrendSection
                  rangeDays={rangeDays}
                  setRangeDays={(value) => {
                    setRangeDays(value)
                    setPage(1)
                  }}
                  trend={currentMembersData?.trend || []}
                />
              </>
            )}
          </>
        ) : (
          <>
            {contentReportTotalCount ? (
                <ContentReportWorkbenchSection
                  currentFilter={reportStatus}
                  latestReportedAt={latestContentReportedAt}
                  onSelectFilter={(value) => {
                    setContentReportStatusFilter(value)
                  }}
                  pendingCount={contentPendingReportCount}
                  resolvedCount={contentResolvedReportCount}
                ignoredCount={contentIgnoredReportCount}
                totalCount={contentReportTotalCount}
              />
            ) : null}
            <ContentTrendSection
              subtitle={contentTrendSubtitle}
              rangeDays={rangeDays}
              setRangeDays={setContentRangeDays}
              trend={currentContentData?.interactionTrend || []}
            />
          </>
        )}

        <section className="admin-resource-panel">
          <div className="resource-section-header">
            <div>
              <div className="resource-section-title">{mode === 'members' ? '成员数据报表' : '内容数据报表'}</div>
              <div className="resource-section-subtitle">
                {mode === 'members'
                  ? memberReportSubtitle
                  : contentReportSubtitle}
              </div>
            </div>
            <div className="resource-action-row">
              {mode === 'members' ? (
                <>
                  <button
                    className="admin-resource-ghost"
                    disabled={Boolean(exportingAction)}
                    onClick={() => handleExport('current')}
                    type="button"
                  >
                    {exportingAction === memberCurrentExportLabel ? '导出中...' : memberCurrentExportLabel}
                  </button>
                  <button
                    className="admin-resource-ghost"
                    disabled={Boolean(exportingAction)}
                    onClick={() => handleExport('all')}
                    type="button"
                  >
                    {exportingAction === memberAllExportLabel ? '导出中...' : memberAllExportLabel}
                  </button>
                </>
              ) : (
                <button
                  className="admin-resource-ghost"
                  disabled={Boolean(exportingAction)}
                  onClick={() => handleExport('all')}
                  type="button"
                >
                  {exportingAction === '导出数据' ? '导出中...' : '导出数据'}
                </button>
              )}
            </div>
          </div>

          <div className="resource-filter-grid">
            <label className="admin-resource-field">
              <span>{mode === 'members' ? '按加入时间筛选' : '开始时间'}</span>
              <input
                onChange={(event) => (mode === 'content' ? setContentStartDate(event.target.value) : setStartDate(event.target.value))}
                type="date"
                value={startDate}
              />
            </label>
            <label className="admin-resource-field">
              <span>{mode === 'members' ? '结束时间' : '结束时间'}</span>
              <input
                onChange={(event) => (mode === 'content' ? setContentEndDate(event.target.value) : setEndDate(event.target.value))}
                type="date"
                value={endDate}
              />
            </label>
            <label className="admin-resource-field">
              <span>状态</span>
              <select
                value={status}
                onChange={(event) => {
                  if (mode === 'content') {
                    setContentStatus(event.target.value)
                    return
                  }

                  setStatus(event.target.value)
                  setPage(1)
                }}
              >
                {mode === 'members' ? (
                  memberStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="ALL">全部</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="HIDDEN">已隐藏</option>
                    <option value="DRAFT">草稿</option>
                    <option value="DELETED">已删除</option>
                  </>
                )}
              </select>
            </label>

            {mode === 'members' ? (
              <label className="admin-resource-field">
                <span>数据来源</span>
                <select value={sourceType} onChange={(event) => handleMemberSourceTypeChange(event.target.value as AdminMemberSourceType)}>
                  <option value="ALL">{buildMemberSourceLabel('ALL')}</option>
                  <option value="APPLICATION">{buildMemberSourceLabel('APPLICATION')}</option>
                  <option value="MEMBER">{buildMemberSourceLabel('MEMBER')}</option>
                </select>
              </label>
            ) : null}

            {mode === 'content' ? (
              <>
                <label className="admin-resource-field">
                  <span>类型</span>
                  <select value={type} onChange={(event) => setContentTypeFilter(event.target.value)}>
                    <option value="ALL">全部</option>
                    <option value="TOPIC">主题</option>
                    <option value="ARTICLE">文章</option>
                    <option value="NOTICE">公告</option>
                    <option value="CHECKIN">打卡</option>
                    <option value="ASSIGNMENT">作业</option>
                  </select>
                </label>
                <label className="admin-resource-field">
                  <span>审核状态</span>
                  <select value={reviewStatus} onChange={(event) => setContentReviewStatusFilter(event.target.value)}>
                    <option value="ALL">全部</option>
                    <option value="APPROVED">已通过</option>
                    <option value="PENDING">审核中</option>
                    <option value="REJECTED">已驳回</option>
                    <option value="UNSET">未审核</option>
                  </select>
                </label>
                <label className="admin-resource-field">
                  <span>举报状态</span>
                  <select value={reportStatus} onChange={(event) => setContentReportStatusFilter(event.target.value)}>
                    <option value="ALL">全部</option>
                    <option value="PENDING">待处理举报</option>
                    <option value="RESOLVED">已处理举报</option>
                    <option value="IGNORED">已忽略举报</option>
                    <option value="UNSET">无举报</option>
                  </select>
                </label>
                <label className="admin-resource-field">
                  <span>专栏</span>
                  <select value={columnFilter} onChange={(event) => setContentColumnFilterValue(event.target.value)}>
                    <option value="">全部专栏</option>
                    {contentColumns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {`${column.title} · ${column.count} 篇`}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            <label className="admin-resource-field admin-resource-field-search">
              <span>搜索</span>
              <input
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearchCommit()
                  }
                }}
                placeholder={mode === 'members' ? memberSearchPlaceholder : '标题 / 作者 / 内容'}
                value={searchInput}
              />
            </label>
            <button className="admin-resource-submit" onClick={handleSearchCommit} type="button">
              搜索
            </button>
            <button className="admin-resource-ghost" disabled={!hasActiveFilters} onClick={handleResetFilters} type="button">
              重置筛选
            </button>
          </div>

          {loading ? <div className="admin-resource-empty">加载中...</div> : null}

          {!loading && mode === 'members' && currentMembersData ? (
            currentMembersData.items.length ? (
              <>
                <div className="resource-table">
                  <div className={`resource-table-row resource-table-head resource-table-members ${hasApplicationRows ? 'resource-table-members-actions' : ''}`}>
                    <span>头像</span>
                    <span>用户昵称</span>
                    <span>手机号</span>
                    <span>微信号</span>
                    <span>{hasApplicationRows ? '成员编号 / 申请' : '成员编号'}</span>
                    <span>{hasApplicationRows ? '加入 / 申请时间' : '首次加入时间'}</span>
                    <span>{hasApplicationRows ? '活跃 / 审核时间' : '最后活跃时间'}</span>
                    <span>{hasApplicationRows ? '到期 / 最近重提' : '到期时间'}</span>
                    <span>{hasApplicationRows ? '续期 / 来源' : '已续期数'}</span>
                    <span>主题数</span>
                    {hasApplicationRows ? <span>操作</span> : null}
                  </div>

                  {currentMembersData.items.map((item) => (
                    <div key={item.id}>
                      <div
                        className={`resource-table-row resource-table-members ${hasApplicationRows ? 'resource-table-members-actions' : ''} is-clickable`}
                        onClick={() => openMemberDetail(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openMemberDetail(item)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span>
                          <span className="resource-avatar">{item.nickname.slice(0, 1)}</span>
                        </span>
                        <span className="resource-table-strong">
                          {item.nickname}
                          <em>{`${item.roleLabel} · ${item.statusLabel}`}</em>
                          {item.sourceType === 'APPLICATION' ? (
                            <span className="resource-table-chip-row">
                              <span className="resource-table-chip is-muted">加入申请</span>
                              <span className={`resource-table-chip ${item.status === 'PENDING' ? 'is-warning' : 'is-danger'}`}>
                                {item.statusLabel}
                              </span>
                              {item.reapplyCount ? (
                                <span className="resource-table-chip is-muted">{`重提 ${item.reapplyCount} 次`}</span>
                              ) : null}
                            </span>
                          ) : item.isExpiringSoon ? (
                            <span className="resource-table-chip-row">
                              <span className="resource-table-chip is-warning">30 天内到期</span>
                            </span>
                          ) : null}
                          {item.sourceType === 'APPLICATION' && item.orderNo ? (
                            <span className="resource-table-meta-line">{`申请单号：${item.orderNo}`}</span>
                          ) : null}
                          {item.sourceType === 'APPLICATION' && item.reviewReason ? (
                            <span className="resource-table-meta-line">{`审核备注：${item.reviewReason}`}</span>
                          ) : null}
                        </span>
                        <span>{formatMemberContactValue(item.mobile, canViewMemberContact)}</span>
                        <span>{formatMemberContactValue(item.wechatNo, canViewMemberContact)}</span>
                        <span>{item.sourceType === 'APPLICATION' ? '加入申请' : item.memberNo ?? '-'}</span>
                        <span>{formatDateOnly(item.appliedAt || item.firstJoinedAt)}</span>
                        <span>
                          {item.sourceType === 'APPLICATION'
                            ? item.reviewedAt
                              ? formatDateTime(item.reviewedAt)
                              : item.status === 'PENDING'
                                ? '待审核'
                                : '-'
                            : formatDateTime(item.lastActiveAt)}
                        </span>
                        <span>
                          {item.sourceType === 'APPLICATION'
                            ? formatDateTime(item.lastReappliedAt || '')
                            : formatDateOnly(item.expireAt)}
                        </span>
                        <span>{item.sourceType === 'APPLICATION' ? buildJoinSourceLabel(item.joinSource) : item.renewTimes}</span>
                        <span>{item.topicCount}</span>
                        {hasApplicationRows ? (
                          <div
                            className="resource-table-action-cell"
                            onClick={item.sourceType === 'APPLICATION' ? (event) => event.stopPropagation() : undefined}
                          >
                            {item.sourceType === 'APPLICATION' ? (
                              canManageMembers ? (
                                <div className="resource-table-inline-actions">
                                  <button
                                    className="admin-resource-submit"
                                    disabled={savingMember}
                                    onClick={() => void submitMemberReview(item, 'APPROVE', item.reviewReason || '')}
                                    type="button"
                                  >
                                    {savingMember ? '处理中...' : item.status === 'REJECTED' ? '改为通过' : '通过'}
                                  </button>
                                  <button
                                    className="admin-resource-ghost"
                                    disabled={savingMember}
                                    onClick={() => handleInlineRejectToggle(item)}
                                    type="button"
                                  >
                                    {inlineRejectTargetId === item.id ? '收起驳回' : item.status === 'REJECTED' ? '编辑驳回' : '驳回'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="admin-resource-ghost"
                                  onClick={() => openMemberDetail(item)}
                                  type="button"
                                >
                                  {selectedMember?.id === item.id ? '已展开' : '查看详情'}
                                </button>
                              )
                            ) : (
                              <button
                                className="admin-resource-ghost"
                                onClick={() => openMemberDetail(item)}
                                type="button"
                              >
                                {selectedMember?.id === item.id ? '已展开' : '查看详情'}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {item.sourceType === 'APPLICATION' && canManageMembers && inlineRejectTargetId === item.id ? (
                        <div className="resource-table-inline-panel">
                          <div className="resource-table-inline-panel-header">{`驳回申请：${item.nickname}`}</div>
                          <textarea
                            className="resource-table-inline-textarea"
                            maxLength={120}
                            onChange={(event) => setInlineRejectReason(event.target.value)}
                            placeholder="请输入驳回原因，用户侧会同步看到这段说明"
                            rows={3}
                            value={inlineRejectReason}
                          />
                          <div className="resource-table-inline-panel-actions">
                            <button
                              className="admin-resource-submit"
                              disabled={savingMember}
                              onClick={() => void handleInlineRejectSubmit(item)}
                              type="button"
                            >
                              {savingMember ? '处理中...' : item.status === 'REJECTED' ? '更新驳回' : '确认驳回'}
                            </button>
                            <button
                              className="admin-resource-ghost"
                              disabled={savingMember}
                              onClick={() => {
                                setInlineRejectTargetId('')
                                setInlineRejectReason('')
                              }}
                              type="button"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="admin-resource-footer">
                  <span>{`第 ${pagination?.page ?? 1} / ${pagination?.totalPages ?? 1} 页，共 ${pagination?.total ?? 0} 条`}</span>
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
              <div className="admin-resource-empty">{memberEmptyStateMessage}</div>
            )
          ) : null}

          {!loading && mode === 'content' && currentContentData ? (
            currentContentData.items.length ? (
              <>
                <div className="resource-table">
                  <div className="resource-table-row resource-table-head resource-table-content resource-table-content-actions">
                    <span>主题</span>
                    <span>发布时间</span>
                    <span>用户昵称</span>
                    <span>点赞数</span>
                    <span>评论数</span>
                    <span>阅读数</span>
                    <span>操作</span>
                  </div>

                  {currentContentData.items.map((item) => (
                    <div
                      className="resource-table-row resource-table-content resource-table-content-actions"
                      key={item.id}
                      onClick={() => openContentDetail(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openContentDetail(item)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="resource-table-strong">
                        {item.title}
                        <em>{`${item.typeLabel} · ${item.statusLabel} · ${item.reviewStatusLabel}`}</em>
                        <span className="resource-table-chip-row">
                          <span className={`resource-table-chip ${getContentColumnLabel(item) ? '' : 'is-muted'}`}>
                            {getContentColumnLabel(item) ? `专栏 · ${getContentColumnLabel(item)}` : '未归栏'}
                          </span>
                          {item.reportTotal ? (
                            <span className={`resource-table-chip ${buildContentReportChipClass(item.reportStatus)}`}>
                              {`${item.reportStatusLabel} · ${item.reportTotal} 条`}
                            </span>
                          ) : null}
                          {item.reportPendingCount ? (
                            <span className="resource-table-chip is-warning">{`待处理 ${item.reportPendingCount}`}</span>
                          ) : null}
                        </span>
                        {item.latestReportReason ? (
                          <span className="resource-table-meta-line">{`最近举报：${item.latestReportReason}`}</span>
                        ) : null}
                      </span>
                      <span>{formatDateTime(item.publishedAt || item.createdAt)}</span>
                      <span>{item.authorName}</span>
                      <span>{item.likeCount}</span>
                      <span>{item.commentCount}</span>
                      <span>{item.readingCount}</span>
                      <div className="resource-table-action-cell" onClick={(event) => event.stopPropagation()}>
                        {item.reportPendingCount && canManageContent ? (
                          <div className="resource-table-inline-actions">
                            <button
                              className="admin-resource-submit"
                              disabled={savingContent}
                              onClick={() => void handleInlineContentReportAction(item, 'hideResolve')}
                              type="button"
                            >
                              {savingContent ? '处理中...' : '隐藏并处理'}
                            </button>
                            <button
                              className="admin-resource-ghost"
                              disabled={savingContent}
                              onClick={() => void handleInlineContentReportAction(item, 'ignore')}
                              type="button"
                            >
                              {savingContent ? '处理中...' : '忽略'}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="admin-resource-ghost"
                            onClick={() => openContentDetail(item)}
                            type="button"
                          >
                            {selectedContent?.id === item.id ? '已展开' : '查看详情'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="admin-resource-footer">
                  <span>{`第 ${pagination?.page ?? 1} / ${pagination?.totalPages ?? 1} 页，共 ${pagination?.total ?? 0} 条`}</span>
                  <div className="admin-resource-pager">
                    <button
                      disabled={(pagination?.page ?? 1) <= 1}
                      onClick={() => setContentPage((pagination?.page ?? 1) - 1)}
                      type="button"
                    >
                      上一页
                    </button>
                    <button
                      disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)}
                      onClick={() => setContentPage((pagination?.page ?? 1) + 1)}
                      type="button"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="admin-resource-empty">当前筛选条件下没有内容数据。</div>
            )
          ) : null}
        </section>

        {mode === 'members' ? (
          <MemberDetailDrawer
            canManage={canManageMembers}
            canViewMemberContact={canViewMemberContact}
            item={selectedMember}
            onApprove={(reason) => void handleReviewMember('APPROVE', reason)}
            onClose={closeMemberDetail}
            onReject={(reason) => void handleReviewMember('REJECT', reason)}
            saving={savingMember}
          />
        ) : selectedContent && contentDraft ? (
          <ContentDetailDrawer
            canManage={canManageContent}
            canCreateColumn={contentCanCreateColumn}
            changedSections={contentDraftChangedSections}
            columns={contentColumns}
            columnsLoading={contentColumnsLoading}
            creatingColumn={creatingContentColumn}
            createColumnDraft={contentColumnDraft}
            draft={contentDraft}
            hasUnsavedChanges={contentDraftChanged}
            item={selectedContent}
            onChange={(patch) =>
              setContentDraft((currentValue) => ({
                ...(currentValue || buildContentDraft(selectedContent)),
                ...patch,
              }))
            }
            onCreateColumn={() => void handleCreateContentColumn()}
            onCreateColumnDraftChange={setContentColumnDraft}
            onClose={closeContentDetail}
            onQuickReportAction={(action) => void handleQuickReportAction(action)}
            onReset={handleResetContentDraft}
            onSave={handleSaveContent}
            saving={savingContent}
          />
        ) : null}
      </div>
    </AdminLayout>
  )
}
