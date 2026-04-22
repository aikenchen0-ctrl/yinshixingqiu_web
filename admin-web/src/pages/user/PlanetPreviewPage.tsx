import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createJoinOrder,
  fetchJoinChannels,
  fetchJoinCoupons,
  getMembershipStatus,
  getPlanetPreview,
  mockPayJoinOrder,
  reapplyJoinReview,
  type JoinChannelListResponse,
  type JoinCouponListResponse,
  type JoinOrderResponse,
  type MembershipStatusResponse,
  type PreviewResponse,
} from '../../services/planetPreviewService'

const DEMO_USER_OPTIONS = [
  { id: 'usr_buyer_001', label: '普通购买者', hint: '标准未加入用户' },
  { id: 'usr_review_pending_001', label: '审核中用户', hint: '已支付待审核' },
  { id: 'usr_review_rejected_001', label: '已驳回用户', hint: '可验证重提审核' },
  { id: 'usr_review_member_001', label: '已加入成员', hint: '有效成员样本' },
] as const

function formatAmount(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return '未开通'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function PlanetPreviewPage() {
  const navigate = useNavigate()
  const { groupId = '' } = useParams()
  const searchParams = new URLSearchParams(window.location.search)
  const requestedUserId = searchParams.get('userId') || ''
  const requestedCouponCode = searchParams.get('couponCode') || ''
  const requestedChannelCode = searchParams.get('channelCode') || ''
  const [preview, setPreview] = useState<PreviewResponse['data'] | null>(null)
  const [membership, setMembership] = useState<MembershipStatusResponse['data']>(null)
  const [joinOrder, setJoinOrder] = useState<JoinOrderResponse['data'] | null>(null)
  const [coupons, setCoupons] = useState<JoinCouponListResponse['data']['items']>([])
  const [channels, setChannels] = useState<JoinChannelListResponse['data']['items']>([])
  const [selectedCouponCode, setSelectedCouponCode] = useState('')
  const [selectedChannelCode, setSelectedChannelCode] = useState('')
  const [selectedDemoUserId, setSelectedDemoUserId] = useState<string>(
    DEMO_USER_OPTIONS.some((item) => item.id === requestedUserId) ? requestedUserId : DEMO_USER_OPTIONS[0].id,
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('已加载预览页')
  const [error, setError] = useState('')

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(window.location.search)

    if (selectedDemoUserId) {
      nextSearchParams.set('userId', selectedDemoUserId)
    } else {
      nextSearchParams.delete('userId')
    }

    if (selectedCouponCode) {
      nextSearchParams.set('couponCode', selectedCouponCode)
    } else {
      nextSearchParams.delete('couponCode')
    }

    if (selectedChannelCode) {
      nextSearchParams.set('channelCode', selectedChannelCode)
    } else {
      nextSearchParams.delete('channelCode')
    }

    const nextSearch = nextSearchParams.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [selectedChannelCode, selectedCouponCode, selectedDemoUserId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!groupId) {
        setError('缺少星球ID')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      setJoinOrder(null)

      try {
        const [couponPayload, channelPayload, membershipPayload] = await Promise.all([
          fetchJoinCoupons(groupId),
          fetchJoinChannels(groupId),
          getMembershipStatus(groupId, selectedDemoUserId),
        ])

        const nextCoupons = Array.isArray(couponPayload.data.items) ? couponPayload.data.items : []
        const nextChannels = Array.isArray(channelPayload.data.items) ? channelPayload.data.items : []
        const recommendedCouponCode =
          (requestedCouponCode && nextCoupons.some((item) => item.code === requestedCouponCode) ? requestedCouponCode : '') ||
          nextCoupons.find((item) => item.isRecommended)?.code ||
          (nextCoupons.length ? nextCoupons[0].code : '')
        const defaultChannelCode =
          (requestedChannelCode && nextChannels.some((item) => item.code === requestedChannelCode) ? requestedChannelCode : '') ||
          (nextChannels.length ? nextChannels[0].code : '')
        const previewPayload = await getPlanetPreview(groupId, selectedDemoUserId, {
          couponCode: recommendedCouponCode,
          channelCode: defaultChannelCode,
        })

        if (cancelled) return
        setCoupons(nextCoupons)
        setChannels(nextChannels)
        setSelectedCouponCode(recommendedCouponCode)
        setSelectedChannelCode(defaultChannelCode)
        setPreview(previewPayload.data)
        setMembership(membershipPayload.data)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载失败')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [groupId, requestedChannelCode, requestedCouponCode, selectedDemoUserId])

  async function refreshMembership() {
    if (!groupId) return
    const payload = await getMembershipStatus(groupId, selectedDemoUserId)
    setMembership(payload.data)
  }

  async function refreshPreview(couponCode = selectedCouponCode) {
    if (!groupId) return
    const payload = await getPlanetPreview(groupId, selectedDemoUserId, {
      couponCode,
      channelCode: selectedChannelCode,
    })
    setPreview(payload.data)
  }

  async function handleJoin() {
    if (!groupId) return
    setSubmitting(true)
    setError('')

    try {
      if (membership?.status === 'REJECTED') {
        const payload = await reapplyJoinReview(groupId, selectedDemoUserId)
        setJoinOrder({
          order: payload.data.order,
          payment: payload.data.payment,
        })
        await refreshMembership()
        setMessage(payload.data.idempotent ? '当前申请已在审核中' : '已重新提交审核，无需再次支付')
        return
      }

      const payload = await createJoinOrder(groupId, selectedDemoUserId, {
        couponCode: selectedCouponCode,
        channelCode: selectedChannelCode,
      })
      setJoinOrder(payload.data)
      setMessage(`已创建加入订单 ${payload.data.order.orderNo}`)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : '创建订单失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMockPay() {
    if (!joinOrder) return

    setSubmitting(true)
    setError('')

    try {
      const payload = await mockPayJoinOrder(joinOrder.order.orderNo)
      setJoinOrder((current: JoinOrderResponse['data'] | null) =>
        current
          ? {
              ...current,
              order: {
                ...current.order,
                status: payload.data.order.status,
              },
              payment: {
                ...current.payment,
                status: payload.data.payment.status,
              },
            }
          : current,
      )
      await refreshMembership()
      setMessage(
        payload.data.idempotent
          ? '重复支付回调已被幂等处理'
          : payload.data.membership?.status === 'PENDING'
            ? '测试支付回调成功，当前申请正在等待管理员审核'
            : '测试支付回调成功，成员资格已开通',
      )
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : '测试支付回调失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCouponChange(couponCode: string) {
    setSelectedCouponCode(couponCode)
    setSubmitting(true)
    setError('')

    try {
      await refreshPreview(couponCode)
      setJoinOrder(null)
      setMessage(couponCode ? '已切换优惠券预览' : '已切换为原价预览')
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '刷新预览失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChannelChange(channelCode: string) {
    setSelectedChannelCode(channelCode)
    setSubmitting(true)
    setError('')

    try {
      if (!groupId) return
      const payload = await getPlanetPreview(groupId, selectedDemoUserId, {
        couponCode: selectedCouponCode,
        channelCode,
      })
      setPreview(payload.data)
      setJoinOrder(null)
      setMessage(channelCode ? '已切换渠道归因预览' : '已切换为默认直达预览')
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '切换渠道失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="planet-preview-loading">正在加载预览页...</div>
  }

  if (!preview) {
    return <div className="planet-preview-loading">未找到预览页数据</div>
  }

  const isJoined = Boolean(membership?.isActive)
  const isPendingReview = membership?.status === 'PENDING'
  const isRejected = membership?.status === 'REJECTED'
  const selectedChannel = channels.find((item) => item.code === selectedChannelCode) || null

  return (
    <div className="planet-preview-shell">
      <header className="planet-preview-topbar">
        <button className="planet-preview-back" onClick={() => navigate('/group_data')}>
          ← 返回星球列表
        </button>
        <div className="planet-preview-topbar-meta">
          <span>联调用户：{preview.user.nickname}</span>
          <span>渠道：{preview.channel?.name ?? '默认直达'}</span>
        </div>
      </header>

      <main className="planet-preview-main">
        <section className="planet-preview-hero">
          <div className="planet-preview-cover">
            <div className="planet-preview-cover-art" />
            <div className="planet-preview-cover-badge">付费星球</div>
          </div>

          <div className="planet-preview-summary">
            <div className="planet-preview-pill">可预览 · 可加入 · 支付联调已接通</div>
            <h1>{preview.group.name}</h1>
            <p>{preview.group.intro}</p>

            <div className="planet-preview-price-card">
              <div className="planet-preview-price-main">
                <span className="planet-preview-price-current">
                  {formatAmount(preview.pricing.payableAmount)}
                </span>
                <span className="planet-preview-price-origin">
                  原价 {formatAmount(preview.pricing.originalAmount)}
                </span>
              </div>
              <div className="planet-preview-price-meta">
                有效期 {preview.pricing.durationDays} 天
                {preview.coupon ? ` · 已命中新人券「${preview.coupon.name}」` : ''}
              </div>
            </div>

            <div className="planet-preview-selector-row">
              <label className="planet-preview-selector">
                <span>联调用户</span>
                <select disabled={submitting} onChange={(event) => setSelectedDemoUserId(event.target.value)} value={selectedDemoUserId}>
                  {DEMO_USER_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${item.label} · ${item.hint}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="planet-preview-selector-row">
              <label className="planet-preview-selector">
                <span>预览优惠券</span>
                <select disabled={submitting} onChange={(event) => void handleCouponChange(event.target.value)} value={selectedCouponCode}>
                  <option value="">不使用优惠券</option>
                  {coupons.map((item) => (
                    <option key={item.code} value={item.code}>
                      {`${item.name} · ${item.amountText}${item.remainingQuantity !== null ? ` · 剩余 ${item.remainingQuantity}` : ''}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="planet-preview-selector-row">
              <label className="planet-preview-selector">
                <span>联调渠道</span>
                <select disabled={submitting} onChange={(event) => void handleChannelChange(event.target.value)} value={selectedChannelCode}>
                  <option value="">默认直达</option>
                  {channels.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="planet-preview-channel-card">
              <div className="planet-preview-channel-copy">
                <strong>{preview.channel ? preview.channel.name : '默认直达'}</strong>
                <span>{preview.channel ? `渠道码 ${preview.channel.code}` : '当前未命中渠道归因，按默认直达处理'}</span>
              </div>
              {selectedChannel && selectedChannel.qrCodeUrl ? (
                <img alt={selectedChannel.name} className="planet-preview-channel-qr" src={selectedChannel.qrCodeUrl} />
              ) : (
                <div className="planet-preview-channel-qr planet-preview-channel-qr-empty">未配置二维码</div>
              )}
            </div>

            <div className="planet-preview-action-row">
              <button
                className="planet-preview-join-button"
                onClick={handleJoin}
                disabled={submitting || isJoined || isPendingReview}
              >
                {isJoined ? '你已加入该星球' : isPendingReview ? '审核中' : isRejected ? '重新提交审核' : submitting ? '处理中...' : '立即加入'}
              </button>
              <button className="planet-preview-ghost-button" onClick={() => void refreshMembership()}>
                刷新成员状态
              </button>
            </div>

            <div className="planet-preview-status-line">
              <strong>当前状态：</strong>
              <span>{message}</span>
            </div>
            <div className="planet-preview-toolbox">
              <div className="planet-preview-toolbox-copy">
                <strong>测试工具</strong>
                <span>仅用于当前测试环境联调支付回调，不属于真实用户页面主操作。</span>
              </div>
              <button
                className="planet-preview-pay-button"
                onClick={handleMockPay}
                disabled={submitting || !joinOrder || isJoined || isPendingReview || isRejected}
              >
                触发测试支付回调
              </button>
            </div>
            {error ? <div className="planet-preview-error">{error}</div> : null}
          </div>
        </section>

        <section className="planet-preview-grid">
          <article className="planet-preview-panel">
            <h2>你加入后能获得什么</h2>
            <ul className="planet-preview-feature-list">
              <li>查看精华主题、文件资料、历史讨论</li>
              <li>参与问答、打卡和作业互动</li>
              <li>获得成员身份与有效期管理</li>
              <li>被后台统计进收入、漏斗和渠道数据</li>
            </ul>
          </article>

          <article className="planet-preview-panel is-highlight">
            <h2>实时状态</h2>
            <div className="planet-preview-status-item">
              <span>成员资格</span>
              <strong className={isJoined ? 'is-success' : ''}>
                {membership?.status ?? 'NOT_JOINED'}
              </strong>
            </div>
            <div className="planet-preview-status-item">
              <span>审核备注</span>
              <strong>{membership?.reviewReason || (isPendingReview ? '等待管理员处理' : '无')}</strong>
            </div>
            <div className="planet-preview-status-item">
              <span>到期时间</span>
              <strong>{formatDate(membership?.expireAt)}</strong>
            </div>
            <div className="planet-preview-status-item">
              <span>订单号</span>
              <strong>{joinOrder?.order.orderNo ?? '尚未创建'}</strong>
            </div>
            <div className="planet-preview-status-item">
              <span>订单状态</span>
              <strong>{joinOrder?.order.status ?? 'NONE'}</strong>
            </div>
            <div className="planet-preview-status-item">
              <span>支付状态</span>
              <strong>{joinOrder?.payment.status ?? 'NONE'}</strong>
            </div>
          </article>
        </section>

        <section className="planet-preview-flow">
          <h2>这页正在验证的系统链路</h2>
          <div className="planet-preview-flow-steps">
            <div className="planet-preview-step">
              <span>01</span>
              <strong>预览页加载</strong>
              <p>星球、价格、优惠券、渠道信息一起返回</p>
            </div>
            <div className="planet-preview-step">
              <span>02</span>
              <strong>创建加入订单</strong>
              <p>点击加入后，后端生成订单和待支付记录</p>
            </div>
            <div className="planet-preview-step">
              <span>03</span>
              <strong>测试支付回调</strong>
              <p>触发一次测试支付成功回调，校验订单、支付和成员资格同步切换</p>
            </div>
            <div className="planet-preview-step">
              <span>04</span>
              <strong>进入星球</strong>
              <p>成员状态变为 ACTIVE 后即可进入内容页</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
