import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  downloadChannelLiveMemberList,
  getChannelLivePageData,
  type ChannelLivePagePayload,
} from '../../services/channelLiveService'

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

function parseExportScope(value: string | null) {
  return value === 'all' ? 'all' : 'valid'
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export function ChannelLivePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const requestedScope = useMemo(() => parseExportScope(new URLSearchParams(location.search).get('scope')), [location.search])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [onlyValidMembers, setOnlyValidMembers] = useState(requestedScope !== 'all')
  const [reloadKey, setReloadKey] = useState(0)
  const [payload, setPayload] = useState<ChannelLivePagePayload | null>(null)

  useEffect(() => {
    if (!groupId) {
      setPayload(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getChannelLivePageData(groupId)
      .then((nextPayload) => {
        if (!active) return
        setPayload(nextPayload)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setPayload(null)
        setError(requestError.message || '加载视频号直播失败')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId, reloadKey])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    setOnlyValidMembers(requestedScope !== 'all')
  }, [requestedScope])

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(location.search)

    if (groupId) {
      nextSearchParams.set('groupId', groupId)
    }

    if (onlyValidMembers) {
      nextSearchParams.delete('scope')
    } else {
      nextSearchParams.set('scope', 'all')
    }

    const nextSearch = nextSearchParams.toString()
    const currentSearch = location.search.replace(/^\?/, '')

    if (nextSearch !== currentSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
        },
        { replace: true },
      )
    }
  }, [groupId, location.pathname, location.search, navigate, onlyValidMembers])

  const summary = payload?.summary
  const currentExportableCount = onlyValidMembers
    ? summary?.exportableValidMemberCount ?? 0
    : summary?.exportableAllMemberCount ?? 0
  const currentMissingCount = onlyValidMembers
    ? summary?.missingOpenIdValidCount ?? 0
    : summary?.missingOpenIdAllCount ?? 0
  const exportSummaryText = useMemo(() => {
    if (!summary) return ''

    const fragments = [
      `当前成员 ${summary.currentMemberCount} 人`,
      `可导出 ${currentExportableCount} 人`,
      `缺少 OpenID ${currentMissingCount} 人`,
    ]

    if (summary.lastExportedAt) {
      fragments.push(`最近导出 ${formatDateTime(summary.lastExportedAt)}`)
    }

    return fragments.join(' · ')
  }, [summary, currentExportableCount, currentMissingCount])

  async function handleExport() {
    if (!groupId || exporting) return

    try {
      setExporting(true)
      setError('')
      const result = await downloadChannelLiveMemberList(groupId, onlyValidMembers)
      triggerBrowserDownload(result.blob, result.fileName)
      setNotice(onlyValidMembers ? '有效成员列表已开始下载' : '成员列表已开始下载')
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      const nextError = requestError instanceof Error ? requestError.message : '导出视频号直播成员列表失败'
      setError(nextError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <AdminLayout
      title="视频号直播"
      subtitle="在微信视频号内直播时，可导出成员列表并在视频号助手中添加观众名单。"
      tag="运营工具"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page channel-live-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}

        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}
        {loading ? <div className="admin-resource-panel admin-resource-empty">加载中...</div> : null}
        {!loading && hasGroups && !payload && !error ? (
          <div className="admin-resource-panel admin-resource-empty">当前还没有可用的直播名单数据。</div>
        ) : null}

        {!loading && payload ? (
          <>
            <div className="channel-live-group-name">{payload.group.name || currentGroup?.name || groupId || '未分配星球'}</div>
            <div className="channel-live-reference-title">视频号直播</div>

            <section className="admin-resource-panel channel-live-reference-panel channel-live-export-panel">
              <div className="channel-live-export-icon" />
              <div className="channel-live-export-heading">视频号直播</div>
              <div className="channel-live-export-desc">
                在微信视频号内直播时，可以选择仅星球内成员可看。点击下方「导出成员列表」，在「视频号助手」后台添加观众名单即可。因导出的文件最大限制为 1 万行，成员数较多时将导出为多个文档。
              </div>
              <div className="channel-live-export-desc">
                （注：请引导并确保星友已关注饮视星球服务号/饮视星球精选订阅号，且在菜单栏点击「我的星球」并登录，否则部分星友无法观看直播）
              </div>

              <button
                className="channel-live-export-button"
                disabled={loading || exporting || !groupId}
                onClick={() => void handleExport()}
                type="button"
              >
                {exporting ? '导出中...' : '导出成员列表'}
              </button>

              <label className="channel-live-reference-check">
                <input
                  checked={onlyValidMembers}
                  onChange={(event) => setOnlyValidMembers(event.target.checked)}
                  type="checkbox"
                />
                <span className={`channel-live-reference-radio${onlyValidMembers ? ' is-checked' : ''}`} />
                <span>仅导出有效期内的成员</span>
              </label>

              {exportSummaryText ? <div className="channel-live-export-meta">{exportSummaryText}</div> : null}
            </section>

            <section className="admin-resource-panel channel-live-reference-panel channel-live-instructions-panel">
              <div className="channel-live-instructions-title">视频号操作步骤：</div>

              <div className="channel-live-instruction-step">
                <div className="channel-live-step-number">01.</div>
                <div className="channel-live-step-text-box">
                  <span className="channel-live-step-text">在浏览器打开微信视频号助手官网（</span>
                  <a className="channel-live-step-link" href="https://channels.weixin.qq.com" rel="noreferrer" target="_blank">
                    https://channels.weixin.qq.com
                  </a>
                  <span className="channel-live-step-text">），进入「</span>
                  <span className="channel-live-step-strong">直播管理-直播间管理</span>
                  <span className="channel-live-step-text">」（需提前认证并申请开通直播）</span>
                </div>
              </div>
              <div className="channel-live-step-image channel-live-step-image-one" />

              <div className="channel-live-instruction-step">
                <div className="channel-live-step-number">02.</div>
                <div className="channel-live-step-text-box">
                  <span className="channel-live-step-text">进入「</span>
                  <span className="channel-live-step-strong">直播管理</span>
                  <span className="channel-live-step-text">」选择底部「</span>
                  <span className="channel-live-step-strong">观众名单</span>
                  <span className="channel-live-step-text">」后依次选择「</span>
                  <span className="channel-live-step-strong">添加名单</span>
                  <span className="channel-live-step-text">」，然后点击「</span>
                  <span className="channel-live-step-strong">上传 OpenID 名单</span>
                  <span className="channel-live-step-text">」上传成员列表文档，添加完成即可</span>
                </div>
              </div>
              <div className="channel-live-step-image channel-live-step-image-two" />

              <div className="channel-live-instruction-step">
                <div className="channel-live-step-number">03.</div>
                <div className="channel-live-step-text-box">
                  <span className="channel-live-step-text">在微信视频号内，点击「</span>
                  <span className="channel-live-step-strong">发起直播</span>
                  <span className="channel-live-step-text">」，在直播准备界面点击「</span>
                  <span className="channel-live-step-strong">谁可以看 - 指定观众 - 从名单选择 - 勾选添加的名单</span>
                  <span className="channel-live-step-text">」即可；</span>
                </div>
              </div>
              <div className="channel-live-instruction-step channel-live-instruction-step-tail">
                <div className="channel-live-step-number" />
                <div className="channel-live-step-text">开始直播后仅名单内的成员可观看本次直播</div>
              </div>
              <div className="channel-live-step-image channel-live-step-image-three" />
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
