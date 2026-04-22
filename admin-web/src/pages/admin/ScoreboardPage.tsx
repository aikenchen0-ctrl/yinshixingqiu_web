import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getAdminScoreboard,
  updateAdminScoreboard,
  type AdminScoreboardMemberItem,
  type AdminScoreboardPayload,
} from '../../services/adminScoreboardService'

const TEMPLATE_ITEMS = [
  { key: 'first', title: '模板一', description: '默认榜单样式' },
  { key: 'second', title: '模板二', description: '暖色海报样式' },
  { key: 'third', title: '模板三', description: '轻量卡片样式' },
  { key: 'fourth', title: '模板四', description: '排行榜分享样式' },
] as const

type PosterTemplateKey = (typeof TEMPLATE_ITEMS)[number]['key']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateOnly(value: string) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10).replace(/-/g, '/')
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

function formatLocalDateOnly(value: Date) {
  return `${value.getFullYear()}/${pad(value.getMonth() + 1)}/${pad(value.getDate())}`
}

function buildRuleDrafts(rules: AdminScoreboardPayload['data']['rules']) {
  return Object.fromEntries(rules.map((rule) => [rule.eventType, String(rule.score)]))
}

function normalizeRuleScore(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) {
    return null
  }

  const rounded = Math.round(numeric * 10) / 10
  if (rounded < 0 || rounded > 10) {
    return null
  }

  return Number(rounded.toFixed(1))
}

function buildRulesUpdatePayload(
  rules: AdminScoreboardPayload['data']['rules'],
  ruleDrafts: Record<string, string>,
): { ok: true; items: Array<{ eventType: string; score: number }> } | { ok: false; error: string } {
  const items: Array<{ eventType: string; score: number }> = []

  for (const rule of rules) {
    const score = normalizeRuleScore(ruleDrafts[rule.eventType] ?? '')
    if (score === null) {
      return {
        ok: false,
        error: `${rule.label} 积分需填写 0.0-10.0 之间的数值`,
      }
    }

    items.push({
      eventType: rule.eventType,
      score,
    })
  }

  return {
    ok: true,
    items,
  }
}

function buildPeriodLabel(value: number) {
  return value === 7 ? '本周' : `近 ${value} 天`
}

function buildPosterTitle(value: number) {
  return `${buildPeriodLabel(value)}积分排行榜`
}

function buildScoreLabel(value: number) {
  return value === 7 ? '本周积分' : '积分'
}

function buildRankingEmptyLabel(value: number) {
  return value === 7 ? '本周暂无成员上榜' : '当前暂无成员上榜'
}

function buildPosterEmptyLabel(value: number) {
  return value === 7 ? '本周无成员上榜' : '本期无成员上榜'
}

function buildInitial(name: string) {
  return (name || '星').trim().slice(0, 1).toUpperCase()
}

function MemberAvatar({ member }: { member: AdminScoreboardMemberItem }) {
  if (member.avatarUrl) {
    return <img alt={member.nickname} src={member.avatarUrl} />
  }

  return <span className="resource-avatar">{buildInitial(member.nickname)}</span>
}

export function ScoreboardPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const isToolEntry = location.pathname.startsWith('/tools/')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<AdminScoreboardPayload['data'] | null>(null)
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, string>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<PosterTemplateKey>('fourth')
  const [posterOpen, setPosterOpen] = useState(false)

  useEffect(() => {
    setError('')
    setActionNotice('')
    setSaving(false)
    setSelectedTemplate('fourth')
    setPosterOpen(false)
  }, [groupId, location.pathname])

  useEffect(() => {
    if (!groupId) {
      setData(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getAdminScoreboard({
      groupId,
      memberStatus: 'ACTIVE',
      rangeDays: 7,
      page: 1,
      pageSize: 50,
    })
      .then((payload) => {
        if (!active) return
        setData(payload.data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载成员积分榜失败')
        setData(null)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId])

  useEffect(() => {
    if (!actionNotice) {
      return
    }

    const timer = window.setTimeout(() => {
      setActionNotice('')
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [actionNotice])

  useEffect(() => {
    if (!posterOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPosterOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [posterOpen])

  useEffect(() => {
    if (!data) {
      setRuleDrafts({})
      return
    }

    setRuleDrafts(buildRuleDrafts(data.rules))
  }, [data])

  const members = data?.items || []
  const topMembers = useMemo(() => members.slice(0, 20), [members])
  const posterMembers = useMemo(() => members.slice(0, 10), [members])
  const groupName = data?.group.name || currentGroup?.name || groupId || '未分配星球'
  const rangeDays = data?.filters.rangeDays || 7
  const rangeLabel = buildPeriodLabel(rangeDays)
  const posterTitle = buildPosterTitle(rangeDays)
  const scoreLabel = buildScoreLabel(rangeDays)
  const rankingEmptyLabel = buildRankingEmptyLabel(rangeDays)
  const posterEmptyLabel = buildPosterEmptyLabel(rangeDays)
  const rulesUpdatedAt = data?.settings.rulesUpdatedAt ? formatDateOnly(data.settings.rulesUpdatedAt) : '未记录'
  const selectedTemplateMeta = TEMPLATE_ITEMS.find((item) => item.key === selectedTemplate) || TEMPLATE_ITEMS[3]
  const posterDateLabel = formatLocalDateOnly(new Date())

  function handleRuleDraftChange(eventType: string, value: string) {
    setRuleDrafts((current) => ({
      ...current,
      [eventType]: value,
    }))
  }

  async function handleSaveRules() {
    if (!data || !groupId || saving) {
      return
    }

    const nextPayload = buildRulesUpdatePayload(data.rules, ruleDrafts)
    if (!nextPayload.ok) {
      setActionNotice(nextPayload.error)
      return
    }

    setSaving(true)
    try {
      const payload = await updateAdminScoreboard({
        groupId,
        rules: nextPayload.items,
      })
      setData(payload.data)
      setRuleDrafts(buildRuleDrafts(payload.data.rules))
      setActionNotice('积分规则已保存')
    } catch (requestError) {
      setActionNotice(requestError instanceof Error ? requestError.message : '保存积分规则失败')
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadPoster() {
    setActionNotice('当前版本还没有接入海报下载能力，当前可直接预览开启态海报。')
  }

  return (
    <AdminLayout
      title="成员积分榜"
      subtitle="为不同的成员行为设置积分，以激励成员活跃。积分设置范围：0.0-10.0，建议以「点赞主题/评论」的积分作为参照来设置其它行为所得的积分。"
      tag={isToolEntry ? '运营工具' : '用户活跃'}
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="scoreboard-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <div className="scoreboard-page-group-name">{groupName}</div>

            {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}

            {!loading && data ? (
              <div className="scoreboard-container opened">
                <section className="content">
                  <div className="header">
                    <div>
                      <div className="resource-section-title">积分规则</div>
                      <div className="resource-section-subtitle">
                        {`当前统计范围：${rangeLabel}，规则更新时间：${rulesUpdatedAt}`}
                      </div>
                    </div>
                    <div className="scoreboard-content-summary">
                      <span>{`有效成员 ${data.summary.trackedMembers}`}</span>
                      <span>{`有积分成员 ${data.summary.scoredMembers}`}</span>
                      <span>{`榜首 ${data.summary.topMemberName || '-'}`}</span>
                    </div>
                  </div>

                  <div className="container">
                    <div className="scoreboard-form-shell">
                      <div className="left-header">
                        <span>积分行为配置</span>
                      </div>

                      <div className="form">
                        <div className="form-header">
                          <span>成员行为</span>
                          <span>积分</span>
                        </div>

                        <ul className="form-content">
                          {data.rules.map((rule) => (
                            <li key={rule.eventType}>
                              <span className="form-name">{rule.label}</span>
                              <input
                                max="10"
                                min="0"
                                onChange={(event) => handleRuleDraftChange(rule.eventType, event.target.value)}
                                step="0.1"
                                type="number"
                                value={ruleDrafts[rule.eventType] ?? ''}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button className="form-submit" disabled={saving} onClick={handleSaveRules} type="button">
                        {saving ? '保存中...' : '保存'}
                      </button>
                    </div>

                    <aside className="ranking">
                      <div className={`ranking-header is-${selectedTemplateMeta.key}`}>
                        <div className="left">
                          <div>{posterTitle}</div>
                          <div>{`${groupName} · ${rangeLabel}`}</div>
                        </div>
                        <div className="right">
                          <button onClick={() => setPosterOpen(true)} type="button">
                            预览海报
                          </button>
                          <button className="secondary" onClick={handleDownloadPoster} type="button">
                            下载海报
                          </button>
                        </div>
                      </div>

                      <div className="ranking-content">
                        <div className="title border">
                          <span>排名</span>
                          <span>成员</span>
                          <span>{scoreLabel}</span>
                        </div>

                        <div className="list">
                          {topMembers.length ? (
                            <ul>
                              {topMembers.map((member, index) => (
                                <li className="list-item" key={member.id}>
                                  <span className={`rank${index < 3 ? ' orange' : ''}`}>{member.rank}</span>
                                  <span className="member">
                                    <MemberAvatar member={member} />
                                    <span>{member.nickname}</span>
                                  </span>
                                  <span>{member.totalScore}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="no-data">
                              <i />
                              <div>{rankingEmptyLabel}</div>
                            </div>
                          )}

                          <div className="footer">
                            共 <span className="strong">{data.summary.scoredMembers}</span> 位成员进入{rangeLabel}积分榜
                          </div>
                        </div>
                      </div>
                    </aside>
                  </div>
                </section>
              </div>
            ) : null}

            {actionNotice && !posterOpen ? (
              <div aria-live="polite" className="admin-inline-tip" role="status">
                {actionNotice}
              </div>
            ) : null}

            {!loading && data && posterOpen ? (
              <div className="poster-view" onClick={() => setPosterOpen(false)}>
                <div
                  className="poster-view-shell"
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                >
                  {actionNotice ? (
                    <div aria-live="polite" className="scoreboard-action-notice" role="status">
                      {actionNotice}
                    </div>
                  ) : null}

                  <div className={`poster template-${selectedTemplate}`}>
                    <div className="background" />
                    <div className="info">
                      <div className="group-name">{groupName}</div>
                      <div className="title">{posterTitle}</div>
                    </div>
                    <div className="date">{posterDateLabel}</div>

                    <div className="list">
                      <div className="list-header">
                        <span>排名</span>
                        <span>成员</span>
                        <span>{scoreLabel}</span>
                      </div>

                      <div className="list-main">
                        {posterMembers.length ? (
                          posterMembers.map((member, index) => (
                            <div className="list-item" key={member.id}>
                              <span className={`rank${index < 3 ? ' orange' : ''}`}>{member.rank}</span>
                              <span className="member">
                                <MemberAvatar member={member} />
                                <span>{member.nickname}</span>
                              </span>
                              <span>{member.totalScore}</span>
                            </div>
                          ))
                        ) : (
                          <div className="no-data">
                            <i />
                            <div>{posterEmptyLabel}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="footer">
                      <div>
                        <div className="logo-icon">饮视星球</div>
                        <div>来星球，一起成长~</div>
                      </div>
                      <div className="poster-qrcode-placeholder">二维码</div>
                    </div>
                  </div>

                  <div className="btn">
                    <button className="download" onClick={handleDownloadPoster} type="button">
                      下载
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
