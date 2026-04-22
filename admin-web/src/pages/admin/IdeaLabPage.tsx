import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import { getIdeaLabHotBoard, type IdeaLabBoardSection, type IdeaLabHotBoardPayload } from '../../services/ideaLabService'

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

function getSourceBadge(board: IdeaLabBoardSection) {
  if (board.source === 'WEIBO') return '微'
  if (board.source === 'TOUTIAO') return '头'
  return board.label.slice(0, 1)
}

function getSourceClassName(board: IdeaLabBoardSection) {
  if (board.source === 'WEIBO') return 'is-weibo'
  if (board.source === 'TOUTIAO') return 'is-toutiao'
  return 'is-default'
}

export function IdeaLabPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStatement, setShowStatement] = useState(false)
  const [payload, setPayload] = useState<IdeaLabHotBoardPayload['data'] | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    getIdeaLabHotBoard()
      .then((response) => {
        if (!active) return
        setPayload(response.data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setPayload(null)
        setError(requestError.message || '加载创作灵感失败')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const boardCount = payload?.boards.length || 0
  const itemCount = useMemo(
    () => (payload?.boards || []).reduce((sum, board) => sum + board.items.length, 0),
    [payload?.boards],
  )

  return (
    <AdminLayout
      title="创作灵感"
      subtitle="在热点中，发掘素材与灵感（仅拥有「星球管理后台」访问权限的用户可查看，数据实时更新）。"
      tag="运营工具"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page idea-lab-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {!groupLoading && hasGroups ? (
          <>
            <div className="idea-lab-group-name">{currentGroup?.name || '未分配星球'}</div>

            <section className="idea-lab-headnote">
              <div className="idea-lab-headnote-meta">
                <span>{`热点来源 ${boardCount} 个`}</span>
                <span>{`热点条目 ${itemCount} 条`}</span>
                <span>{`更新时间 ${formatDateTime(payload?.fetchedAt || '')}`}</span>
              </div>

              <div className="idea-lab-headnote-actions">
                <button
                  className={`idea-lab-statement-trigger${showStatement ? ' is-active' : ''}`}
                  onClick={() => setShowStatement((value) => !value)}
                  type="button"
                >
                  声明
                </button>
              </div>

              {showStatement ? <div className="idea-lab-statement-panel">{payload?.statement || '暂无说明。'}</div> : null}
            </section>

            {loading ? <div className="admin-resource-panel admin-resource-empty">正在加载热点榜单...</div> : null}
            {!loading && payload ? (
              <section className="admin-resource-panel idea-lab-hot-board-shell">
                <div className="idea-lab-hot-board-grid">
                  {payload.boards.map((board) => (
                    <article className="idea-lab-hot-board-column" key={board.source}>
                      <div className="idea-lab-hot-board-header">
                        <div className={`idea-lab-hot-board-icon ${getSourceClassName(board)}`}>{getSourceBadge(board)}</div>
                        <div className="idea-lab-hot-board-header-copy">
                          <div className="idea-lab-hot-board-name">{board.label}</div>
                          <div className="idea-lab-hot-board-subtitle">按榜单顺位展示当前热点</div>
                        </div>
                      </div>

                      <div className="idea-lab-hot-board-list">
                        {board.items.map((item) => (
                          <a className="idea-lab-hot-board-item" href={item.url} key={`${board.source}-${item.rank}`} rel="noreferrer" target="_blank">
                            <span className={`idea-lab-hot-board-rank${item.rank <= 3 ? ' is-top' : ''}`}>{item.rank}</span>
                            <span className="idea-lab-hot-board-text">{item.title}</span>
                          </a>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!loading && !payload && !error ? (
              <div className="admin-resource-panel admin-resource-empty">当前还没有可展示的热点榜单。</div>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
