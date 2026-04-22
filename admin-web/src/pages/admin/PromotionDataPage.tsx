import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getIncomePageData,
  getPromotionPageData,
  getRenewalPageData,
  type PromotionActionWorkbenchItem,
  type PromotionPagePayload,
  type PromotionReportDetailItem,
  type PromotionTrendMetricOption,
  type PromotionTrendSeriesItem,
} from '../../services/promotionService'

const RANGE_OPTIONS = [7, 15, 30]

type AnalyticsMode = PromotionPagePayload['mode']

function parseRangeDays(value: string | null) {
  const parsedValue = Number(value)
  return RANGE_OPTIONS.includes(parsedValue) ? parsedValue : 7
}

function parsePage(value: string | null) {
  const parsedValue = Number(value)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 1
}

function readAnalyticsQuery(locationSearch: string) {
  const searchParams = new URLSearchParams(locationSearch)

  return {
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    rangeDays: parseRangeDays(searchParams.get('rangeDays')),
    page: parsePage(searchParams.get('page')),
  }
}

function buildCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}

function triggerCsvDownload(fileName: string, headers: string[], rows: Array<Record<string, string>>) {
  const csvLines = [
    headers,
    ...rows.map((row) => headers.map((_, index) => row[`col${index + 1}`] || '')),
  ].map((row) => row.map((cell) => buildCsvCell(String(cell || ''))).join(','))

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

function buildExportFileName(mode: AnalyticsMode, groupId: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
  const safeGroupId = groupId.replace(/[^\w-]+/g, '-')
  return `${mode}-${safeGroupId}-${stamp}.csv`
}

function formatMetricValue(value: number, format: PromotionTrendMetricOption['format']) {
  if (format === 'money') {
    return value.toFixed(2)
  }

  if (format === 'percent') {
    return `${value.toFixed(2)}%`
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function buildModeLabel(mode: AnalyticsMode) {
  if (mode === 'income') return '收入分析'
  if (mode === 'renewal') return '续期分析'
  return '推广分析'
}

function buildModeStatus(mode: AnalyticsMode) {
  if (mode === 'income') return '收入报表'
  if (mode === 'renewal') return '续期报表'
  return '推广报表'
}

function buildOrderStatusClass(status: string) {
  if (status === 'PAID') return ' is-success'
  if (status === 'REFUNDED' || status === 'CLOSED' || status === 'CANCELLED') return ' is-muted'
  return ''
}

function OverviewCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="resource-overview-card">
      <div className="resource-overview-label">{label}</div>
      <div className="resource-overview-value">{value}</div>
      <div className="resource-overview-hint">{hint}</div>
    </article>
  )
}

function TrendWorkbench({
  title,
  hint,
  metricOptions,
  activeMetricKey,
  onMetricChange,
  trendSeries,
  selectedDate,
  onSelectDate,
}: {
  title: string
  hint: string
  metricOptions: PromotionTrendMetricOption[]
  activeMetricKey: string
  onMetricChange: (key: string) => void
  trendSeries: PromotionTrendSeriesItem[]
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  const activeMetric = useMemo(
    () => metricOptions.find((item) => item.key === activeMetricKey) || metricOptions[0] || null,
    [activeMetricKey, metricOptions],
  )

  const selectedItem = useMemo(() => {
    if (!trendSeries.length) return null
    return trendSeries.find((item) => item.date === selectedDate) || trendSeries[trendSeries.length - 1]
  }, [selectedDate, trendSeries])

  const maxValue = useMemo(() => {
    if (!activeMetric) return 1
    return Math.max(
      1,
      ...trendSeries.map((item) => {
        const nextValue = item.values[activeMetric.key] || 0
        return Number.isFinite(nextValue) ? nextValue : 0
      }),
    )
  }, [activeMetric, trendSeries])

  const peakItem = useMemo(() => {
    if (!activeMetric || !trendSeries.length) return null
    return trendSeries.reduce<PromotionTrendSeriesItem | null>((best, item) => {
      if (!best) return item
      return (item.values[activeMetric.key] || 0) > (best.values[activeMetric.key] || 0) ? item : best
    }, null)
  }, [activeMetric, trendSeries])

  const averageValue = useMemo(() => {
    if (!activeMetric || !trendSeries.length) return 0
    const totalValue = trendSeries.reduce((sum, item) => sum + (item.values[activeMetric.key] || 0), 0)
    return totalValue / trendSeries.length
  }, [activeMetric, trendSeries])

  if (!activeMetric || !selectedItem) {
    return null
  }

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">{title}</div>
          <div className="resource-section-subtitle">{hint}</div>
        </div>
      </div>

      <div className="analytics-metric-tabs">
        {metricOptions.map((item) => (
          <button
            className={item.key === activeMetric.key ? 'is-active' : ''}
            key={item.key}
            onClick={() => onMetricChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="analytics-focus-grid">
        <article className="analytics-focus-card">
          <div className="analytics-trend-chart">
            {trendSeries.map((item) => {
              const value = item.values[activeMetric.key] || 0
              const barHeight = Math.max((value / maxValue) * 146, value ? 18 : 8)
              return (
                <button
                  className={`analytics-trend-column${selectedItem.date === item.date ? ' is-active' : ''}`}
                  key={item.date}
                  onClick={() => onSelectDate(item.date)}
                  type="button"
                >
                  <span className="analytics-trend-value">{formatMetricValue(value, activeMetric.format)}</span>
                  <div className="analytics-trend-bar-shell">
                    <div className="analytics-trend-bar" style={{ height: `${barHeight}px` }} />
                  </div>
                  <span className="analytics-trend-label">{item.label}</span>
                </button>
              )
            })}
          </div>
        </article>

        <article className="analytics-focus-card analytics-breakdown-card">
          <div className="analytics-breakdown-kicker">{selectedItem.label}</div>
          <div className="analytics-breakdown-value">
            {formatMetricValue(selectedItem.values[activeMetric.key] || 0, activeMetric.format)}
          </div>
          <div className="analytics-breakdown-hint">{activeMetric.hint}</div>

          <div className="analytics-breakdown-summary">
            <div className="analytics-breakdown-summary-card">
              <span>区间峰值</span>
              <strong>
                {peakItem ? formatMetricValue(peakItem.values[activeMetric.key] || 0, activeMetric.format) : '-'}
              </strong>
              <em>{peakItem?.label || '暂无样本'}</em>
            </div>
            <div className="analytics-breakdown-summary-card">
              <span>区间均值</span>
              <strong>{formatMetricValue(averageValue, activeMetric.format)}</strong>
              <em>{`${trendSeries.length} 天平均`}</em>
            </div>
          </div>

          <div className="analytics-breakdown-list">
            {metricOptions.map((item) => (
              <div className="analytics-breakdown-row" key={item.key}>
                <span>{item.label}</span>
                <strong>{formatMetricValue(selectedItem.values[item.key] || 0, item.format)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function ActionWorkbench({
  rows,
  onNavigate,
}: {
  rows: PromotionActionWorkbenchItem[]
  onNavigate: (path: string) => void
}) {
  if (!rows.length) {
    return null
  }

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">续期召回动作</div>
          <div className="resource-section-subtitle">先把提醒和优惠这两条续期链路收拢成动作卡，方便继续进入对应工作台。</div>
        </div>
      </div>

      <div className="analytics-action-grid">
        {rows.map((item) => (
          <article className="analytics-action-card" key={item.action}>
            <div className="analytics-action-title">{item.action}</div>
            <div className="analytics-action-hint">{item.detail}</div>
            <div className="analytics-action-list">
              <div className="analytics-action-row">
                <span>目标人数</span>
                <strong>{item.target}</strong>
              </div>
              <div className="analytics-action-row">
                <span>已触达 / 已配置</span>
                <strong>{item.sent}</strong>
              </div>
              <div className="analytics-action-row">
                <span>当前结果</span>
                <strong>{item.result}</strong>
              </div>
            </div>

            {item.actionPath ? (
              <div className="analytics-detail-actions">
                <button className="admin-resource-ghost" onClick={() => onNavigate(item.actionPath || '')} type="button">
                  {item.actionLabel || '继续查看'}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function PromotionReportPanel({
  title,
  hint,
  columns,
  rows,
  items,
  onExport,
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  title: string
  hint: string
  columns: string[]
  rows: Array<Record<string, string>>
  items: PromotionReportDetailItem[]
  onExport: () => void
  pagination: PromotionPagePayload['pagination']
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">{title}</div>
          <div className="resource-section-subtitle">{hint}</div>
        </div>
        <div className="resource-action-row">
          <button className="admin-resource-ghost" disabled={!rows.length} onClick={onExport} type="button">
            导出数据
          </button>
        </div>
      </div>

      <div className="resource-table">
        <div className="resource-table-row resource-table-head resource-table-content">
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>

        {rows.length ? (
          rows.map((row, index) => (
            <div className="resource-table-row resource-table-content" key={items[index]?.id || `${row.col1}_${index}`}>
              <span>{row.col1}</span>
              <span>{row.col2}</span>
              <span>{row.col3}</span>
              <span>{row.col4}</span>
              <span>{row.col5}</span>
              <span>{row.col6}</span>
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
    </section>
  )
}

function ReportWorkbench({
  title,
  hint,
  columns,
  rows,
  items,
  selectedReportId,
  onSelect,
  onExport,
  onCopyOrderNo,
  onNavigate,
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  title: string
  hint: string
  columns: string[]
  rows: Array<Record<string, string>>
  items: PromotionReportDetailItem[]
  selectedReportId: string
  onSelect: (id: string) => void
  onExport: () => void
  onCopyOrderNo: (orderNo: string) => void
  onNavigate: (path: string, extraQuery?: Record<string, string>) => void
  pagination: PromotionPagePayload['pagination']
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const selectedReport = useMemo(
    () => items.find((item) => item.id === selectedReportId) || items[0] || null,
    [items, selectedReportId],
  )

  return (
    <section className="admin-resource-panel">
      <div className="resource-section-header">
        <div>
          <div className="resource-section-title">{title}</div>
          <div className="resource-section-subtitle">{hint}</div>
        </div>
        <div className="resource-action-row">
          <button className="admin-resource-ghost" disabled={!rows.length} onClick={onExport} type="button">
            导出当前视图
          </button>
        </div>
      </div>

      <div className="analytics-detail-grid">
        <div className="resource-table">
          <div className="resource-table-row resource-table-head resource-table-content">
            {columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>

          {rows.length ? (
            rows.map((row, index) => {
              const report = items[index]
              return (
                <button
                  className={`resource-table-row resource-table-content analytics-report-table-row is-clickable${selectedReport?.id === report?.id ? ' is-selected' : ''}`}
                  key={report?.id || `${row.col1}_${index}`}
                  onClick={() => report && onSelect(report.id)}
                  type="button"
                >
                  <span>{row.col1}</span>
                  <span>{row.col2}</span>
                  <span>{row.col3}</span>
                  <span>{row.col4}</span>
                  <span>{row.col5}</span>
                  <span>{row.col6}</span>
                </button>
              )
            })
          ) : (
            <div className="admin-resource-empty">当前筛选条件下暂无数据</div>
          )}
        </div>

        {selectedReport ? (
          <article className="analytics-detail-card">
            <div className="analytics-detail-head">
              <div>
                <div className="analytics-detail-title">{selectedReport.title}</div>
                <div className="analytics-detail-subtitle">{selectedReport.subtitle}</div>
              </div>
              <span className={`resource-table-chip${buildOrderStatusClass(selectedReport.status)}`}>{selectedReport.statusLabel}</span>
            </div>

            <div className="analytics-detail-metrics">
              <div className="analytics-detail-metric">
                <span>支付金额</span>
                <strong>{selectedReport.amount}</strong>
              </div>
              <div className="analytics-detail-metric">
                <span>星主收入</span>
                <strong>{selectedReport.income}</strong>
              </div>
            </div>

            <div className="analytics-detail-hint">{selectedReport.insight}</div>

            <div className="analytics-detail-fields">
              {selectedReport.detailFields.map((field) => (
                <div className="analytics-detail-field" key={`${selectedReport.id}_${field.label}`}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>

            <div className="analytics-detail-actions">
              <button className="admin-resource-ghost" onClick={() => onCopyOrderNo(selectedReport.orderNo)} type="button">
                复制订单号
              </button>
              {selectedReport.actionPath ? (
                <button
                  className="admin-resource-ghost"
                  onClick={() => onNavigate(selectedReport.actionPath || '', selectedReport.actionQuery)}
                  type="button"
                >
                  {selectedReport.actionLabel || '继续查看'}
                </button>
              ) : null}
            </div>
          </article>
        ) : null}
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
    </section>
  )
}

export function PromotionDataPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const requestedQuery = useMemo(() => readAnalyticsQuery(location.search), [location.search])
  const mode: AnalyticsMode =
    location.pathname === '/income' ? 'income' : location.pathname === '/renewal/data' ? 'renewal' : 'promotion'

  const [rangeDays, setRangeDays] = useState(requestedQuery.rangeDays)
  const [startDate, setStartDate] = useState(requestedQuery.startDate)
  const [endDate, setEndDate] = useState(requestedQuery.endDate)
  const [page, setPage] = useState(requestedQuery.page)
  const [pageData, setPageData] = useState<PromotionPagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeTrendMetricKey, setActiveTrendMetricKey] = useState('')
  const [selectedTrendDate, setSelectedTrendDate] = useState('')
  const [selectedReportId, setSelectedReportId] = useState('')

  function buildAdminPath(path: string, extraQuery?: Record<string, string>) {
    const [pathname, rawSearch = ''] = path.split('?')
    const nextSearchParams = new URLSearchParams()
    const pathSearchParams = new URLSearchParams(rawSearch)

    if (groupId) {
      nextSearchParams.set('groupId', groupId)
    }

    pathSearchParams.forEach((value, key) => {
      nextSearchParams.set(key, value)
    })

    Object.entries(extraQuery || {}).forEach(([key, value]) => {
      if (value) {
        nextSearchParams.set(key, value)
      } else {
        nextSearchParams.delete(key)
      }
    })

    const nextSearch = nextSearchParams.toString()
    return `${pathname}${nextSearch ? `?${nextSearch}` : ''}`
  }

  function navigateWithinAdmin(path: string, extraQuery?: Record<string, string>) {
    navigate(buildAdminPath(path, extraQuery))
  }

  useEffect(() => {
    setError('')
    setNotice('')
    setActiveTrendMetricKey('')
    setSelectedTrendDate('')
    setSelectedReportId('')
  }, [groupId, mode])

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

    const loader = mode === 'income' ? getIncomePageData : mode === 'renewal' ? getRenewalPageData : getPromotionPageData
    loader({ groupId, rangeDays, startDate, endDate, page })
      .then((data) => {
        if (!active) return
        setPageData(data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载分析页失败')
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
  }, [endDate, groupId, mode, page, rangeDays, startDate])

  useEffect(() => {
    if (!pageData?.trendMetricOptions.length) {
      setActiveTrendMetricKey('')
      return
    }

    setActiveTrendMetricKey((currentValue) =>
      pageData.trendMetricOptions.some((item) => item.key === currentValue) ? currentValue : pageData.defaultTrendMetricKey,
    )
  }, [pageData])

  useEffect(() => {
    if (!pageData?.trendSeries.length) {
      setSelectedTrendDate('')
      return
    }

    setSelectedTrendDate((currentValue) =>
      pageData.trendSeries.some((item) => item.date === currentValue)
        ? currentValue
        : pageData.trendSeries[pageData.trendSeries.length - 1].date,
    )
  }, [pageData])

  useEffect(() => {
    if (!pageData?.reportItems.length) {
      setSelectedReportId('')
      return
    }

    setSelectedReportId((currentValue) =>
      pageData.reportItems.some((item) => item.id === currentValue) ? currentValue : pageData.reportItems[0].id,
    )
  }, [pageData])

  useEffect(() => {
    const nextSearchParams = new URLSearchParams()

    if (groupId) {
      nextSearchParams.set('groupId', groupId)
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
  }, [endDate, groupId, location.pathname, location.search, navigate, page, rangeDays, startDate])

  const title = pageData?.title || (mode === 'income' ? '收入数据' : mode === 'renewal' ? '续期数据' : '推广数据')
  const subtitle =
    mode === 'promotion'
      ? ''
      : pageData?.subtitle ||
        (mode === 'income'
          ? '查看收入概览、收入趋势和订单明细。'
          : mode === 'renewal'
            ? '查看续期概览、续期趋势和续期订单明细。'
            : '查看推广概览、付费转化趋势和推广订单明细。')
  const tag = pageData?.tag || (mode === 'income' ? '数据概览' : mode === 'renewal' ? '成员续期' : '推广拉新')
  const isPromotionMode = mode === 'promotion'
  const showRangeFilters = !isPromotionMode
  const showTrendWorkbench = !isPromotionMode
  const hasActiveRangeFilters = Boolean(startDate || endDate) || rangeDays !== 7 || page > 1

  function handleExportCurrentView() {
    if (!pageData) return
    triggerCsvDownload(buildExportFileName(mode, groupId || 'group'), pageData.reportColumns, pageData.reportRows)
    setNotice('当前报表已导出')
  }

  async function handleCopy(value: string, successMessage: string) {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setNotice(successMessage)
    } catch {
      setNotice('复制失败，请手动复制当前内容')
    }
  }

  function handleResetCurrentView() {
    setRangeDays(7)
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <AdminLayout
      title={title}
      subtitle={subtitle}
      tag={tag}
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page promotion-analytics-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        <section className="admin-resource-panel resource-group-strip">
          <div>
            <div className="resource-group-name">{pageData?.group.name || currentGroup?.name || groupId || '未分配星球'}</div>
            {!isPromotionMode ? (
              <div className="resource-group-meta">
                <span>星主：{pageData?.group.ownerName || currentGroup?.ownerName || '-'}</span>
                <span>groupId：{groupId || '-'}</span>
                <span>模式：{buildModeLabel(mode)}</span>
              </div>
            ) : null}
          </div>
          <div className="resource-group-status">{buildModeStatus(mode)}</div>
        </section>

        {showRangeFilters ? (
          <section className="admin-resource-panel">
            <div className="resource-section-header">
              <div>
                <div className="resource-section-title">数据范围</div>
                <div className="resource-section-subtitle">趋势分析支持近 7 / 15 / 30 天切换，报表明细可按起止日期筛选。</div>
              </div>
              <div className="resource-action-row">
                <div className="resource-range-tabs">
                  {RANGE_OPTIONS.map((value) => (
                    <button
                      className={value === rangeDays ? 'is-active' : ''}
                      key={value}
                      onClick={() => {
                        setRangeDays(value)
                        setPage(1)
                      }}
                      type="button"
                    >
                      近 {value} 天
                    </button>
                  ))}
                </div>
                <button className="admin-resource-ghost" disabled={!hasActiveRangeFilters} onClick={handleResetCurrentView} type="button">
                  重置当前视图
                </button>
              </div>
            </div>

            <div className="resource-filter-grid">
              <label className="admin-resource-field">
                <span>报表开始时间</span>
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
                <span>报表结束时间</span>
                <input
                  onChange={(event) => {
                    setEndDate(event.target.value)
                    setPage(1)
                  }}
                  type="date"
                  value={endDate}
                />
              </label>
            </div>
          </section>
        ) : null}

        {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}

        {!loading && pageData ? (
          <>
            {pageData.overviewRows.map((row, index) => (
              <section className="admin-resource-panel" key={`overview_${index}`}>
                <div className="resource-overview-grid">
                  {row.map((item) => (
                    <OverviewCard hint={item.hint} key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </section>
            ))}

            {pageData.insightCards.length ? (
              <section className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">经营焦点</div>
                    <div className="resource-section-subtitle">把当前阶段最值得盯的指标先单独拎出来，减少只看大盘时的判断成本。</div>
                  </div>
                </div>

                <div className="resource-overview-grid analytics-insight-grid">
                  {pageData.insightCards.map((item) => (
                    <OverviewCard hint={item.hint} key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </section>
            ) : null}

            {showTrendWorkbench ? (
              <TrendWorkbench
                activeMetricKey={activeTrendMetricKey}
                hint={pageData.trendHint}
                metricOptions={pageData.trendMetricOptions}
                onMetricChange={setActiveTrendMetricKey}
                onSelectDate={setSelectedTrendDate}
                selectedDate={selectedTrendDate}
                title={pageData.trendTitle}
                trendSeries={pageData.trendSeries}
              />
            ) : null}

            {pageData.actionRows?.length ? (
              <ActionWorkbench onNavigate={(path) => navigateWithinAdmin(path)} rows={pageData.actionRows} />
            ) : null}

            {isPromotionMode ? (
              <PromotionReportPanel
                columns={pageData.reportColumns}
                hint={pageData.reportHint}
                items={pageData.reportItems}
                onExport={handleExportCurrentView}
                onNextPage={() => setPage((currentValue) => Math.min(pageData.pagination.totalPages, currentValue + 1))}
                onPreviousPage={() => setPage((currentValue) => Math.max(1, currentValue - 1))}
                pagination={pageData.pagination}
                rows={pageData.reportRows}
                title={pageData.reportTitle}
              />
            ) : null}

            {!isPromotionMode ? (
              <ReportWorkbench
                columns={pageData.reportColumns}
                hint={pageData.reportHint}
                items={pageData.reportItems}
                onCopyOrderNo={(orderNo) => void handleCopy(orderNo, '订单号已复制')}
                onExport={handleExportCurrentView}
                onNavigate={(path, extraQuery) => navigateWithinAdmin(path, extraQuery)}
                onNextPage={() => setPage((currentValue) => Math.min(pageData.pagination.totalPages, currentValue + 1))}
                onPreviousPage={() => setPage((currentValue) => Math.max(1, currentValue - 1))}
                onSelect={setSelectedReportId}
                pagination={pageData.pagination}
                rows={pageData.reportRows}
                selectedReportId={selectedReportId}
                title={pageData.reportTitle}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
