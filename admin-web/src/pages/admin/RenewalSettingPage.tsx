import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getRenewalSettingPageData,
  updateRenewalGuidance,
  updateRenewalSetting,
  type RenewalDiscountItem,
} from '../../services/promotionService'

type GroupSummary = {
  id: string
  name: string
  ownerName: string
}

type DiscountStageKey = 'advance' | 'expiring' | 'grace'

type DiscountStageConfig = {
  key: DiscountStageKey
  title: string
  trigger: string
  description: string
  discount: string
  enabled: boolean
}

type RenewalDiscountDraft = {
  enabled: boolean
  limitWindow: boolean
  startDate: string
  endDate: string
  audience: string
  stackWithCoupon: boolean
  minRenewCount: string
  basePrice: string
  stages: DiscountStageConfig[]
}

const RENEWAL_LEGEND_IMAGE_URL = 'https://wx.zsxq.com/assets_dweb/images/renewal_3.png'

const DEFAULT_DISCOUNT_DRAFT: RenewalDiscountDraft = {
  enabled: true,
  limitWindow: true,
  startDate: '2026-04-01',
  endDate: '2026-06-30',
  audience: 'renewable_members',
  stackWithCoupon: true,
  minRenewCount: '0',
  basePrice: '365.00',
  stages: [
    {
      key: 'advance',
      title: '提前续期',
      trigger: '到期前 30 天',
      description: '优先给最早进入续期阶段的成员更强折扣，拉高提前续费比例。',
      discount: '8.5',
      enabled: true,
    },
    {
      key: 'expiring',
      title: '即将到期',
      trigger: '到期前 7 天',
      description: '临近到期的默认折扣档，适合承接大多数正常续费用户。',
      discount: '9.0',
      enabled: true,
    },
    {
      key: 'grace',
      title: '宽限召回',
      trigger: '到期后 3 天',
      description: '到期后的最后一轮召回折扣，价格要高于提前续期档。',
      discount: '9.5',
      enabled: true,
    },
  ],
}

const DISCOUNT_OPTIONS = ['9.5', '9.0', '8.5', '8.0', '7.5'] as const

function formatDiscountLabel(value: string) {
  return `${value} 折`
}

function calculatePrice(basePrice: string, discount: string) {
  const price = Number.parseFloat(basePrice || '0')
  const ratio = Number.parseFloat(discount || '0')

  if (!Number.isFinite(price) || !Number.isFinite(ratio)) {
    return '0.00'
  }

  return ((price * ratio) / 10).toFixed(2)
}

function formatDiscountValueFromPercentage(value: number) {
  const normalized = Number.isFinite(value) ? value / 10 : 10
  return normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1)
}

function buildDiscountOptionList(currentValue: string) {
  const values = new Set<string>(DISCOUNT_OPTIONS)
  if (currentValue) {
    values.add(currentValue)
  }

  return [...values].sort((left, right) => Number(right) - Number(left))
}

function buildDiscountDraftFromSetting(setting: RenewalDiscountItem | null): RenewalDiscountDraft {
  if (!setting) {
    return DEFAULT_DISCOUNT_DRAFT
  }

  return {
    enabled: setting.enabled,
    limitWindow: setting.limitWindow,
    startDate: setting.startDate || setting.beginTime.slice(0, 10) || '',
    endDate: setting.endDate || setting.endTime.slice(0, 10) || '',
    audience: setting.audience || 'renewable_members',
    stackWithCoupon: setting.stackWithCoupon,
    minRenewCount: String(setting.minRenewCount ?? 0),
    basePrice: setting.originalAmount || DEFAULT_DISCOUNT_DRAFT.basePrice,
    stages: DEFAULT_DISCOUNT_DRAFT.stages.map((stage) => {
      if (stage.key === 'advance') {
        return {
          ...stage,
          discount: formatDiscountValueFromPercentage(setting.advanceDiscountPercentage),
          enabled: setting.advanceEnabled,
        }
      }

      if (stage.key === 'grace') {
        return {
          ...stage,
          discount: formatDiscountValueFromPercentage(setting.graceDiscountPercentage),
          enabled: setting.graceEnabled,
        }
      }

      return {
        ...stage,
        discount: formatDiscountValueFromPercentage(setting.discountedPercentage),
        enabled: setting.expiringEnabled,
      }
    }),
  }
}

function buildPageMeta(pathname: string) {
  if (pathname === '/renewal/discounts') {
    return {
      title: '续期折扣',
      subtitle: '',
      status: '折扣配置',
      mode: '阶梯续期折扣',
    }
  }

  return {
    title: '续期页优化',
    subtitle: '在用户续期支付页，增加引导文案，提高支付转化率',
    tag: '成员续期',
    status: '续期页优化',
    mode: '续期页优化',
  }
}

export function RenewalSettingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const isOptimizationPage = location.pathname === '/renewal/page-optimization'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [group, setGroup] = useState<GroupSummary | null>(null)
  const [setting, setSetting] = useState<RenewalDiscountItem | null>(null)
  const [draftGuidance, setDraftGuidance] = useState('')
  const [discountDraft, setDiscountDraft] = useState<RenewalDiscountDraft>(DEFAULT_DISCOUNT_DRAFT)
  const [selectedStageKey, setSelectedStageKey] = useState<DiscountStageKey>('advance')

  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      setSetting(null)
      setDiscountDraft(DEFAULT_DISCOUNT_DRAFT)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getRenewalSettingPageData(groupId)
      .then((data) => {
        if (!active) return
        setGroup(data.group)
        setSetting(data.setting)
        setDiscountDraft(buildDiscountDraftFromSetting(data.setting))
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载续期配置页面失败')
        setGroup(
          currentGroup
            ? {
                id: currentGroup.id,
                name: currentGroup.name,
                ownerName: currentGroup.ownerName,
              }
            : null,
        )
        setSetting(null)
        setDiscountDraft(DEFAULT_DISCOUNT_DRAFT)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [currentGroup, groupId])

  useEffect(() => {
    setDraftGuidance(setting?.guidance || '')
  }, [setting?.guidance])

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const meta = useMemo(() => buildPageMeta(location.pathname), [location.pathname])
  const guidanceLength = draftGuidance.length
  const savedGuidance = setting?.guidance || ''
  const canSaveGuidance = Boolean(groupId && setting) && !loading && !saving && draftGuidance !== savedGuidance
  const groupName = group?.name || currentGroup?.name || groupId || '未分配星球'
  const ownerName = group?.ownerName || currentGroup?.ownerName || '-'
  const selectedStage =
    discountDraft.stages.find((stage) => stage.key === selectedStageKey) || discountDraft.stages[0] || DEFAULT_DISCOUNT_DRAFT.stages[0]
  const enabledStageCount = discountDraft.stages.filter((stage) => stage.enabled).length
  const stagePreviewPrice = calculatePrice(discountDraft.basePrice, selectedStage.discount)
  const stagePreviewNotes = [
    discountDraft.enabled ? '当前折扣策略为启用状态。' : '当前折扣策略为关闭状态，仅保留前端草稿。',
    discountDraft.limitWindow
      ? `仅在 ${discountDraft.startDate || '-'} 到 ${discountDraft.endDate || '-'} 生效。`
      : '未限制生效时间，命中成员可直接使用。',
    discountDraft.stackWithCoupon ? '允许与续期优惠券叠加。' : '不允许与续期优惠券叠加。',
  ]

  function updateDiscountDraft<K extends keyof RenewalDiscountDraft>(field: K, value: RenewalDiscountDraft[K]) {
    setDiscountDraft((currentValue) => ({
      ...currentValue,
      [field]: value,
    }))
  }

  function updateStage(key: DiscountStageKey, updater: (stage: DiscountStageConfig) => DiscountStageConfig) {
    setDiscountDraft((currentValue) => ({
      ...currentValue,
      stages: currentValue.stages.map((stage) => (stage.key === key ? updater(stage) : stage)),
    }))
  }

  function resetDiscountDraft() {
    const nextDraft = buildDiscountDraftFromSetting(setting)
    setDiscountDraft(nextDraft)
    setSelectedStageKey(nextDraft.stages[0]?.key || 'advance')
    setNotice(setting ? '已恢复到后端最新配置' : '已恢复默认折扣草稿')
  }

  async function saveDiscountDraft() {
    if (!groupId) {
      setError('缺少星球ID，暂时无法保存续期折扣')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await updateRenewalSetting({
        groupId,
        enabled: discountDraft.enabled,
        limitWindow: discountDraft.limitWindow,
        startDate: discountDraft.startDate,
        endDate: discountDraft.endDate,
        audience: discountDraft.audience,
        stackWithCoupon: discountDraft.stackWithCoupon,
        minRenewCount: Number.parseInt(discountDraft.minRenewCount || '0', 10) || 0,
        basePrice: discountDraft.basePrice,
        guidance: draftGuidance,
        stages: discountDraft.stages.map((stage) => ({
          key: stage.key,
          discount: stage.discount,
          enabled: stage.enabled,
        })),
      })

      setGroup(response.group)
      setSetting(response.setting)
      setDiscountDraft(buildDiscountDraftFromSetting(response.setting))
      setNotice('续期折扣已保存')
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '保存续期折扣失败'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function saveOptimizationGuidance() {
    if (!groupId || !setting) {
      setError('续期配置尚未加载完成，暂时无法保存续期引导语')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await updateRenewalGuidance({
        groupId,
        guidance: draftGuidance,
      })

      setGroup(response.group)
      setSetting(response.setting)
      setDiscountDraft(buildDiscountDraftFromSetting(response.setting))
      setDraftGuidance(response.setting.guidance || '')
      setNotice('续期引导语已保存')
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '保存续期引导语失败'
      setError(message)
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
      hidePageHeader={isOptimizationPage}
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className={`admin-resource-page ${isOptimizationPage ? 'renewal-setting-page' : 'renewal-discount-page'}`}>
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {isOptimizationPage ? (
          <>
            {!groupLoading && hasGroups ? (
              <>
                <section className="renewal-optimization-header">
                  <div className="renewal-optimization-group-name">{groupName}</div>
                  <div className="renewal-optimization-title-bar">
                    <div className="renewal-optimization-title">{meta.title}</div>
                    <div className="renewal-optimization-subtitle">{meta.subtitle}</div>
                  </div>
                </section>

                {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}

                {!loading ? (
                  <section className="admin-resource-panel renewal-optimization-panel">
                    <div className="renewal-optimization-column">
                      <div className="renewal-optimization-copy">
                        <div className="renewal-optimization-copy-strong">对星友说：</div>
                        <div className="renewal-optimization-copy-text">可展示星友续期可获得的权益，并感谢星友的支持。</div>
                      </div>

                      <div className="renewal-optimization-editor">
                        <textarea
                          className="renewal-optimization-textarea"
                          maxLength={300}
                          onChange={(event) => setDraftGuidance(event.target.value)}
                          placeholder="输入引导文案，提升续期转化率"
                          spellCheck={false}
                          value={draftGuidance}
                        />
                        <div className="renewal-optimization-word-length">{`(${guidanceLength}/300)`}</div>
                      </div>

                      <button
                        className={`renewal-optimization-save${canSaveGuidance ? ' is-enabled' : ''}`}
                        disabled={!canSaveGuidance}
                        onClick={() => void saveOptimizationGuidance()}
                        type="button"
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                    </div>

                    <div className="renewal-optimization-column renewal-optimization-preview">
                      <div className="renewal-optimization-copy">
                        <div className="renewal-optimization-copy-strong">续期页图例</div>
                        <div className="renewal-optimization-copy-text">用户到期前 3 个月，可在此页面购买星球下一期服务。</div>
                      </div>

                      <div className="renewal-optimization-legend">
                        <img alt="续期页图例" src={RENEWAL_LEGEND_IMAGE_URL} />
                      </div>

                      <button
                        className="renewal-optimization-flow-link"
                        disabled={!setting?.renewalUrl}
                        onClick={() => {
                          if (!setting?.renewalUrl) return
                          window.open(setting.renewalUrl, '_blank', 'noopener,noreferrer')
                        }}
                        type="button"
                      >
                        了解用户在 App 内的续期流程 &gt;
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <section className="admin-resource-panel resource-group-strip">
              <div>
                <div className="resource-group-name">{groupName}</div>
                <div className="resource-group-meta">
                  <span>星主：{ownerName}</span>
                  <span>groupId：{groupId || '-'}</span>
                  <span>模式：{meta.mode}</span>
                </div>
              </div>
              <div className="resource-group-status">{meta.status}</div>
            </section>

            <section className="admin-resource-panel">
              <div className="resource-section-header">
                <div>
                  <div className="resource-section-title">折扣配置</div>
                  <div className="resource-section-subtitle">折扣档位、时间范围和命中规则都会写入后端 `renewal_settings`。</div>
                </div>
                <div className="resource-action-row">
                  <button className="admin-resource-ghost" disabled={loading || saving} onClick={resetDiscountDraft} type="button">
                    恢复默认
                  </button>
                  <button className="admin-resource-submit" disabled={loading || saving} onClick={saveDiscountDraft} type="button">
                    {saving ? '保存中...' : '保存配置'}
                  </button>
                </div>
              </div>

              {loading ? <div className="admin-resource-empty">加载中...</div> : null}

              {!loading ? (
              <div className="renewal-discount-config-grid">
                <div className="renewal-discount-config-main">
                  <div className="permission-switch-panel renewal-discount-switch-panel">
                    <div className="permission-switch-row">
                      <div>
                        <div className="permission-section-title">启用阶梯续期折扣</div>
                        <div className="resource-section-subtitle">关闭后仅保留当前前端草稿，不对成员生效。</div>
                      </div>
                      <label className={`permission-switch${discountDraft.enabled ? ' is-on' : ''}`}>
                        <input
                          checked={discountDraft.enabled}
                          onChange={(event) => updateDiscountDraft('enabled', event.target.checked)}
                          type="checkbox"
                        />
                        <span className="permission-switch-track" />
                      </label>
                    </div>

                    <div className="permission-switch-row">
                      <div>
                        <div className="permission-section-title">限制生效时间</div>
                        <div className="resource-section-subtitle">用于控制活动期折扣，避免长期透出低价。</div>
                      </div>
                      <label className={`permission-switch${discountDraft.limitWindow ? ' is-on' : ''}`}>
                        <input
                          checked={discountDraft.limitWindow}
                          onChange={(event) => updateDiscountDraft('limitWindow', event.target.checked)}
                          type="checkbox"
                        />
                        <span className="permission-switch-track" />
                      </label>
                    </div>
                  </div>

                  <div className="renewal-discount-field-grid">
                    <label className="admin-resource-field">
                      <span>续期原价</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateDiscountDraft('basePrice', event.target.value)}
                        placeholder="365.00"
                        value={discountDraft.basePrice}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>命中人群</span>
                      <select
                        onChange={(event) => updateDiscountDraft('audience', event.target.value)}
                        value={discountDraft.audience}
                      >
                        <option value="renewable_members">全部可续期成员</option>
                        <option value="expiring_members">即将到期成员</option>
                        <option value="grace_members">宽限期召回成员</option>
                        <option value="high_loyalty_members">连续续费成员</option>
                      </select>
                    </label>
                    <label className="admin-resource-field">
                      <span>开始时间</span>
                      <input
                        disabled={!discountDraft.limitWindow}
                        onChange={(event) => updateDiscountDraft('startDate', event.target.value)}
                        type="date"
                        value={discountDraft.startDate}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>结束时间</span>
                      <input
                        disabled={!discountDraft.limitWindow}
                        onChange={(event) => updateDiscountDraft('endDate', event.target.value)}
                        type="date"
                        value={discountDraft.endDate}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>最低连续续费次数</span>
                      <input
                        inputMode="numeric"
                        onChange={(event) => updateDiscountDraft('minRenewCount', event.target.value)}
                        placeholder="0"
                        value={discountDraft.minRenewCount}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>优惠券叠加</span>
                      <select
                        onChange={(event) => updateDiscountDraft('stackWithCoupon', event.target.value === 'true')}
                        value={String(discountDraft.stackWithCoupon)}
                      >
                        <option value="true">允许叠加</option>
                        <option value="false">不允许叠加</option>
                      </select>
                    </label>
                  </div>

                  <div className="renewal-discount-stage-grid">
                    {discountDraft.stages.map((stage) => {
                      const stagePrice = calculatePrice(discountDraft.basePrice, stage.discount)
                      const discountOptions = buildDiscountOptionList(stage.discount)

                      return (
                        <div
                          className={`renewal-discount-stage-card${selectedStageKey === stage.key ? ' is-active' : ''}`}
                          key={stage.key}
                          onClick={() => setSelectedStageKey(stage.key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedStageKey(stage.key)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="renewal-discount-stage-head">
                            <div>
                              <div className="renewal-discount-stage-title">{stage.title}</div>
                              <div className="renewal-discount-stage-trigger">{stage.trigger}</div>
                            </div>
                            <label className={`permission-switch renewal-discount-stage-switch${stage.enabled ? ' is-on' : ''}`}>
                              <input
                                checked={stage.enabled}
                                onChange={(event) => {
                                  event.stopPropagation()
                                  updateStage(stage.key, (currentValue) => ({
                                    ...currentValue,
                                    enabled: event.target.checked,
                                  }))
                                }}
                                type="checkbox"
                              />
                              <span className="permission-switch-track" />
                            </label>
                          </div>

                          <div className="renewal-discount-stage-body">
                            <label className="admin-resource-field">
                              <span>折扣档位</span>
                              <select
                                onChange={(event) => {
                                  updateStage(stage.key, (currentValue) => ({
                                    ...currentValue,
                                    discount: event.target.value,
                                  }))
                                }}
                                onClick={(event) => event.stopPropagation()}
                                value={stage.discount}
                              >
                                {discountOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {formatDiscountLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="renewal-discount-stage-metric">
                              <span>预估实付价</span>
                              <strong>{`¥${stagePrice}`}</strong>
                            </div>
                          </div>

                          <div className="renewal-discount-stage-description">{stage.description}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <aside className="renewal-discount-preview-card">
                  <div className="renewal-discount-preview-tag">{selectedStage.enabled ? '当前选中阶段' : '当前阶段已关闭'}</div>
                  <div className="renewal-discount-preview-title">{selectedStage.title}</div>
                  <div className="renewal-discount-preview-subtitle">{selectedStage.trigger}</div>

                  <div className="renewal-discount-preview-metrics">
                    <div className="renewal-discount-preview-metric">
                      <span>折扣</span>
                      <strong>{formatDiscountLabel(selectedStage.discount)}</strong>
                    </div>
                    <div className="renewal-discount-preview-metric">
                      <span>实付价</span>
                      <strong>{`¥${stagePreviewPrice}`}</strong>
                    </div>
                  </div>

                  <div className="renewal-discount-preview-row">
                    <span>命中人群</span>
                    <strong>
                      {discountDraft.audience === 'renewable_members'
                        ? '全部可续期成员'
                        : discountDraft.audience === 'expiring_members'
                          ? '即将到期成员'
                          : discountDraft.audience === 'grace_members'
                            ? '宽限期召回成员'
                            : '连续续费成员'}
                    </strong>
                  </div>
                  <div className="renewal-discount-preview-row">
                    <span>当前开启阶段</span>
                    <strong>{`${enabledStageCount} / ${discountDraft.stages.length}`}</strong>
                  </div>
                  <div className="renewal-discount-preview-row">
                    <span>连续续费门槛</span>
                    <strong>{`${discountDraft.minRenewCount || '0'} 次`}</strong>
                  </div>

                  <div className="generic-admin-notice-list">
                    {stagePreviewNotes.map((item) => (
                      <div className="generic-admin-notice-item" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
