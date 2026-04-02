import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createJoinOrder,
  getMembershipStatus,
  getPlanetPreview,
  mockPayJoinOrder,
  type JoinOrderResponse,
  type MembershipStatusResponse,
  type PreviewResponse,
} from '../services/planetPreviewService'

const demoUserId = 'usr_buyer_001'

function formatAmount(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return '未开通'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function PlanetPreviewPage() {
  const navigate = useNavigate()
  const { groupId = 'grp_datawhale_001' } = useParams()
  const [preview, setPreview] = useState<PreviewResponse['data'] | null>(null)
  const [membership, setMembership] = useState<MembershipStatusResponse['data']>(null)
  const [joinOrder, setJoinOrder] = useState<JoinOrderResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('已加载预览页')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [previewPayload, membershipPayload] = await Promise.all([
          getPlanetPreview(groupId, demoUserId),
          getMembershipStatus(groupId, demoUserId),
        ])

        if (cancelled) return
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
  }, [groupId])

  async function refreshMembership() {
    const payload = await getMembershipStatus(groupId, demoUserId)
    setMembership(payload.data)
  }

  async function handleJoin() {
    setSubmitting(true)
    setError('')

    try {
      const payload = await createJoinOrder(groupId, demoUserId)
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
      setJoinOrder((current) =>
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
      setMessage(payload.data.idempotent ? '重复支付回调已被幂等处理' : '模拟支付成功，成员资格已开通')
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : '模拟支付失败')
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

  return (
    <div className="planet-preview-shell">
      <header className="planet-preview-topbar">
        <button className="planet-preview-back" onClick={() => navigate('/group_data')}>
          ← 返回星球列表
        </button>
        <div className="planet-preview-topbar-meta">
          <span>调试用户：{preview.user.nickname}</span>
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
            <div className="planet-preview-pill">可预览 · 可加入 · 渠道归因已接通</div>
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

            <div className="planet-preview-action-row">
              <button
                className="planet-preview-join-button"
                onClick={handleJoin}
                disabled={submitting || isJoined}
              >
                {isJoined ? '你已加入该星球' : submitting ? '处理中...' : '立即加入'}
              </button>
              <button
                className="planet-preview-pay-button"
                onClick={handleMockPay}
                disabled={submitting || !joinOrder || isJoined}
              >
                模拟支付成功
              </button>
              <button className="planet-preview-ghost-button" onClick={() => void refreshMembership()}>
                刷新成员状态
              </button>
            </div>

            <div className="planet-preview-status-line">
              <strong>当前状态：</strong>
              <span>{message}</span>
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
              <strong>模拟支付回调</strong>
              <p>支付成功后，订单、支付和成员资格同步切换</p>
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
