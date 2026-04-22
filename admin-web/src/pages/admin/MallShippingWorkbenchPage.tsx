import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout'
import { mallPlatformMenuGroups } from '../../data/menu'
import {
  getMallPublicConfig,
  getAdminMallOrders,
  shipAdminMallOrder,
  updateAdminMallOrderStatus,
  type AdminMallOrderItem,
  type MallPublicConfigItem,
} from '../../services/adminMallService'

type ShippingFilterKey = 'all' | 'pending' | 'ready' | 'shipped' | 'refund'
type ShippingDraftField = 'shippingCompany' | 'shippingTrackingNo' | 'shippingRemark'

type ShippingDraft = {
  shippingCompany: string
  shippingTrackingNo: string
  shippingRemark: string
}

const FILTER_OPTIONS: Array<{
  key: ShippingFilterKey
  label: string
}> = [
  { key: 'all', label: '全部订单' },
  { key: 'ready', label: '待发货' },
  { key: 'refund', label: '退款相关' },
  { key: 'shipped', label: '已发货' },
  { key: 'pending', label: '待支付' },
]

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ').replace(/-/g, '/')
}

function createShippingDraft(order?: AdminMallOrderItem): ShippingDraft {
  return {
    shippingCompany: order?.shippingCompany || '',
    shippingTrackingNo: order?.shippingTrackingNo || '',
    shippingRemark: order?.shippingRemark || '',
  }
}

function buildShippingDraftMap(orders: AdminMallOrderItem[]) {
  return orders.reduce<Record<string, ShippingDraft>>((result, item) => {
    result[item.id] = createShippingDraft(item)
    return result
  }, {})
}

function matchesShippingFilter(order: AdminMallOrderItem, filterKey: ShippingFilterKey) {
  if (filterKey === 'all') {
    return true
  }

  if (filterKey === 'pending') {
    return order.status === 'PENDING'
  }

  if (filterKey === 'ready') {
    return (
      order.status === 'PAID' &&
      order.shippingStatus !== 'SHIPPED' &&
      order.refundStatus !== 'PENDING' &&
      order.refundStatus !== 'PROCESSING' &&
      order.refundStatus !== 'SUCCESS'
    )
  }

  if (filterKey === 'shipped') {
    return order.shippingStatus === 'SHIPPED'
  }

  if (filterKey === 'refund') {
    return order.refundStatus !== 'NONE'
  }

  return true
}

function matchesSearchKeyword(order: AdminMallOrderItem, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return true
  }

  const searchTargets = [
    order.orderNo,
    order.user?.nickname,
    order.user?.mobile,
    order.shippingAddress.recipientName,
    order.shippingAddress.phone,
    order.shippingAddress.fullAddress,
    order.shippingCompany,
    order.shippingTrackingNo,
    ...order.items.map((item) => item.title),
  ]

  return searchTargets.some((value) => String(value || '').toLowerCase().includes(normalizedKeyword))
}

function resolveOrderStatusChipClass(status: string) {
  if (status === 'PENDING') return 'is-warning'
  if (status === 'PAID') return 'is-success'
  return 'is-muted'
}

function resolveShippingStatusChipClass(order: AdminMallOrderItem) {
  if (order.refundStatus === 'SUCCESS') return 'is-muted'
  if (order.refundStatus === 'PROCESSING' || order.refundStatus === 'PENDING') return 'is-warning'
  if (order.shippingStatus === 'SHIPPED') return 'is-success'
  if (order.status === 'PAID') return 'is-warning'
  return 'is-muted'
}

function resolveRefundChipClass(status: string) {
  if (status === 'SUCCESS') return 'is-success'
  if (status === 'PROCESSING' || status === 'PENDING') return 'is-warning'
  if (status === 'FAILED' || status === 'REJECTED') return 'is-danger'
  return 'is-muted'
}

export function MallShippingWorkbenchPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [publicMallConfig, setPublicMallConfig] = useState<MallPublicConfigItem | null>(null)
  const [publicMallConfigError, setPublicMallConfigError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [savingOrderId, setSavingOrderId] = useState('')
  const [orders, setOrders] = useState<AdminMallOrderItem[]>([])
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, ShippingDraft>>({})
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterKey, setFilterKey] = useState<ShippingFilterKey>('ready')
  const mallStoreId = publicMallConfig?.storeId || ''
  const mallDisplayName = publicMallConfig?.storeName || '商城'
  const mallConfigLoading = !publicMallConfig && !publicMallConfigError

  useEffect(() => {
    setError('')
    setNotice('')
    setOrders([])
    setShippingDrafts({})
    setSearchKeyword('')
    setFilterKey('ready')
  }, [mallStoreId])

  useEffect(() => {
    let active = true
    setPublicMallConfigError('')

    getMallPublicConfig()
      .then((payload) => {
        if (!active) return
        setPublicMallConfig(payload)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setPublicMallConfig(null)
        setPublicMallConfigError(requestError.message || '商城配置读取失败')
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    if (!mallStoreId) {
      setLoading(false)
      setOrders([])
      setShippingDrafts({})
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getAdminMallOrders({ storeId: mallStoreId, limit: 50 })
      .then((payload) => {
        if (!active) return
        setOrders(payload.items)
        setShippingDrafts(buildShippingDraftMap(payload.items))
      })
      .catch((requestError: Error) => {
        if (!active) return
        setOrders([])
        setShippingDrafts({})
        setError(requestError.message || '加载发货工作台失败')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [mallStoreId, reloadKey])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesShippingFilter(order, filterKey) && matchesSearchKeyword(order, searchKeyword)),
    [filterKey, orders, searchKeyword],
  )

  const filteredOrderCount = filteredOrders.length
  const filteredGrossAmountText = useMemo(
    () =>
      filteredOrders
        .reduce((total, item) => total + item.totalAmount, 0)
        .toFixed(2),
    [filteredOrders],
  )
  const shippingOverviewCards = useMemo(
    () => [
      {
        key: 'filtered',
        label: '当前列表',
        value: `${filteredOrderCount}`,
        hint: searchKeyword.trim() ? '已按关键词筛选' : FILTER_OPTIONS.find((item) => item.key === filterKey)?.label || '全部订单',
      },
      {
        key: 'ready',
        label: '待发货',
        value: `${filteredOrders.filter((item) => matchesShippingFilter(item, 'ready')).length}`,
        hint: '已支付待录物流',
      },
      {
        key: 'shipped',
        label: '已发货',
        value: `${filteredOrders.filter((item) => matchesShippingFilter(item, 'shipped')).length}`,
        hint: '可补录或更新物流',
      },
      {
        key: 'refund',
        label: '退款相关',
        value: `${filteredOrders.filter((item) => matchesShippingFilter(item, 'refund')).length}`,
        hint: '当前停发订单',
      },
    ],
    [filterKey, filteredOrderCount, filteredOrders, searchKeyword],
  )
  const filterOptionCountMap = useMemo(
    () =>
      FILTER_OPTIONS.reduce<Record<ShippingFilterKey, number>>((result, item) => {
        result[item.key] = orders.filter((order) => matchesShippingFilter(order, item.key)).length
        return result
      }, { all: 0, pending: 0, ready: 0, shipped: 0, refund: 0 }),
    [orders],
  )
  const mallConfigBanner = useMemo(() => {
    if (publicMallConfigError) {
      return {
        tone: 'is-error',
        text: `商城平台还没有稳定数据源：${publicMallConfigError}。`,
      }
    }

    return null
  }, [publicMallConfigError])

  function handleShippingDraftChange(orderId: string, field: ShippingDraftField, value: string) {
    setShippingDrafts((currentDrafts) => ({
      ...currentDrafts,
      [orderId]: {
        ...(currentDrafts[orderId] || createShippingDraft()),
        [field]: value,
      },
    }))
  }

  async function handleOrderStatusSubmit(orderId: string, status: 'PAID' | 'CLOSED') {
    if (!mallStoreId || savingOrderId) {
      return
    }

    setSavingOrderId(orderId)
    setError('')
    setNotice('')

    try {
      await updateAdminMallOrderStatus({
        storeId: mallStoreId,
        orderId,
        status,
      })
      setNotice(status === 'PAID' ? '订单已标记为已支付' : '订单已关闭')
      if (status === 'PAID' && filterKey === 'pending') {
        setFilterKey('ready')
      }
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新订单状态失败')
    } finally {
      setSavingOrderId('')
    }
  }

  async function handleShipSubmit(orderId: string) {
    if (!mallStoreId || savingOrderId) {
      return
    }

    const draft = shippingDrafts[orderId] || createShippingDraft()
    const shippingCompany = draft.shippingCompany.trim()
    const shippingTrackingNo = draft.shippingTrackingNo.trim()
    const shippingRemark = draft.shippingRemark.trim()
    const targetOrder = orders.find((item) => item.id === orderId)

    if (!shippingCompany) {
      setError('请输入物流公司')
      return
    }

    if (!shippingTrackingNo) {
      setError('请输入物流单号')
      return
    }

    setSavingOrderId(orderId)
    setError('')
    setNotice('')

    try {
      await shipAdminMallOrder({
        storeId: mallStoreId,
        orderId,
        shippingCompany,
        shippingTrackingNo,
        shippingRemark,
      })
      setNotice(targetOrder?.shippingStatus === 'SHIPPED' ? '物流信息已更新' : '订单已发货')
      if (targetOrder?.shippingStatus !== 'SHIPPED' && filterKey === 'ready') {
        setFilterKey('shipped')
      }
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '发货失败')
    } finally {
      setSavingOrderId('')
    }
  }

  return (
    <AdminLayout
      title="发货工作台"
      subtitle={mallStoreId ? `${mallDisplayName} · 按订单队列处理发货` : '按订单队列处理发货'}
      tag="发货"
      breadcrumb="独立商城平台"
      menuGroups={mallPlatformMenuGroups}
      brandName="血饮商城"
      brandTag="独立商城后台"
      brandLogo="M"
      hideGroupPicker
      hideTopbarAction
      preserveGroupQuery={false}
    >
      <div className="admin-resource-page mall-shipping-page">
        {notice ? <div className="mall-admin-banner is-success">{notice}</div> : null}
        {error ? <div className="mall-admin-banner is-error">{error}</div> : null}
        {mallConfigBanner ? <div className={`mall-admin-banner ${mallConfigBanner.tone}`}>{mallConfigBanner.text}</div> : null}

        {mallConfigLoading || loading ? <div className="admin-resource-empty">正在加载发货工作台...</div> : null}

        {!mallConfigLoading && !loading && mallStoreId ? (
          <>
            <section className="mall-admin-order-overview-grid">
              {shippingOverviewCards.map((item) => (
                <div className="mall-admin-order-overview-card" key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.hint}</em>
                </div>
              ))}
            </section>

            <section className="admin-resource-panel mall-shipping-toolbar">
              <div className="mall-shipping-filter-row">
                {FILTER_OPTIONS.map((item) => (
                  <button
                    key={item.key}
                    className={`mall-shipping-filter-chip ${filterKey === item.key ? 'is-active' : ''}`}
                    onClick={() => setFilterKey(item.key)}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <small>{`${filterOptionCountMap[item.key]} 笔`}</small>
                  </button>
                ))}
              </div>

              <div className="mall-shipping-search-row">
                <label className="admin-resource-field mall-shipping-search-field">
                  <span>搜索订单</span>
                  <input
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="搜订单号、买家手机号、收件人、商品名、物流单号"
                    value={searchKeyword}
                  />
                </label>
                <div className="mall-shipping-search-meta">
                  <strong>{filteredOrderCount}</strong>
                  <span>{`当前结果总额 ¥${filteredGrossAmountText}`}</span>
                </div>
              </div>
            </section>

            <section className="mall-shipping-queue">
              {filteredOrders.map((item) => (
                <article className="admin-resource-panel mall-shipping-card" key={item.id}>
                  {(() => {
                    const shippingState =
                      item.refundStatus === 'PENDING'
                        ? {
                            chipLabel: '售后优先',
                            chipClassName: 'is-warning',
                            summary: '有退款申请，暂停发货',
                            detail: item.refundAmountText ? `退款申请金额 ¥${item.refundAmountText}` : '等待退款审核',
                            allowPaymentAction: false,
                            allowShippingAction: false,
                          }
                        : item.refundStatus === 'PROCESSING'
                          ? {
                              chipLabel: '已停发',
                              chipClassName: 'is-danger',
                              summary: '退款处理中，发货已停用',
                              detail: '等待退款结果',
                              allowPaymentAction: false,
                              allowShippingAction: false,
                            }
                          : item.refundStatus === 'SUCCESS'
                            ? {
                                chipLabel: '已退款',
                                chipClassName: 'is-muted',
                                summary: '订单已退款',
                                detail: item.shippedAt ? `最近发货 ${formatDateTime(item.shippedAt)}` : '当前不再履约',
                                allowPaymentAction: false,
                                allowShippingAction: false,
                              }
                            : item.status === 'PENDING'
                              ? {
                                  chipLabel: '待支付',
                                  chipClassName: 'is-warning',
                                  summary: '订单未确认支付',
                                  detail: '先标记已支付',
                                  allowPaymentAction: true,
                                  allowShippingAction: false,
                                }
                              : item.status === 'CLOSED'
                                ? {
                                    chipLabel: '已关闭',
                                    chipClassName: 'is-muted',
                                    summary: '订单已关闭',
                                    detail: '当前不支持继续发货',
                                    allowPaymentAction: false,
                                    allowShippingAction: false,
                                  }
                                : item.shippingStatus === 'SHIPPED'
                                  ? {
                                      chipLabel: '已发货',
                                      chipClassName: 'is-success',
                                      summary: `${item.shippingCompany || '物流已录入'}${item.shippingTrackingNo ? ` · ${item.shippingTrackingNo}` : ''}`,
                                      detail: item.shippedAt ? `最近发货 ${formatDateTime(item.shippedAt)}` : '可更新物流信息',
                                      allowPaymentAction: false,
                                      allowShippingAction: true,
                                    }
                                  : {
                                      chipLabel: '待发货',
                                      chipClassName: 'is-success',
                                      summary: '待录入物流信息',
                                      detail: item.remark ? `买家备注：${item.remark}` : '填写后确认发货',
                                      allowPaymentAction: false,
                                      allowShippingAction: true,
                                    }

                    return (
                      <>
                        <div className="mall-shipping-card-head">
                          <div>
                            <div className="mall-shipping-order-no">{item.orderNo}</div>
                            <div className="mall-shipping-order-meta">
                              {item.user?.nickname || '匿名用户'}
                              {item.user?.mobile ? ` · ${item.user.mobile}` : ''}
                              {` · UID ${(item.user?.id || item.userId || '').slice(-8) || '-'}`}
                              {` · ${formatDateTime(item.createdAt)}`}
                            </div>
                          </div>

                          <div className="mall-shipping-card-side">
                            <div className="mall-shipping-card-chips">
                              <span className={`resource-table-chip ${resolveOrderStatusChipClass(item.status)}`}>{item.statusLabel}</span>
                              <span className={`resource-table-chip ${resolveShippingStatusChipClass(item)}`}>{item.shippingStatusLabel}</span>
                              {item.refundStatusLabel ? (
                                <span className={`resource-table-chip ${resolveRefundChipClass(item.refundStatus)}`}>
                                  {item.refundStatusLabel}
                                </span>
                              ) : null}
                            </div>
                            <strong>{`¥${item.totalAmountText}`}</strong>
                          </div>
                        </div>

                        <div className="mall-shipping-card-grid">
                          <div className="mall-shipping-card-panel">
                            <div className="mall-shipping-card-panel-title">收货信息</div>
                            <div className="mall-shipping-card-panel-line">
                              {item.shippingAddress.recipientName || '未填写收件人'}
                              {item.shippingAddress.phone ? ` · ${item.shippingAddress.phone}` : ''}
                            </div>
                            <div className="mall-shipping-card-panel-subline">{item.shippingAddress.fullAddress || '未填写收货地址'}</div>
                            {item.remark ? <div className="mall-shipping-card-panel-subline">{`买家备注：${item.remark}`}</div> : null}
                          </div>

                          <div className="mall-shipping-card-panel">
                            <div className="mall-shipping-card-panel-title">商品清单</div>
                            <div className="mall-shipping-line-list">
                              {item.items.map((line) => (
                                <div className="mall-shipping-line-item" key={line.id}>
                                  <span>{line.title}</span>
                                  <span>{`x${line.quantity}`}</span>
                                  <span>{`¥${line.totalAmountText}`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mall-shipping-form-shell">
                          <div className="mall-admin-order-panel-head">
                            <div className="mall-shipping-card-panel-title">发货处理</div>
                            <span className={`resource-table-chip ${shippingState.chipClassName}`}>{shippingState.chipLabel}</span>
                          </div>

                          <div className="mall-admin-order-status-grid">
                            <div className="mall-admin-order-status-item">
                              <span>当前状态</span>
                              <strong>{shippingState.summary}</strong>
                            </div>
                            <div className="mall-admin-order-status-item">
                              <span>处理摘要</span>
                              <strong>{shippingState.detail}</strong>
                            </div>
                          </div>

                          {shippingState.allowPaymentAction ? (
                            <div className="mall-shipping-action-buttons">
                              <button
                                className="admin-resource-submit"
                                disabled={savingOrderId === item.id}
                                onClick={() => void handleOrderStatusSubmit(item.id, 'PAID')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '标记已支付'}
                              </button>
                              <button
                                className="admin-resource-ghost is-danger"
                                disabled={savingOrderId === item.id}
                                onClick={() => void handleOrderStatusSubmit(item.id, 'CLOSED')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '关闭订单'}
                              </button>
                            </div>
                          ) : null}

                          {shippingState.allowShippingAction ? (
                            <>
                              <div className="mall-shipping-form-grid">
                                <label className="admin-resource-field">
                                  <span>物流公司</span>
                                  <input
                                    onChange={(event) => handleShippingDraftChange(item.id, 'shippingCompany', event.target.value)}
                                    placeholder="例如：顺丰、京东、菜鸟速递"
                                    value={shippingDrafts[item.id]?.shippingCompany || ''}
                                  />
                                </label>
                                <label className="admin-resource-field">
                                  <span>物流单号</span>
                                  <input
                                    onChange={(event) => handleShippingDraftChange(item.id, 'shippingTrackingNo', event.target.value)}
                                    placeholder="请输入快递单号"
                                    value={shippingDrafts[item.id]?.shippingTrackingNo || ''}
                                  />
                                </label>
                                <label className="admin-resource-field mall-shipping-form-field-wide">
                                  <span>发货备注</span>
                                  <input
                                    onChange={(event) => handleShippingDraftChange(item.id, 'shippingRemark', event.target.value)}
                                    placeholder="选填，例如：拆单补发、同城闪送、电话确认"
                                    value={shippingDrafts[item.id]?.shippingRemark || ''}
                                  />
                                </label>
                              </div>

                              <div className="mall-shipping-form-footer">
                                <div className="mall-shipping-form-hint">
                                  {item.shippedAt ? `最近发货 ${formatDateTime(item.shippedAt)}` : '提交后同步物流'}
                                </div>
                                <div className="mall-shipping-action-buttons">
                                  <button
                                    className="admin-resource-submit"
                                    disabled={savingOrderId === item.id}
                                    onClick={() => void handleShipSubmit(item.id)}
                                    type="button"
                                  >
                                    {savingOrderId === item.id ? '处理中...' : item.shippingStatus === 'SHIPPED' ? '更新物流' : '确认发货'}
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </>
                    )
                  })()}
                </article>
              ))}

              {!filteredOrders.length ? (
                <div className="admin-resource-empty">当前筛选条件下没有匹配的订单，可以切换队列或换个关键词再看。</div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
