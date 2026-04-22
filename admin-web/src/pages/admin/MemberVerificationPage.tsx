import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { env } from '../../env'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getMemberVerificationOverview,
  getPublicMemberVerificationCheck,
  type MemberVerificationPayload,
  type PublicMemberVerificationCheckPayload,
  type MemberVerificationSampleItem,
} from '../../services/memberVerificationService'

const VERIFY_FIELD_OPTIONS = [
  { value: 'MEMBER_NO', label: '成员编号', placeholder: '例如 1' },
  { value: 'MOBILE', label: '手机号', placeholder: '例如 13800000001' },
  { value: 'WECHAT_NO', label: '微信号', placeholder: '例如 zhangsan_member' },
  { value: 'NICKNAME', label: '昵称', placeholder: '例如 张三' },
] as const

type VerifyFieldValue = (typeof VERIFY_FIELD_OPTIONS)[number]['value']

type SampleQueryItem = {
  verifyType: VerifyFieldValue
  keyword: string
  label: string
}

function formatDate(value: string | undefined) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatPercent(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function getVerifyFieldMeta(value: string): (typeof VERIFY_FIELD_OPTIONS)[number] {
  return VERIFY_FIELD_OPTIONS.find((item) => item.value === value) || VERIFY_FIELD_OPTIONS[0]
}

function buildRequestUrl(apiBaseUrl: string, endpoint: string, groupId: string, verifyType: string, keyword: string) {
  if (!groupId) return ''

  const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, '')
  const query = new URLSearchParams({
    groupId,
    verifyType,
    keyword,
  })

  return `${normalizedBaseUrl}${endpoint}?${query.toString()}`
}

function pickSampleKeyword(item: MemberVerificationSampleItem, verifyType: VerifyFieldValue) {
  if (verifyType === 'MEMBER_NO') {
    return item.memberNo === null ? '' : String(item.memberNo)
  }

  if (verifyType === 'MOBILE') {
    return item.mobile || ''
  }

  if (verifyType === 'WECHAT_NO') {
    return item.wechatNo || ''
  }

  return item.nickname || ''
}

export function MemberVerificationPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [verifyType, setVerifyType] = useState<VerifyFieldValue>('MEMBER_NO')
  const [keywordInput, setKeywordInput] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [error, setError] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [notice, setNotice] = useState('')
  const [data, setData] = useState<MemberVerificationPayload['data'] | null>(null)
  const [publicResult, setPublicResult] = useState<PublicMemberVerificationCheckPayload['data'] | null>(null)

  useEffect(() => {
    if (!groupId) {
      setData(null)
      setPublicResult(null)
      setOverviewLoading(false)
      setKeywordInput('')
      setSubmittedKeyword('')
      setError('')
      setVerifyError('')
      return
    }

    let active = true
    setOverviewLoading(true)
    setError('')
    setVerifyError('')
    setPublicResult(null)
    setSubmittedKeyword('')

    getMemberVerificationOverview(groupId)
      .then((payload) => {
        if (!active) return
        setData(payload.data)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载成员身份验证页面失败')
        setData(null)
      })
      .finally(() => {
        if (active) {
          setOverviewLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      clearTimeout(timer)
    }
  }, [notice])

  const selectedField = useMemo(() => getVerifyFieldMeta(verifyType), [verifyType])

  const sampleQueries = useMemo<SampleQueryItem[]>(() => {
    const sampleMembers = data?.sampleMembers || []
    if (!sampleMembers.length) {
      return []
    }

    const nextQueries: SampleQueryItem[] = []
    const seen = new Set<string>()

    function addQuery(type: VerifyFieldValue, keyword: string, label: string) {
      const normalizedKeyword = keyword.trim()
      if (!normalizedKeyword) return

      const key = `${type}:${normalizedKeyword}`
      if (seen.has(key)) return
      seen.add(key)
      nextQueries.push({
        verifyType: type,
        keyword: normalizedKeyword,
        label,
      })
    }

    const memberNoSample = sampleMembers.find((item) => item.memberNo !== null)
    if (memberNoSample && memberNoSample.memberNo !== null) {
      addQuery('MEMBER_NO', String(memberNoSample.memberNo), `编号 ${memberNoSample.memberNo}`)
    }

    const mobileSample = sampleMembers.find((item) => item.mobile)
    if (mobileSample?.mobile) {
      addQuery('MOBILE', mobileSample.mobile, `手机号 ${mobileSample.mobile}`)
    }

    const wechatSample = sampleMembers.find((item) => item.wechatNo)
    if (wechatSample?.wechatNo) {
      addQuery('WECHAT_NO', wechatSample.wechatNo, `微信号 ${wechatSample.wechatNo}`)
    }

    const nicknameSample = sampleMembers.find((item) => item.nickname)
    if (nicknameSample?.nickname) {
      addQuery('NICKNAME', nicknameSample.nickname, `昵称 ${nicknameSample.nickname}`)
    }

    return nextQueries
  }, [data?.sampleMembers])

  const effectiveKeyword = useMemo(() => {
    if (submittedKeyword) {
      return submittedKeyword
    }

    const typedKeyword = keywordInput.trim()
    if (typedKeyword) {
      return typedKeyword
    }

    const defaultMemberNo = data?.sampleMembers.find((item) => item.memberNo !== null)?.memberNo
    return defaultMemberNo === null || defaultMemberNo === undefined ? '1' : String(defaultMemberNo)
  }, [data?.sampleMembers, keywordInput, submittedKeyword])

  const requestUrl = useMemo(
    () => buildRequestUrl(env.apiBaseUrl, data?.docs.endpoint || '/api/member-verification/check', groupId || '', verifyType, effectiveKeyword),
    [data?.docs.endpoint, effectiveKeyword, groupId, verifyType],
  )

  const curlExample = useMemo(() => (requestUrl ? `curl "${requestUrl}"` : ''), [requestUrl])

  const responsePreview = useMemo(() => {
    if (publicResult) {
      return JSON.stringify({ ok: true, data: publicResult }, null, 2)
    }

    return JSON.stringify(
      {
        ok: true,
        data: {
          groupId: groupId || '',
          groupName: data?.group.name || currentGroup?.name || '',
          verifyType,
          keyword: effectiveKeyword,
          matched: false,
          member: null,
          message: '请输入校验关键词后再调用公开接口',
        },
      },
      null,
      2,
    )
  }, [currentGroup?.name, data?.group.name, effectiveKeyword, groupId, publicResult, verifyType])

  async function handleCopy(value: string, successMessage: string) {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setNotice(successMessage)
    } catch {
      setNotice('复制失败，请手动复制当前内容')
    }
  }

  async function handleVerify(nextType: VerifyFieldValue = verifyType, nextKeywordInput = keywordInput) {
    if (!groupId) {
      return
    }

    const normalizedKeyword = nextKeywordInput.trim()
    if (!normalizedKeyword) {
      setVerifyError(`请输入${getVerifyFieldMeta(nextType).label}`)
      setPublicResult(null)
      setSubmittedKeyword('')
      return
    }

    setVerifyLoading(true)
    setVerifyError('')

    try {
      const payload = await getPublicMemberVerificationCheck(groupId, nextType, normalizedKeyword)
      setVerifyType(nextType)
      setKeywordInput(normalizedKeyword)
      setSubmittedKeyword(normalizedKeyword)
      setPublicResult(payload.data)
    } catch (requestError) {
      setPublicResult(null)
      setSubmittedKeyword(normalizedKeyword)
      setVerifyError(requestError instanceof Error ? requestError.message : '调用公开验证接口失败')
    } finally {
      setVerifyLoading(false)
    }
  }

  function handleVerifyTypeChange(nextType: VerifyFieldValue) {
    setVerifyType(nextType)
    setVerifyError('')
    setPublicResult(null)
    setSubmittedKeyword('')
  }

  function applySampleQuery(sample: SampleQueryItem) {
    setVerifyType(sample.verifyType)
    setKeywordInput(sample.keyword)
    void handleVerify(sample.verifyType, sample.keyword)
  }

  const hasDataMismatch =
    typeof data?.summary.snapshotCount === 'number' &&
    typeof data?.summary.totalCount === 'number' &&
    data.summary.snapshotCount !== data.summary.totalCount

  return (
    <AdminLayout
      title="成员身份验证"
      subtitle="把成员身份校验做成后台可测试、可对接的真实能力，这一页直接联调真实公开接口，而不是只看后台聚合结果。"
      tag="运营工具"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="admin-resource-page member-verification-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <section className="admin-resource-panel resource-group-strip">
              <div>
                <div className="resource-group-name">{data?.group.name || currentGroup?.name || groupId}</div>
                <div className="resource-group-meta">
                  <span>星主：{data?.group.ownerName || currentGroup?.ownerName || '-'}</span>
                  <span>groupId：{groupId}</span>
                  <span>开放能力：成员身份验证</span>
                </div>
              </div>
              <div className="resource-group-status">公开联调接口</div>
            </section>

            <section className="admin-resource-panel">
              <div className="resource-overview-grid">
                <article className="resource-overview-card">
                  <div className="resource-overview-label">实际成员总数</div>
                  <div className="resource-overview-value">{data?.summary.totalCount ?? '-'}</div>
                  <div className="resource-overview-hint">按当前数据库成员记录实时统计</div>
                </article>
                <article className="resource-overview-card">
                  <div className="resource-overview-label">有效成员</div>
                  <div className="resource-overview-value">{data?.summary.activeCount ?? '-'}</div>
                  <div className="resource-overview-hint">适合联名活动或权益验真的优先人群</div>
                </article>
                <article className="resource-overview-card">
                  <div className="resource-overview-label">付费成员</div>
                  <div className="resource-overview-value">{data?.summary.paidCount ?? '-'}</div>
                  <div className="resource-overview-hint">可直接验证付费权益相关场景</div>
                </article>
                <article className="resource-overview-card">
                  <div className="resource-overview-label">有效成员占比</div>
                  <div className="resource-overview-value">{formatPercent(data?.summary.activeRate)}</div>
                  <div className="resource-overview-hint">
                    {hasDataMismatch
                      ? `group.memberCount 记录为 ${data?.summary.snapshotCount ?? '-'}，与实时成员数不一致`
                      : `group.memberCount 已与实时成员数对齐：${data?.summary.snapshotCount ?? '-'} 人`}
                  </div>
                </article>
              </div>

              <div className="member-verification-status-grid">
                {(data?.summary.statusBuckets || []).map((item) => (
                  <article className="member-verification-status-card" key={item.status}>
                    <div className="member-verification-status-label">{item.label}</div>
                    <div className="member-verification-status-value">{item.count}</div>
                    <div className="member-verification-status-key">{item.status}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-resource-panel">
              <div className="resource-section-header">
                <div>
                  <div className="resource-section-title">立即校验</div>
                  <div className="resource-section-subtitle">这里调用的是公开接口 `/api/member-verification/check`，可直接模拟联名活动页或外部工具的实际接入方式。</div>
                </div>
              </div>

              <div className="resource-filter-grid">
                <label className="admin-resource-field">
                  <span>校验字段</span>
                  <select onChange={(event) => handleVerifyTypeChange(event.target.value as VerifyFieldValue)} value={verifyType}>
                    {VERIFY_FIELD_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-resource-field admin-resource-field-search">
                  <span>校验关键词</span>
                  <input
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleVerify()
                      }
                    }}
                    placeholder={selectedField.placeholder}
                    value={keywordInput}
                  />
                </label>
                <button className="admin-resource-submit" disabled={verifyLoading || overviewLoading} onClick={() => void handleVerify()} type="button">
                  {verifyLoading ? '校验中...' : '立即校验'}
                </button>
              </div>

              {sampleQueries.length ? (
                <div className="member-verification-quick-list">
                  {sampleQueries.map((item) => (
                    <button className="admin-resource-ghost" key={`${item.verifyType}:${item.keyword}`} onClick={() => applySampleQuery(item)} type="button">
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {verifyError ? <div className="admin-inline-error member-verification-inline-error">{verifyError}</div> : null}

              {publicResult ? (
                <div className={`member-verification-result${publicResult.matched ? ' is-success' : ' is-empty'}`}>
                  <div className="member-verification-result-header">
                    <div>
                      <div className="member-verification-result-title">{publicResult.message}</div>
                      <div className="member-verification-result-subtitle">
                        {`本次请求：${getVerifyFieldMeta(publicResult.verifyType).label} / ${publicResult.keyword}`}
                      </div>
                    </div>
                    <span className={`resource-table-chip${publicResult.matched ? ' is-success' : ' is-muted'}`}>
                      {publicResult.matched ? '已命中成员' : '未命中成员'}
                    </span>
                  </div>

                  {publicResult.member ? (
                    <div className="member-verification-result-grid">
                      <div>{`成员：${publicResult.member.nickname || '-'}`}</div>
                      <div>{`成员编号：${publicResult.member.memberNo ?? '-'}`}</div>
                      <div>{`状态：${publicResult.member.statusLabel || '-'}`}</div>
                      <div>{`付费：${publicResult.member.isPaid ? '是' : '否'}`}</div>
                      <div>{`到期时间：${formatDate(publicResult.member.expireAt)}`}</div>
                      <div>{`加入时间：${formatDate(publicResult.member.joinedAt)}`}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="member-verification-result">
                  <div className="member-verification-result-title">还没有发起公开校验</div>
                  <div className="member-verification-result-subtitle">可以直接输入关键词，或者点击上面的样例按钮一键联调。</div>
                </div>
              )}
            </section>

            <section className="admin-resource-panel">
              <div className="resource-section-header">
                <div>
                  <div className="resource-section-title">接口说明</div>
                  <div className="resource-section-subtitle">先把调用方式、请求地址和返回 JSON 固定下来，后续接活动页或外部工具时可以直接复用。</div>
                </div>
              </div>

              <div className="member-verification-docs">
                <div className="member-verification-doc-row">
                  <span>接口地址</span>
                  <strong>{data?.docs.endpoint || '/api/member-verification/check'}</strong>
                </div>
                <div className="member-verification-doc-row">
                  <span>请求方式 / 登录要求</span>
                  <strong>{`${data?.docs.method || 'GET'} / ${data?.docs.requiresLogin ? '需要登录' : '公开免登录'}`}</strong>
                </div>
                <div className="member-verification-doc-row">
                  <span>支持字段</span>
                  <strong>{data?.docs.supportedFields.join(', ') || '-'}</strong>
                </div>

                <div className="member-verification-doc-actions">
                  <button className="admin-resource-ghost" onClick={() => void handleCopy(requestUrl, '请求地址已复制')} type="button">
                    复制请求 URL
                  </button>
                  <button className="admin-resource-ghost" onClick={() => void handleCopy(curlExample, 'cURL 已复制')} type="button">
                    复制 cURL
                  </button>
                </div>

                <div className="member-verification-doc-block">
                  <div className="member-verification-doc-label">请求地址</div>
                  <pre className="member-verification-doc-code">{requestUrl || '-'}</pre>
                </div>

                <div className="member-verification-doc-block">
                  <div className="member-verification-doc-label">响应示例</div>
                  <pre className="member-verification-doc-code">{responsePreview}</pre>
                </div>
              </div>
            </section>

            <section className="admin-resource-panel">
              <div className="resource-section-header">
                <div>
                  <div className="resource-section-title">样例成员</div>
                  <div className="resource-section-subtitle">这批样本可以直接带入编号、手机号、微信号或昵称做联调验证。</div>
                </div>
              </div>

              <div className="resource-table">
                <div className="resource-table-row resource-table-head member-verification-table-row">
                  <span>成员编号</span>
                  <span>成员信息</span>
                  <span>手机号</span>
                  <span>微信号</span>
                  <span>状态</span>
                  <span>到期时间</span>
                  <span>快捷联调</span>
                </div>

                {data?.sampleMembers.length ? (
                  data.sampleMembers.map((item) => (
                    <div className="resource-table-row member-verification-table-row" key={item.id}>
                      <span>{item.memberNo ?? '-'}</span>
                      <span className="resource-table-strong">
                        <span>{item.nickname}</span>
                        <em>{`${item.isPaid ? '付费成员' : '非付费成员'} · ${formatDate(item.joinedAt)} 加入`}</em>
                      </span>
                      <span>{item.mobile || '-'}</span>
                      <span>{item.wechatNo || '-'}</span>
                      <span>{item.statusLabel}</span>
                      <span>{formatDate(item.expireAt)}</span>
                      <span className="member-verification-row-actions">
                        <button
                          className="admin-resource-ghost"
                          disabled={item.memberNo === null}
                          onClick={() => void handleVerify('MEMBER_NO', pickSampleKeyword(item, 'MEMBER_NO'))}
                          type="button"
                        >
                          按编号
                        </button>
                        <button
                          className="admin-resource-ghost"
                          disabled={!item.mobile}
                          onClick={() => void handleVerify('MOBILE', pickSampleKeyword(item, 'MOBILE'))}
                          type="button"
                        >
                          按手机
                        </button>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="admin-resource-empty">暂无样例成员。</div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
