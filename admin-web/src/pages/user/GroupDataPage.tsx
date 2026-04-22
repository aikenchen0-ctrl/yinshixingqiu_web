import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logoutCurrentSession } from '../../services/authWebService'
import { getGroupDataSnapshot, type PlanetCardItem } from '../../services/planetWebService'
import { getAdminManageableGroups, type AdminManageableGroupItem } from '../../services/adminGroupService'

function formatGroupAge(createdAt: string) {
  const createdTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdTime)) return '刚刚创建'
  const days = Math.max(1, Math.floor((Date.now() - createdTime) / (24 * 60 * 60 * 1000)))
  return `创建${days}天`
}

function UserTopbar() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logoutCurrentSession()
    navigate('/login', { replace: true })
  }

  return (
    <header className="zsxq-topbar">
      <div className="zsxq-topbar-brand">
        <div className="zsxq-topbar-logo">C</div>
        <div className="zsxq-topbar-name">饮视星球</div>
      </div>

      <div className="zsxq-topbar-actions">
        <button className="zsxq-topbar-link-button" onClick={handleLogout} type="button">
          退出
        </button>
        <button className="zsxq-topbar-upgrade" type="button">
          社群工具
        </button>
      </div>
    </header>
  )
}

type GroupCardData = Pick<PlanetCardItem, 'id' | 'name' | 'createdAt'> & {
  roleLabel?: string
}

function GroupCard({
  group,
  actionLabel,
  onClick,
  highlight,
}: {
  group: GroupCardData
  actionLabel: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <article className="group-data-card">
      {highlight ? <div className="group-data-badge">◈</div> : null}
      <div className="group-data-cover">
        <div className="group-data-cover-circle" />
        <div className="group-data-cover-mark" />
      </div>
      <div className="group-data-name">{group.name}</div>
      <div className="group-data-meta">
        {group.roleLabel ? `${group.roleLabel} · ${formatGroupAge(group.createdAt)}` : formatGroupAge(group.createdAt)}
      </div>
      <button
        className={highlight ? 'group-data-entry-button' : 'group-data-preview-button'}
        onClick={onClick}
        type="button"
      >
        {actionLabel}
      </button>
    </article>
  )
}

export function GroupDataPage() {
  const navigate = useNavigate()
  const [createdGroups, setCreatedGroups] = useState<PlanetCardItem[]>([])
  const [joinedGroups, setJoinedGroups] = useState<PlanetCardItem[]>([])
  const [manageableGroups, setManageableGroups] = useState<AdminManageableGroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [snapshot, manageablePayload] = await Promise.all([getGroupDataSnapshot(), getAdminManageableGroups()])
        if (cancelled) return
        setCreatedGroups(snapshot.createdGroups)
        setJoinedGroups(snapshot.joinedGroups)
        setManageableGroups(manageablePayload.groups || [])
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '加载星球列表失败')
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
  }, [])

  const managedOnlyGroups = manageableGroups.filter(
    (group) => !createdGroups.some((createdGroup) => createdGroup.id === group.id),
  )

  return (
    <div className="zsxq-page-shell">
      <UserTopbar />

      <main className="group-data-page">
        <div className="group-data-title">
          我创建的星球 <span>(付费星球可生成优惠券)</span>
        </div>

        {error ? <div className="group-data-status">{error}</div> : null}
        {loading ? <div className="group-data-status">正在加载后端星球列表...</div> : null}

        <div className="group-data-grid">
          {createdGroups.map((group) => (
            <GroupCard
              actionLabel="进入星球后台 ›"
              group={group}
              highlight
              key={group.id}
              onClick={() => navigate(`/activity/members?groupId=${group.id}`)}
            />
          ))}
        </div>

        {!loading && !createdGroups.length ? (
          <div className="group-data-status">当前账号还没有自己创建的星球。</div>
        ) : null}

        {managedOnlyGroups.length ? (
          <>
            <div className="group-data-title group-data-title-joined">我可管理的星球</div>

            <div className="group-data-grid">
              {managedOnlyGroups.map((group) => (
                <GroupCard
                  actionLabel="进入协作后台 ›"
                  group={group}
                  highlight
                  key={group.id}
                  onClick={() => navigate(`/activity/members?groupId=${group.id}`)}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="group-data-title group-data-title-joined">加入的星球</div>

        <div className="group-data-grid">
          {joinedGroups.map((group) => (
            <GroupCard
              actionLabel="进入加入页预览"
              group={group}
              key={group.id}
              onClick={() => navigate(`/preview/${group.id}`)}
            />
          ))}
        </div>

        {!loading && !joinedGroups.length ? (
          <div className="group-data-status">当前账号还没有加入任何星球，请先去小程序加入。</div>
        ) : null}
      </main>
    </div>
  )
}
