import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import { useDashboardPageData } from '../../hooks/useDashboardPageData'

function buildModeLabel(pathname: string) {
  if (pathname.startsWith('/promotion/')) return '推广拉新'
  if (pathname.startsWith('/activity/')) return '用户活跃'
  if (pathname.startsWith('/renewal/')) return '成员续期'
  if (pathname.startsWith('/tools/')) return '运营工具'
  if (pathname.startsWith('/permissions')) return '权限设置'
  return '管理后台'
}

export function DashboardPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const { data: page, loading, error } = useDashboardPageData(location.pathname)

  const chartRows = useMemo(
    () =>
      (page?.chartPoints || []).map((value, index, source) => ({
        value,
        label: `样本 ${index + 1}`,
        date: `P${index + 1}`,
        height: Math.max(16, Math.round((value / Math.max(...source, 1)) * 132)),
      })),
    [page?.chartPoints],
  )

  const tableGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(page?.tableColumns?.length || 1, 1)}, minmax(120px, 1fr))`,
    }),
    [page?.tableColumns],
  )

  return (
    <AdminLayout
      title={page?.title || '功能建设中'}
      subtitle={page?.subtitle || '当前页面先转入项目内管理框架，后续会逐步替换成真实数据页。'}
      tag={page?.pageTag || '占位页'}
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="admin-resource-page generic-admin-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <section className="admin-resource-panel resource-group-strip">
              <div>
                <div className="resource-group-name">{page?.title || currentGroup?.name || '后台页面'}</div>
                <div className="resource-group-meta">
                  <span>星球：{currentGroup?.name || '-'}</span>
                  <span>groupId：{groupId}</span>
                  <span>模式：{buildModeLabel(location.pathname)}</span>
                  <span>路径：{location.pathname}</span>
                </div>
              </div>
              <div className="resource-group-status">项目内页面</div>
            </section>

            {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}

            {!loading && page?.stats?.length ? (
              <section className="admin-resource-panel">
                <div className="resource-overview-grid">
                  {page.stats.map((item) => (
                    <article className="resource-overview-card" key={item.label}>
                      <div className="resource-overview-label">{item.label}</div>
                      <div className="resource-overview-value">{item.value}</div>
                      <div className="resource-overview-hint">{item.hint}</div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!loading && page?.secondaryStats?.length ? (
              <section className="admin-resource-panel">
                <div className="resource-overview-grid">
                  {page.secondaryStats.map((item) => (
                    <article className="resource-overview-card" key={item.label}>
                      <div className="resource-overview-label">{item.label}</div>
                      <div className="resource-overview-value">{item.value}</div>
                      <div className="resource-overview-hint">{item.hint}</div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!loading && page?.chartTitle && page.chartHint && chartRows.length ? (
              <section className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">{page.chartTitle}</div>
                    <div className="resource-section-subtitle">{page.chartHint}</div>
                  </div>
                </div>

                <div className="resource-trend-grid">
                  <div className="resource-mini-chart">
                    {chartRows.map((item) => (
                      <div className="resource-mini-chart-column" key={item.date}>
                        <div className="resource-mini-chart-bar" style={{ height: `${item.height}px` }} />
                        <span>{item.value}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="resource-trend-metrics">
                    {chartRows.slice(-3).map((item) => (
                      <article className="resource-trend-metric" key={item.date}>
                        <div className="resource-trend-metric-day">{item.label}</div>
                        <div>数值：{item.value}</div>
                        <div>标记：{item.date}</div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {!loading && page?.tableTitle && page.tableHint && page.tableColumns?.length ? (
              <section className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">{page.tableTitle}</div>
                    <div className="resource-section-subtitle">{page.tableHint}</div>
                  </div>
                </div>

                <div className="resource-table">
                  <div className="resource-table-row resource-table-head" style={tableGridStyle}>
                    {page.tableColumns.map((column) => (
                      <span key={column.key}>{column.label}</span>
                    ))}
                  </div>

                  {page.tableRows?.length ? (
                    page.tableRows.map((row, index) => (
                      <div className="resource-table-row" key={`${location.pathname}_${index}`} style={tableGridStyle}>
                        {page.tableColumns?.map((column) => (
                          <span key={column.key}>{row[column.key] || '-'}</span>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="admin-resource-empty">暂无数据</div>
                  )}
                </div>
              </section>
            ) : null}

            {!loading && page?.notices?.length ? (
              <section className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">实现提醒</div>
                    <div className="resource-section-subtitle">这些提示来自当前阶段的结构预留和后续联调方向。</div>
                  </div>
                </div>

                <div className="generic-admin-notice-list">
                  {page.notices.map((item) => (
                    <div className="generic-admin-notice-item" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
