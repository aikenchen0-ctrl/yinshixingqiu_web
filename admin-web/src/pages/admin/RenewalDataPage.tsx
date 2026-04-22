import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getRenewalDashboardPageData,
  type AnalyticsPagination,
  type RenewalDashboardData,
  type RenewalDashboardReportItem,
} from '../../services/promotionService'

const RANGE_OPTIONS = [7, 15, 30]

type RenewalQueryState = {
  startDate: string
  endDate: string
  rangeDays: number
  page: number
}

function parseRangeDays(value: string | null) {
  const parsedValue = Number(value)
  return RANGE_OPTIONS.includes(parsedValue) ? parsedValue : 7
}

function parsePage(value: string | null) {
  const parsedValue = Number(value)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 1
}

function readRenewalQuery(search: string): RenewalQueryState {
  const searchParams = new URLSearchParams(search)
  return {
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    rangeDays: parseRangeDays(searchParams.get('rangeDays')),
    page: parsePage(searchParams.get('page')),
  }
}

function formatMoney(value: number | string) {
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(value || '0')
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function splitMoney(value: number | string) {
  const [integerPart, decimalPart = '00'] = formatMoney(value).split('.')
  return {
    integerPart,
    decimalPart: `.${decimalPart}`,
  }
}

function formatCount(value: number | string) {
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(value || '0')
  if (!Number.isFinite(numericValue)) return '0'
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2)
}

function formatDiscountLabel(discountPercentage: number) {
  if (!Number.isFinite(discountPercentage) || discountPercentage >= 100) {
    return '无折扣'
  }

  const foldValue = discountPercentage / 10
  return `${Number.isInteger(foldValue) ? foldValue.toFixed(0) : foldValue.toFixed(1)}折`
}

function buildCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}

function triggerCsvDownload(fileName: string, headers: string[], rows: string[][]) {
  const csvLines = [headers, ...rows].map((row) => row.map((cell) => buildCsvCell(cell)).join(','))
  const blob = new Blob([`\uFEFF${csvLines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function buildExportFileName(prefix: string, groupId: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
  const safeGroupId = groupId.replace(/[^\w-]+/g, '-')
  return `${prefix}-${safeGroupId}-${stamp}.csv`
}

function buildReportExportRows(items: RenewalDashboardReportItem[]) {
  return items.map((item) => [
    item.paidAt.slice(0, 16).replace('T', ' '),
    '续期订单',
    item.nickname,
    item.amount,
    item.income,
    item.statusLabel,
  ])
}

function buildAdminSearch(groupId: string, extraQuery?: Record<string, string>) {
  const searchParams = new URLSearchParams()
  if (groupId) {
    searchParams.set('groupId', groupId)
  }

  Object.entries(extraQuery || {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value)
    }
  })

  const nextSearch = searchParams.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="renewal-data-section-header">
      <div>
        <div className="renewal-data-section-title">{title}</div>
        {subtitle ? <div className="renewal-data-section-subtitle">{subtitle}</div> : null}
      </div>
      {right ? <div className="renewal-data-section-actions">{right}</div> : null}
    </div>
  )
}

function OverviewMetricCard({
  label,
  value,
  secondary,
  isMoney,
}: {
  label: string
  value: number
  secondary: string
  isMoney?: boolean
}) {
  const moneyParts = splitMoney(value)

  return (
    <article className="renewal-data-overview-card">
      <div className="renewal-data-overview-label">{label}</div>
      <div className="renewal-data-overview-value">
        {isMoney ? (
          <>
            <span>{moneyParts.integerPart}</span>
            <em>{moneyParts.decimalPart}</em>
          </>
        ) : (
          <span>{formatCount(value)}</span>
        )}
      </div>
      <div className="renewal-data-overview-hint">{secondary}</div>
    </article>
  )
}

function RenewalStatusChart({
  renewableCount,
  expiredOver7DaysCount,
  expiredWithin7DaysCount,
  advanceRenewableCount,
  discountLabel,
  renewalPrice,
  renewalOriginalPrice,
  onOpenReminderSettings,
  onOpenDiscountSettings,
}: {
  renewableCount: number
  expiredOver7DaysCount: number
  expiredWithin7DaysCount: number
  advanceRenewableCount: number
  discountLabel: string
  renewalPrice: string
  renewalOriginalPrice: string
  onOpenReminderSettings: () => void
  onOpenDiscountSettings: () => void
}) {
  const segments = [
    { key: 'expired-long', label: '过期 7 天以上成员', value: expiredOver7DaysCount, color: '#f7c467' },
    { key: 'expired-short', label: '过期 7 天内成员', value: expiredWithin7DaysCount, color: '#64cfbc' },
    { key: 'advance', label: '可提前续期成员', value: advanceRenewableCount, color: '#16b998' },
  ]
  const totalSegmentValue = segments.reduce((sum, item) => sum + item.value, 0)
  const gradientStops: string[] = []
  let currentPercent = 0

  segments.forEach((segment) => {
    const ratioBase = renewableCount > 0 ? renewableCount : totalSegmentValue
    const segmentPercent = ratioBase > 0 ? (segment.value / ratioBase) * 100 : 0
    const nextPercent = currentPercent + segmentPercent

    if (segmentPercent > 0) {
      gradientStops.push(`${segment.color} ${currentPercent.toFixed(2)}% ${nextPercent.toFixed(2)}%`)
      currentPercent = nextPercent
    }
  })

  const ringBackground = currentPercent
    ? `conic-gradient(${gradientStops.join(', ')}, #e9edf2 ${currentPercent.toFixed(2)}% 100%)`
    : 'linear-gradient(180deg, #f7f9fb 0%, #edf1f4 100%)'

  return (
    <section className="admin-resource-panel renewal-data-graph-panel">
      <div className="renewal-data-box-title">续期情况</div>
      <div className="renewal-data-status-layout">
        <div className="renewal-data-status-main">
          <div className="renewal-data-donut-shell">
            <div className="renewal-data-donut-ring" style={{ background: ringBackground }}>
              <div className="renewal-data-donut-center">
                <strong>{formatCount(renewableCount)}</strong>
                <span>可续期成员</span>
              </div>
            </div>
          </div>

          <div className="renewal-data-status-legend">
            {segments.map((segment) => (
              <div className="renewal-data-status-item" key={segment.key}>
                <div className="renewal-data-status-label">
                  <i style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                </div>
                <div className="renewal-data-status-value">{formatCount(segment.value)}</div>
                {segment.key === 'advance' ? (
                  <button className="renewal-data-inline-link" onClick={onOpenReminderSettings} type="button">
                    配置自动提醒，让用户提前续期，前往设置 &gt;
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <aside className="renewal-data-discount-card">
          <div className="renewal-data-discount-label">当前续期折扣</div>
          <button className="renewal-data-discount-value" onClick={onOpenDiscountSettings} type="button">
            {discountLabel}
          </button>
          <div className="renewal-data-discount-hint">
            续期价格 {renewalPrice} 元{renewalOriginalPrice !== renewalPrice ? ` · 原价 ${renewalOriginalPrice} 元` : ''}
          </div>
        </aside>
      </div>
    </section>
  )
}

function RenewalReportTable({
  rows,
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  rows: RenewalDashboardReportItem[]
  pagination: AnalyticsPagination
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  return (
    <>
      <div className="resource-table renewal-data-report-table">
        <div className="resource-table-row resource-table-head renewal-data-report-head">
          <span>时间</span>
          <span>类型</span>
          <span>用户昵称</span>
          <span>支付金额(元)</span>
          <span>星主收入(元)</span>
          <span>订单状态</span>
        </div>

        {rows.length ? (
          rows.map((item) => (
            <div className="resource-table-row renewal-data-report-row" key={item.id}>
              <span>{item.paidAt.slice(0, 16).replace('T', ' ')}</span>
              <span>续期订单</span>
              <span>{item.nickname}</span>
              <span>{item.amount}</span>
              <span>{item.income}</span>
              <span>{item.statusLabel}</span>
            </div>
          ))
        ) : (
          <div className="admin-resource-empty">暂无数据</div>
        )}
      </div>

      <div className="admin-resource-footer">
        <span>
          第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
        </span>
        <div className="admin-resource-pager">
          <button disabled={pagination.page <= 1} onClick={onPreviousPage} type="button">
            上一页
          </button>
          <button disabled={pagination.page >= pagination.totalPages} onClick={onNextPage} type="button">
            下一页
          </button>
        </div>
      </div>
    </>
  )
}

export function RenewalDataPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const requestedQuery = useMemo(() => readRenewalQuery(location.search), [location.search])
  const [rangeDays, setRangeDays] = useState(requestedQuery.rangeDays)
  const [startDate, setStartDate] = useState(requestedQuery.startDate)
  const [endDate, setEndDate] = useState(requestedQuery.endDate)
  const [page, setPage] = useState(requestedQuery.page)
  const [pageData, setPageData] = useState<RenewalDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setRangeDays(requestedQuery.rangeDays)
    setStartDate(requestedQuery.startDate)
    setEndDate(requestedQuery.endDate)
    setPage(requestedQuery.page)
  }, [requestedQuery.endDate, requestedQuery.page, requestedQuery.rangeDays, requestedQuery.startDate])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    if (!groupId) {
      setPageData(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getRenewalDashboardPageData({ groupId, rangeDays, startDate, endDate, page })
      .then((data) => {
        if (!active) return
        setPageData(data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载续期数据页面失败')
        setPageData(null)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [endDate, groupId, page, rangeDays, startDate])

  useEffect(() => {
    const searchParams = new URLSearchParams()
    if (groupId) {
      searchParams.set('groupId', groupId)
    }
    if (startDate) {
      searchParams.set('startDate', startDate)
    }
    if (endDate) {
      searchParams.set('endDate', endDate)
    }
    if (rangeDays !== 7) {
      searchParams.set('rangeDays', String(rangeDays))
    }
    if (page > 1) {
      searchParams.set('page', String(page))
    }

    const nextSearch = searchParams.toString()
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
  }, [endDate, groupId, location.pathname, location.search, navigate, page, rangeDays, startDate])

  const groupName = pageData?.group.name || currentGroup?.name || groupId || '未分配星球'
  const ownerName = pageData?.group.ownerName || currentGroup?.ownerName || '-'
  const summary = pageData?.summary
  const breakdown = pageData?.breakdown
  const reportHasFilters = Boolean(startDate || endDate)

  function navigateWithinAdmin(path: string) {
    navigate({
      pathname: path,
      search: buildAdminSearch(groupId),
    })
  }

  function exportReport() {
    if (!pageData?.items.length) return
    triggerCsvDownload(
      buildExportFileName('renewal-report', groupId || 'group'),
      ['时间', '类型', '用户昵称', '支付金额(元)', '星主收入(元)', '订单状态'],
      buildReportExportRows(pageData.items),
    )
    setNotice('收入报表已导出')
  }

  return (
    <AdminLayout
      title="续期数据"
      subtitle="每日 8 点前更新昨日数据"
      tag="成员续期"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page renewal-data-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div> : null}

        <section className="admin-resource-panel renewal-data-group-panel">
          <div className="renewal-data-group-name">{groupName}</div>
          <div className="renewal-data-group-meta">
            <span>星主：{ownerName}</span>
            <span>groupId：{groupId || '-'}</span>
          </div>
        </section>

        {!loading && summary ? (
          <>
            <section className="admin-resource-panel renewal-data-overview-panel">
              <SectionHeader subtitle="每日 8 点前更新昨日数据" title="数据概览" />
              <div className="renewal-data-overview-grid">
                <OverviewMetricCard label="昨日续期收入(元)" secondary="" value={summary.yesterdayRenewalIncome} isMoney />
                <OverviewMetricCard
                  label="本月续期收入(元)"
                  secondary={`上月续期收入 ${formatMoney(summary.lastMonthRenewalIncome)}`}
                  value={summary.monthRenewalIncome}
                  isMoney
                />
                <OverviewMetricCard label="昨日续期成员" secondary="" value={summary.yesterdayRenewedCount} />
                <OverviewMetricCard
                  label="本月续期成员"
                  secondary={`上月续期成员 ${formatCount(summary.lastMonthRenewedCount)}`}
                  value={summary.monthRenewedCount}
                />
                <OverviewMetricCard
                  label="续期成员总数"
                  secondary={`昨日首次续期 ${formatCount(summary.firstRenewedYesterdayCount)}`}
                  value={summary.totalRenewedMembers}
                />
              </div>
            </section>

            <RenewalStatusChart
              advanceRenewableCount={breakdown?.advanceRenewableCount || 0}
              discountLabel={formatDiscountLabel(summary.renewalDiscountedPercentage)}
              expiredOver7DaysCount={breakdown?.expiredOver7DaysCount || 0}
              expiredWithin7DaysCount={breakdown?.expiredWithin7DaysCount || 0}
              onOpenDiscountSettings={() => navigateWithinAdmin('/renewal/discounts')}
              onOpenReminderSettings={() => navigateWithinAdmin('/renewal/group-notices')}
              renewalOriginalPrice={summary.renewalOriginalPrice}
              renewalPrice={summary.renewalPrice}
              renewableCount={summary.renewableCount}
            />

            <section className="admin-resource-panel renewal-data-report-panel">
              <SectionHeader
                right={
                  <div className="renewal-data-toolbar">
                    <button className="admin-resource-ghost" onClick={exportReport} type="button">
                      导出数据
                    </button>
                  </div>
                }
                subtitle="数据报表实时统计，导出数据后可查看更全面的数据"
                title="收入数据报表"
              />

              <div className="resource-filter-grid renewal-data-report-filters">
                <label className="admin-resource-field">
                  <span>开始时间</span>
                  <input
                    onChange={(event) => {
                      setStartDate(event.target.value)
                      setPage(1)
                    }}
                    type="date"
                    value={startDate}
                  />
                </label>
                <label className="admin-resource-field">
                  <span>结束时间</span>
                  <input
                    onChange={(event) => {
                      setEndDate(event.target.value)
                      setPage(1)
                    }}
                    type="date"
                    value={endDate}
                  />
                </label>
                <button
                  className="admin-resource-ghost renewal-data-filter-reset"
                  disabled={!reportHasFilters}
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                    setPage(1)
                  }}
                  type="button"
                >
                  清空日期
                </button>
              </div>

              <RenewalReportTable
                onNextPage={() => setPage((currentValue) => Math.min(pageData.pagination.totalPages, currentValue + 1))}
                onPreviousPage={() => setPage((currentValue) => Math.max(1, currentValue - 1))}
                pagination={pageData.pagination}
                rows={pageData.items}
              />
            </section>
          </>
        ) : null}

        {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}
      </div>
    </AdminLayout>
  )
}
