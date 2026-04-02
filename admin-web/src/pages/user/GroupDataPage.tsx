import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const createdGroups = [
  {
    id: '28882128518851',
    name: 'ysc的星球',
    days: '创建1天',
  },
]

const joinedGroups = [
  {
    id: '555184444414',
    previewId: 'grp_datawhale_001',
    name: 'Datawhale',
    days: '加入264天',
  },
]

function UserTopbar() {
  const [couponHintVisible, setCouponHintVisible] = useState(false)

  return (
    <header className="zsxq-topbar">
      <div className="zsxq-topbar-brand">
        <div className="zsxq-topbar-logo">○</div>
        <div className="zsxq-topbar-name">知识星球</div>
        <div className="zsxq-topbar-tag">笔记 0</div>
      </div>

      <div className="zsxq-topbar-actions">
        <div className="zsxq-topbar-icon">◔</div>
        <div className="zsxq-topbar-icon">◔</div>
        <div className="zsxq-topbar-avatar" />
        <button
          className="zsxq-topbar-upgrade"
          onClick={() => setCouponHintVisible((currentValue) => !currentValue)}
        >
          可以兑换优惠了吗
        </button>
      </div>

      {couponHintVisible ? (
        <div className="group-data-floating-tip">付费星球创建后，可在管理后台的优惠券页面配置兑换券。</div>
      ) : null}
    </header>
  )
}

export function GroupDataPage() {
  const navigate = useNavigate()

  return (
    <div className="zsxq-page-shell">
      <UserTopbar />

      <main className="group-data-page">
        <div className="group-data-title">
          我创建的星球 <span>(付费星球可生成优惠券)</span>
        </div>

        <div className="group-data-grid">
          {createdGroups.map((group) => (
            <article className="group-data-card" key={group.name}>
              <div className="group-data-badge">◈</div>
              <div className="group-data-cover">
                <div className="group-data-cover-circle" />
                <div className="group-data-cover-mark" />
              </div>
              <div className="group-data-name">{group.name}</div>
              <div className="group-data-meta">{group.days}</div>
              <button className="group-data-entry-button" onClick={() => navigate(`/group/${group.id}`)}>
                进入星球后台 ›
              </button>
            </article>
          ))}
        </div>

        <div className="group-data-title group-data-title-joined">加入的星球</div>

        <div className="group-data-grid">
          {joinedGroups.map((group) => (
            <article className="group-data-card" key={group.name}>
              <div className="group-data-cover">
                <div className="group-data-cover-circle" />
                <div className="group-data-cover-mark" />
              </div>
              <div className="group-data-name">{group.name}</div>
              <div className="group-data-meta">{group.days}</div>
              <button className="group-data-preview-button" onClick={() => navigate(`/preview/${group.previewId}`)}>
                进入加入页预览
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
