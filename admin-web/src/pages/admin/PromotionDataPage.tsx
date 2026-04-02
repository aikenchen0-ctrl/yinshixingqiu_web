import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  getPromotionPageData,
  type PromotionAdviceItem,
  type PromotionFunnelItem,
  type PromotionPagePayload,
  type PromotionSummaryItem,
} from '../../services/promotionService'

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: PromotionSummaryItem['label']
  value: PromotionSummaryItem['value']
  hint: PromotionSummaryItem['hint']
}) {
  const [major, minor = '00'] = value.split('.')

  return (
    <article className="promo-summary-card">
      <div className="promo-summary-label">
        <span>{label}</span>
        <span className="promo-summary-tip">?</span>
      </div>
      <div className="promo-summary-value">
        <span className="promo-summary-major">{major}</span>
        {value.includes('.') ? <span className="promo-summary-minor">.{minor}</span> : null}
      </div>
      <div className="promo-summary-hint">{hint}</div>
    </article>
  )
}

function FunnelSection({
  title,
  rows,
  rateLabel,
}: {
  title: string
  rows: PromotionFunnelItem[]
  rateLabel: string
}) {
  return (
    <section className="promo-panel">
      <div className="promo-funnel">
        <div className="promo-funnel-list">
          {rows.map((row) => (
            <div className={`promo-funnel-row promo-funnel-row-${row.tone}`} key={row.title}>
              <div className="promo-funnel-copy">
                <strong>{row.count}</strong>
                <span>{row.title}</span>
              </div>
              <div className={`promo-funnel-block promo-funnel-block-${row.tone}`}>{row.action}</div>
            </div>
          ))}
        </div>
        <div className="promo-funnel-side">
          <div className="promo-funnel-side-line" />
          <div className="promo-funnel-side-copy">
            <span>{rateLabel}</span>
            <strong>0%</strong>
          </div>
        </div>
      </div>
      <div className="promo-funnel-title">{title}</div>
    </section>
  )
}

function AdviceSection({
  title,
  suffix,
  rows,
  collapsed,
  onToggle,
}: {
  title: PromotionAdviceItem['title']
  suffix: PromotionAdviceItem['suffix']
  rows: PromotionAdviceItem['rows']
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <section className="promo-advice">
      <button className="promo-advice-head" onClick={onToggle} type="button">
        <span className="promo-advice-icon">!</span>
        <strong>{title}</strong>
        <span>{suffix}</span>
        <span className={`promo-advice-caret${collapsed ? ' is-collapsed' : ''}`}>⌃</span>
      </button>
      <div className={`promo-advice-body${collapsed ? ' is-collapsed' : ''}`}>
        {rows.map(([label, text]: [string, string], index: number) => (
          <div className="promo-advice-row" key={label}>
            <span className="promo-advice-index">{index + 1}.</span>
            <div>
              <strong>{label}:</strong>
              <span>{text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function PromotionDataPage() {
  const navigate = useNavigate()
  const [pageData, setPageData] = useState<PromotionPagePayload | null>(null)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})
  const [actionNotice, setActionNotice] = useState('')

  useEffect(() => {
    let active = true

    getPromotionPageData().then((data: PromotionPagePayload) => {
      if (active) {
        setPageData(data)
      }
    })

    return () => {
      active = false
    }
  }, [])

  if (!pageData) {
    return (
      <AdminLayout title="ysc的星球" subtitle="" tag="数据概览" breadcrumb="‹ 返回星球列表">
        <div className="promotion-page promotion-page-reference">
          <div className="promo-panel">加载中...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={pageData.title}
      subtitle={pageData.subtitle}
      tag={pageData.tag}
      breadcrumb={pageData.breadcrumb}
      secondaryActionLabel="切换星球"
      primaryActionLabel="导出数据"
      onSecondaryAction={() => navigate('/group_data')}
      onPrimaryAction={() => setActionNotice(`已导出 ${pageData.title} 推广概览（模拟）`)}
    >
      <div className="promotion-page promotion-page-reference">
        {actionNotice ? <div className="promo-action-notice">{actionNotice}</div> : null}
        <div className="promo-headnote">每日 8 点前更新昨日数据</div>

        <section className="promo-panel promo-panel-summary">
          <div className="promo-summary-grid promo-summary-grid-three">
            {pageData.summaryRows[0].map((item) => (
              <SummaryCard key={item.label} {...item} />
            ))}
          </div>
          <div className="promo-summary-divider" />
          <div className="promo-summary-grid promo-summary-grid-four">
            {pageData.summaryRows[1].map((item) => (
              <SummaryCard key={item.label} {...item} />
            ))}
          </div>
        </section>

        <section className="promo-panel promo-panel-members">
          <div className="promo-summary-grid promo-summary-grid-four">
            {pageData.memberRows.map((item) => (
              <SummaryCard key={item.label} {...item} />
            ))}
          </div>
        </section>

        <FunnelSection
          title="30 日付费转化率"
          rows={pageData.promotionFlow}
          rateLabel="30 日付费转化率"
        />

        <div className="promo-advice-stack">
          {pageData.adviceSections.map((section) => (
            <AdviceSection
              key={section.title}
              {...section}
              collapsed={!!collapsedMap[section.title]}
              onToggle={() =>
                setCollapsedMap((currentValue) => ({
                  ...currentValue,
                  [section.title]: !currentValue[section.title],
                }))
              }
            />
          ))}
        </div>

        <FunnelSection
          title="30 日续期转化率"
          rows={pageData.renewalFlow}
          rateLabel="30 日续期转化率"
        />
      </div>
    </AdminLayout>
  )
}
