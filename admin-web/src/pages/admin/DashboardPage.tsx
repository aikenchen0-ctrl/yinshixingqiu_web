import { useLocation } from 'react-router-dom'
import { NoticePanel } from '../../components/NoticePanel'
import { StatCards } from '../../components/StatCards'
import { TablePanel } from '../../components/TablePanel'
import { TrendPanel } from '../../components/TrendPanel'
import { useDashboardPageData } from '../../hooks/useDashboardPageData'

export function DashboardPage() {
  const location = useLocation()
  const { data: page, loading, error } = useDashboardPageData(location.pathname)

  if (loading) {
    return (
      <div className="content-stack">
        <article className="panel skeleton-panel">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-block" />
        </article>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="content-stack">
        <article className="panel notice-panel error-panel">
          <div className="panel-head">
            <div>
              <h3>页面加载失败</h3>
              <p>{error || '未获取到页面数据'}</p>
            </div>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="content-stack">
      {page.stats?.length ? <StatCards items={page.stats} /> : null}
      {page.secondaryStats?.length ? <StatCards items={page.secondaryStats} /> : null}
      {page.chartTitle && page.chartHint && page.chartPoints ? (
        <TrendPanel title={page.chartTitle} hint={page.chartHint} points={page.chartPoints} />
      ) : null}
      {page.tableTitle && page.tableHint && page.tableColumns && page.tableRows ? (
        <TablePanel
          title={page.tableTitle}
          hint={page.tableHint}
          columns={page.tableColumns}
          rows={page.tableRows}
        />
      ) : null}
      {page.notices?.length ? <NoticePanel items={page.notices} /> : null}
    </div>
  )
}
