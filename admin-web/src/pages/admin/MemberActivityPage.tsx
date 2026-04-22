import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  downloadAdminMembersExport,
  getAdminMembers,
  updateAdminMemberStatus,
  type AdminMemberItem,
  type AdminMembersPayload,
} from '../../services/adminResourceService'

const RANGE_OPTIONS = [7, 15, 30] as const
const PAGE_SIZE = 20

function formatDateOnly(value: string) {
  if (!value) return '-'
  return value.slice(0, 10).replace(/-/g, '/')
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ').replace(/-/g, '/')
}

function formatMemberContactValue(value: string, canViewMemberContact: boolean) {
  if (!canViewMemberContact) return '无权限'
  return value || '-'
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function OverviewCard({
  label,
  value,
  hint,
  description,
}: {
  label: string
  value: number
  hint: string
  description?: string
}) {
  return (
    <article className="member-activity-overview-card">
      <div className="member-activity-overview-label-row">
        <div className="member-activity-overview-label">{label}</div>
        {description ? <span className="member-activity-help" title={description}>?</span> : null}
      </div>
      <div className="member-activity-overview-value">{value}</div>
      <div className="member-activity-overview-hint">{hint}</div>
    </article>
  )
}

function MemberTableRow({
  item,
  canViewMemberContact,
  canManageMembers,
  removing,
  onRemove,
}: {
  item: AdminMemberItem
  canViewMemberContact: boolean
  canManageMembers: boolean
  removing: boolean
  onRemove: (item: AdminMemberItem) => void
}) {
  return (
    <div className={`resource-table-row member-activity-table-row${canManageMembers ? ' member-activity-table-row-actions' : ''}`}>
      <span>
        {item.avatarUrl ? (
          <img alt={item.nickname} className="member-activity-avatar-image" src={item.avatarUrl} />
        ) : (
          <span className="resource-avatar">{item.nickname.slice(0, 1)}</span>
        )}
      </span>
      <span className="resource-table-strong">
        <span>{item.nickname}</span>
        <em>{`${item.roleLabel} · ${item.statusLabel}`}</em>
      </span>
      <span>{formatMemberContactValue(item.mobile, canViewMemberContact)}</span>
      <span>{formatMemberContactValue(item.wechatNo, canViewMemberContact)}</span>
      <span>{item.memberNo ?? '-'}</span>
      <span>{formatDateOnly(item.firstJoinedAt)}</span>
      <span>{formatDateTime(item.lastActiveAt)}</span>
      <span>{formatDateOnly(item.expireAt)}</span>
      <span>{item.renewTimes}</span>
      <span>{item.topicCount}</span>
      {canManageMembers ? (
        <div className="resource-table-action-cell">
          {item.sourceType === 'MEMBER' ? (
            item.canRemove ? (
              <button className="admin-resource-ghost is-danger" disabled={removing} onClick={() => onRemove(item)} type="button">
                {removing ? '处理中...' : '踢出用户'}
              </button>
            ) : (
              <span className="resource-table-action-placeholder" title={item.removeDisabledReason || ''}>
                不可踢出
              </span>
            )
          ) : (
            <span className="resource-table-action-placeholder">-</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function MemberActivityPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(7)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exportingAction, setExportingAction] = useState('')
  const [removingMemberId, setRemovingMemberId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [data, setData] = useState<AdminMembersPayload['data'] | null>(null)

  useEffect(() => {
    setRangeDays(7)
    setStartDate('')
    setEndDate('')
    setPage(1)
    setError('')
    setNotice('')
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

    getAdminMembers({
      groupId,
      status: 'ALL',
      sourceType: 'MEMBER',
      startDate,
      endDate,
      rangeDays,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((payload) => {
        if (!active) return
        setData(payload.data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载成员活跃失败')
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
  }, [endDate, groupId, page, rangeDays, reloadKey, startDate])

  const overview = data?.summary.overview
  const pagination = data?.pagination
  const canViewMemberContact = Boolean(data?.viewer.capabilities.canViewMemberContact)
  const canManageMembers = Boolean(data?.viewer.capabilities.canManageMembers)

  async function handleExport(scope: 'current' | 'all', actionLabel: string) {
    if (!groupId) return

    setExportingAction(actionLabel)
    setError('')
    setNotice('')

    try {
      const payload = await downloadAdminMembersExport(
        {
          groupId,
          status: 'ALL',
          sourceType: 'MEMBER',
          startDate,
          endDate,
          rangeDays,
          page,
          pageSize: PAGE_SIZE,
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

  async function handleRemoveMember(item: AdminMemberItem) {
    if (!groupId || !canManageMembers || item.sourceType !== 'MEMBER' || !item.canRemove) {
      return
    }

    const confirmed = window.confirm(`确认将「${item.nickname}」踢出星球吗？踢出后该成员将失去访问权限。`)
    if (!confirmed) {
      return
    }

    setRemovingMemberId(item.id)
    setError('')
    setNotice('')

    try {
      await updateAdminMemberStatus({
        groupId,
        memberId: item.id,
        status: 'QUIT',
      })
      setNotice(`已踢出「${item.nickname}」`)
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '踢出成员失败')
    } finally {
      setRemovingMemberId('')
    }
  }

  return (
    <AdminLayout
      title="成员活跃"
      subtitle="每日 8 点前更新昨日数据"
      tag="用户活跃"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page member-activity-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {!loading && data && !canViewMemberContact ? (
          <div className="admin-inline-tip">当前角色未开启成员联系方式查看权限，手机号和微信号已隐藏。</div>
        ) : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <section className="admin-resource-panel resource-group-strip">
              <div>
                <div className="resource-group-name">{data?.group.name || currentGroup?.name || groupId || '未分配星球'}</div>
                <div className="resource-group-meta">
                  <span>星主：{data?.group.ownerName || currentGroup?.ownerName || '-'}</span>
                  <span>groupId：{groupId || '-'}</span>
                </div>
              </div>
              <div className="resource-group-status">成员活跃</div>
            </section>

            {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}

            {!loading && overview ? (
              <section className="admin-resource-panel">
                <div className="member-activity-section-head">
                  <div>
                    <div className="resource-section-title">数据概览</div>
                    <div className="resource-section-subtitle">每日 8 点前更新昨日数据</div>
                  </div>
                </div>

                <div className="member-activity-overview-grid">
                  <OverviewCard
                    description="总成员数 = 付费加入成员 + 免费加入成员 + 体验卡成员，不包括已退出星球的人数。"
                    hint={`昨日加入成员 ${overview.totalJoinedYesterday}`}
                    label="总成员数"
                    value={overview.totalCurrent}
                  />
                  <OverviewCard
                    description="指付费加入星球的人数，不包括已退出星球的人数。"
                    hint={`昨日加入成员 ${overview.paidJoinedYesterday}`}
                    label="付费加入成员"
                    value={overview.paidCurrent}
                  />
                  <OverviewCard
                    description="指通过非付费方式加入星球的人数，不包括体验用户和已退出星球的人数。"
                    hint={`昨日加入成员 ${overview.freeJoinedYesterday}`}
                    label="免费加入成员"
                    value={overview.freeCurrent}
                  />
                  <OverviewCard
                    description="指退出星球和被星主移除的总人数。"
                    hint={`昨日退出成员 ${overview.quitYesterday}`}
                    label="退出成员"
                    value={overview.quitTotal}
                  />
                </div>
              </section>
            ) : null}

            {!loading && data ? (
              <section className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">成员数据报表</div>
                    <div className="resource-section-subtitle">数据报表实时统计，导出数据后可查看更全面的数据</div>
                  </div>
                  <div className="member-activity-toolbar member-activity-toolbar-report">
                    <label className="member-activity-date-field">
                      <span>按加入时间筛选：</span>
                      <input
                        onChange={(event) => {
                          setStartDate(event.target.value)
                          setPage(1)
                        }}
                        type="date"
                        value={startDate}
                      />
                    </label>
                    <label className="member-activity-date-field member-activity-date-field-compact">
                      <span>至</span>
                      <input
                        onChange={(event) => {
                          setEndDate(event.target.value)
                          setPage(1)
                        }}
                        type="date"
                        value={endDate}
                      />
                    </label>
                    <div className="member-activity-export-group">
                      <button
                        className="admin-resource-ghost"
                        disabled={Boolean(exportingAction)}
                        onClick={() => void handleExport('current', '导出当前数据')}
                        type="button"
                      >
                        {exportingAction === '导出当前数据' ? '导出中...' : '导出当前数据'}
                      </button>
                      <button
                        className="admin-resource-ghost"
                        disabled={Boolean(exportingAction)}
                        onClick={() => void handleExport('all', '导出全部成员')}
                        type="button"
                      >
                        {exportingAction === '导出全部成员' ? '导出中...' : '导出全部成员'}
                      </button>
                    </div>
                  </div>
                </div>

                {data.items.length ? (
                  <>
                    <div className="resource-table">
                      <div
                        className={`resource-table-row resource-table-head member-activity-table-row${canManageMembers ? ' member-activity-table-row-actions' : ''}`}
                      >
                        <span>头像</span>
                        <span>用户昵称</span>
                        <span>手机号</span>
                        <span>微信号</span>
                        <span>成员编号</span>
                        <span>首次加入时间</span>
                        <span>最后活跃时间</span>
                        <span>到期时间</span>
                        <span>已续期数</span>
                        <span>主题数</span>
                        {canManageMembers ? <span>操作</span> : null}
                      </div>

                      {data.items.map((item) => (
                        <MemberTableRow
                          canManageMembers={canManageMembers}
                          canViewMemberContact={canViewMemberContact}
                          item={item}
                          key={item.id}
                          onRemove={handleRemoveMember}
                          removing={removingMemberId === item.id}
                        />
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
                  <div className="admin-resource-empty">当前筛选条件下暂无成员数据</div>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
