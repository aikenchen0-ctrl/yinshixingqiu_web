import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  createPromotionChannel,
  getPromotionChannelPageData,
  type PromotionChannelDetailItem,
} from '../../services/promotionService'
import { resolvePlanetAssetUrl } from '../../services/planetWebService'

const STATUS_FILTERS = [
  { key: 'ALL', label: '全部渠道' },
  { key: 'ACTIVE', label: '已启用' },
  { key: 'PAUSED', label: '已停用' },
] as const

const SCENE_FILTERS = [
  { key: 'ALL', label: '全部场景' },
  { key: '内容导流', label: '内容导流' },
  { key: '私域传播', label: '私域传播' },
  { key: '直播转化', label: '直播转化' },
  { key: '渠道投放', label: '渠道投放' },
] as const

const POSTER_THEMES = [
  { className: 'is-mint', start: '#f8fff8', end: '#e5fff0', accent: '#16b998', soft: '#b9f0dd', glow: '#d8fff0' },
  { className: 'is-peach', start: '#fff7ef', end: '#ffe9df', accent: '#f28f67', soft: '#ffd7c7', glow: '#fff1e8' },
  { className: 'is-sky', start: '#f4fbff', end: '#e0f2ff', accent: '#4b92d1', soft: '#c7e5fb', glow: '#e6f6ff' },
] as const

const PAID_HINT = '付费人数不包含退出星球且退款的人数'
const INCOME_HINT = '收入包含手续费的部分，不包含已退款金额和手续费'
const JOIN_PAID_HINT = '2021/7/9 之后，付费人数改为不包含付费后退出星球的付费加入人数。之前仍按付费后是否退款计算。'
const TABLE_INCOME_HINT = '2020/5/1 之后生成的小程序码才支持显示收入数据，上线时间待定之后的收入不包含已退款金额和手续费。'
const TABLE_ACTION_HINT = '2021/7/9 之后生成的小程序码才支持导出数据。'
const CHANNEL_NAME_HINT = '最多输入 30 个字符，仅支持中文、英文、数字或空格'
const CHANNEL_NAME_PLACEHOLDER = '输入 30 个字以内的名称'
const CHANNEL_NAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9 ]+$/

type StatusFilter = (typeof STATUS_FILTERS)[number]['key']
type SceneFilter = (typeof SCENE_FILTERS)[number]['key']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(value: string, withSeconds = false) {
  if (!value) return '--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const base = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

function toNumberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitMoneyParts(value: number) {
  const [integerPart, decimalPart = '00'] = value.toFixed(2).split('.')
  return { integerPart, decimalPart }
}

function escapeCsvValue(value: string | number) {
  const normalized = String(value ?? '')
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

function sanitizeChannelInput(value: string) {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 30)
}

function validateChannelName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    return '请填写渠道名称'
  }

  if (normalized.length > 30) {
    return '渠道名称最多输入 30 个字符'
  }

  if (!CHANNEL_NAME_PATTERN.test(normalized)) {
    return '渠道名称仅支持中文、英文、数字或空格'
  }

  return ''
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '')
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function buildChannelJoinLink(groupId: string, channelCode: string) {
  const path = `/preview/${encodeURIComponent(groupId)}?channelCode=${encodeURIComponent(channelCode)}`
  if (typeof window === 'undefined') {
    return path
  }

  return `${window.location.origin}${path}`
}

function hasValidChannelQrImage(item: PromotionChannelDetailItem) {
  const rawUrl = item.qrCodeUrl.trim()
  return Boolean(rawUrl && !rawUrl.includes('img.example.com'))
}

function resolveChannelQrImageUrl(item: PromotionChannelDetailItem) {
  return hasValidChannelQrImage(item) ? resolvePlanetAssetUrl(item.qrCodeUrl.trim()) : ''
}

function buildPosterSvg({
  channelName,
  groupName,
  ownerName,
  qrImageUrl,
  theme,
}: {
  channelName: string
  groupName: string
  ownerName: string
  qrImageUrl: string
  theme: (typeof POSTER_THEMES)[number]
}) {
  const safeGroupName = escapeSvgText(truncateText(groupName, 18))
  const safeOwnerName = escapeSvgText(truncateText(ownerName, 16))
  const safeChannelName = escapeSvgText(truncateText(channelName, 18))
  const safeQrImageUrl = escapeSvgText(qrImageUrl)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="540" height="760" viewBox="0 0 540 760">
  <defs>
    <linearGradient id="posterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.start}" />
      <stop offset="100%" stop-color="${theme.end}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="540" height="760" rx="44" fill="url(#posterGradient)" />
  <circle cx="438" cy="112" r="96" fill="${theme.glow}" />
  <circle cx="100" cy="660" r="120" fill="${theme.soft}" opacity="0.7" />
  <rect x="56" y="72" width="428" height="616" rx="32" fill="#ffffff" fill-opacity="0.82" />
  <text x="270" y="154" text-anchor="middle" font-size="34" font-weight="700" fill="#2f3034" font-family="PingFang SC, Microsoft YaHei, sans-serif">${safeGroupName}</text>
  <text x="270" y="206" text-anchor="middle" font-size="28" font-weight="600" fill="${theme.accent}" font-family="PingFang SC, Microsoft YaHei, sans-serif">${safeOwnerName}</text>
  <text x="270" y="242" text-anchor="middle" font-size="20" fill="#8b8e9d" font-family="PingFang SC, Microsoft YaHei, sans-serif">星主</text>
  <rect x="140" y="292" width="260" height="260" rx="28" fill="#ffffff" />
  <image href="${safeQrImageUrl}" x="165" y="317" width="210" height="210" preserveAspectRatio="xMidYMid meet" />
  <text x="270" y="604" text-anchor="middle" font-size="22" font-weight="600" fill="#2f3034" font-family="PingFang SC, Microsoft YaHei, sans-serif">${safeChannelName}</text>
  <text x="270" y="642" text-anchor="middle" font-size="18" fill="#8b8e9d" font-family="PingFang SC, Microsoft YaHei, sans-serif">扫码打开专属星球付费页</text>
</svg>`
}

function buildFilterSummary(statusFilter: StatusFilter, sceneFilter: SceneFilter, hideZero: boolean, matchedCount: number) {
  const summaryParts: string[] = []

  if (statusFilter !== 'ALL') {
    summaryParts.push(STATUS_FILTERS.find((item) => item.key === statusFilter)?.label || statusFilter)
  }

  if (sceneFilter !== 'ALL') {
    summaryParts.push(SCENE_FILTERS.find((item) => item.key === sceneFilter)?.label || sceneFilter)
  }

  if (hideZero) {
    summaryParts.push('隐藏零访问渠道')
  }

  if (!summaryParts.length) {
    return ''
  }

  return `当前筛选：${summaryParts.join(' / ')}，命中 ${matchedCount} 条渠道。`
}

function InfoExplain({ text }: { text: string }) {
  return (
    <span className="channel-report-explain" title={text}>
      ?
    </span>
  )
}

function OverviewCard({
  label,
  value,
  ratioLabel,
  ratioValue,
  hint,
  money,
}: {
  label: string
  value: string
  ratioLabel?: string
  ratioValue?: string
  hint?: string
  money?: boolean
}) {
  const moneyParts = money ? splitMoneyParts(toNumberValue(value)) : null

  return (
    <article className="channel-overview-card">
      <div className="channel-overview-label">
        <span>{label}</span>
        {hint ? <InfoExplain text={hint} /> : null}
      </div>

      <div className="channel-overview-value">
        {moneyParts ? (
          <>
            <span>{moneyParts.integerPart}</span>
            <em>{`.${moneyParts.decimalPart}`}</em>
          </>
        ) : (
          value
        )}
      </div>

      <div className="channel-overview-ratio">
        {ratioLabel ? <span>{ratioLabel}</span> : null}
        {ratioValue ? <span>{ratioValue}</span> : null}
      </div>
    </article>
  )
}

function ChannelRow({
  item,
  qrImageUrl,
  creatorName,
  selected,
  onSelect,
  onDownloadQr,
  onCopyLink,
  onExportRow,
}: {
  item: PromotionChannelDetailItem
  qrImageUrl: string
  creatorName: string
  selected: boolean
  onSelect: (id: string) => void
  onDownloadQr: (item: PromotionChannelDetailItem, qrImageUrl: string) => void
  onCopyLink: (item: PromotionChannelDetailItem) => void
  onExportRow: (item: PromotionChannelDetailItem) => void
}) {
  return (
    <div
      className={`channel-report-row${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(item.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="channel-report-name-cell">
        <div className="channel-report-name">{item.name}</div>
        <div className="channel-report-meta">{`${item.code || '未配置渠道码'} · ${item.scene} · ${item.statusLabel}`}</div>
      </div>

      <div className="channel-report-cell channel-report-time" title={`创建人 : ${creatorName || '星主'}`}>
        {formatDateTime(item.createdAt, true)}
      </div>
      <div className="channel-report-cell">{String(item.visits)}</div>
      <div className="channel-report-cell">{`${item.clicks}/${item.paidCount}`}</div>
      <div className="channel-report-cell">{item.income}</div>

      <div className="channel-report-operation-cell" onClick={(event) => event.stopPropagation()}>
        <button className="channel-report-action" disabled={!qrImageUrl} onClick={() => onDownloadQr(item, qrImageUrl)} type="button">
          {qrImageUrl ? '下载小程序码' : '生成中...'}
        </button>
        <button className="channel-report-action" onClick={() => onCopyLink(item)} type="button">
          复制链接
        </button>
        <button className="channel-report-action" onClick={() => onExportRow(item)} type="button">
          导出数据
        </button>
      </div>
    </div>
  )
}

export function PromotionChannelPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedStatus = searchParams.get('status') || ''
  const requestedScene = searchParams.get('scene') || ''
  const requestedChannelId = searchParams.get('channelId') || ''
  const requestedChannelCode = searchParams.get('channelCode') || ''
  const requestedHideZero = searchParams.get('hideZero') === '1'
  const statusFilter: StatusFilter = STATUS_FILTERS.some((item) => item.key === requestedStatus)
    ? (requestedStatus as StatusFilter)
    : 'ALL'
  const sceneFilter: SceneFilter = SCENE_FILTERS.some((item) => item.key === requestedScene)
    ? (requestedScene as SceneFilter)
    : 'ALL'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [hideZero, setHideZero] = useState(requestedHideZero)
  const [group, setGroup] = useState<{ id: string; name: string; ownerName: string } | null>(null)
  const [rows, setRows] = useState<PromotionChannelDetailItem[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createChannelName, setCreateChannelName] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [posterChannel, setPosterChannel] = useState<PromotionChannelDetailItem | null>(null)
  const [posterThemeIndex, setPosterThemeIndex] = useState(0)

  const groupName = group?.name || currentGroup?.name || groupId || '未分配星球'
  const ownerName = group?.ownerName || currentGroup?.ownerName || '星主'

  function buildAdminPath(path: string, extraQuery?: Record<string, string>) {
    const [pathname, rawSearch = ''] = path.split('?')
    const nextSearchParams = new URLSearchParams()
    const pathSearchParams = new URLSearchParams(rawSearch)

    if (groupId) {
      nextSearchParams.set('groupId', groupId)
    }

    pathSearchParams.forEach((value, key) => {
      nextSearchParams.set(key, value)
    })

    Object.entries(extraQuery || {}).forEach(([key, value]) => {
      if (value) {
        nextSearchParams.set(key, value)
      } else {
        nextSearchParams.delete(key)
      }
    })

    const nextSearch = nextSearchParams.toString()
    return `${pathname}${nextSearch ? `?${nextSearch}` : ''}`
  }

  function getChannelJoinLink(item: PromotionChannelDetailItem) {
    return groupId ? buildChannelJoinLink(groupId, item.code) : item.code
  }

  function getChannelQrImageUrl(item: PromotionChannelDetailItem) {
    return resolveChannelQrImageUrl(item)
  }

  useEffect(() => {
    setHideZero(requestedHideZero)
  }, [requestedHideZero])

  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      setRows([])
      setSelectedChannelId('')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getPromotionChannelPageData(groupId)
      .then((data) => {
        if (!active) return
        setGroup(data.group)
        setRows(data.rows)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载渠道小程序码页面失败')
        setRows([])
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
    if (!notice) return undefined

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    if (!createDialogOpen && !posterChannel) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      if (posterChannel) {
        setPosterChannel(null)
        return
      }

      if (!createSubmitting) {
        setCreateDialogOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [createDialogOpen, createSubmitting, posterChannel])

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false
      }

      if (sceneFilter !== 'ALL' && item.scene !== sceneFilter) {
        return false
      }

      return true
    })
  }, [rows, sceneFilter, statusFilter])

  const visibleRows = useMemo(() => {
    if (!hideZero) {
      return filteredRows
    }

    return filteredRows.filter((item) => item.visits > 0)
  }, [filteredRows, hideZero])

  useEffect(() => {
    if (!visibleRows.length) {
      setSelectedChannelId('')
      return
    }

    const requestedChannel =
      visibleRows.find((item) => item.id === requestedChannelId) ||
      visibleRows.find((item) => item.code === requestedChannelCode) ||
      null

    setSelectedChannelId((currentValue) => {
      if (requestedChannel) {
        return requestedChannel.id
      }

      if (currentValue && visibleRows.some((item) => item.id === currentValue)) {
        return currentValue
      }

      return ''
    })
  }, [requestedChannelCode, requestedChannelId, visibleRows])

  const selectedChannel = useMemo(
    () => visibleRows.find((item) => item.id === selectedChannelId) || null,
    [selectedChannelId, visibleRows],
  )

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(location.search)

    if (hideZero) {
      nextSearchParams.set('hideZero', '1')
    } else {
      nextSearchParams.delete('hideZero')
    }

    if (selectedChannelId) {
      nextSearchParams.set('channelId', selectedChannelId)
    } else {
      nextSearchParams.delete('channelId')
    }

    if (selectedChannel?.code) {
      nextSearchParams.set('channelCode', selectedChannel.code)
    } else {
      nextSearchParams.delete('channelCode')
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
  }, [hideZero, location.pathname, location.search, navigate, selectedChannel?.code, selectedChannelId])

  const totalVisits = filteredRows.reduce((sum, item) => sum + item.visits, 0)
  const totalJoinedCount = filteredRows.reduce((sum, item) => sum + item.clicks, 0)
  const totalPaidCount = filteredRows.reduce((sum, item) => sum + item.paidCount, 0)
  const totalIncome = filteredRows.reduce((sum, item) => sum + toNumberValue(item.income), 0)
  const totalIncomeParts = splitMoneyParts(totalIncome)
  const hasFilterSummary = statusFilter !== 'ALL' || sceneFilter !== 'ALL' || hideZero
  const filterSummary = buildFilterSummary(statusFilter, sceneFilter, hideZero, visibleRows.length)
  const posterTheme = POSTER_THEMES[posterThemeIndex]
  const posterQrImageUrl = posterChannel ? getChannelQrImageUrl(posterChannel) : ''
  const posterOwnerName = posterChannel?.creatorName || ownerName

  async function handleCopy(value: string, successMessage: string) {
    if (!value) {
      setNotice('当前没有可复制的内容')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setNotice(successMessage)
    } catch {
      setNotice('复制失败，请手动复制当前内容')
    }
  }

  function triggerDownload(url: string, fileName: string) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  function exportChannelRows(exportRows: PromotionChannelDetailItem[], fileName: string) {
    const header = ['渠道名', '渠道码', '投放场景', '状态', '生成时间', '访问人数', '加入人数', '付费人数', '收入(元)', '最近成交用户', '最近成交时间']
    const csvRows = exportRows.map((item) => [
      item.name,
      item.code,
      item.scene,
      item.statusLabel,
      formatDateTime(item.createdAt, true),
      item.visits,
      item.clicks,
      item.paidCount,
      item.income,
      item.latestOrderNickname || '--',
      formatDateTime(item.latestOrderPaidAt),
    ])

    const csvContent = [header, ...csvRows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
      .join('\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = window.URL.createObjectURL(blob)
    triggerDownload(downloadUrl, fileName)
    window.URL.revokeObjectURL(downloadUrl)
  }

  function handleExport() {
    if (!visibleRows.length) {
      setNotice('当前没有可导出的渠道数据')
      return
    }

    exportChannelRows(visibleRows, `${sanitizeFileName(groupName || '渠道小程序码') || '渠道小程序码'}-渠道小程序码报表.csv`)
    setNotice(`已导出 ${visibleRows.length} 条渠道数据`)
  }

  function handleExportRow(item: PromotionChannelDetailItem) {
    exportChannelRows([item], `${sanitizeFileName(item.name) || '渠道小程序码'}-渠道数据.csv`)
    setNotice('已导出当前渠道数据')
  }

  function handleDownloadQr(item: PromotionChannelDetailItem, qrImageUrl: string) {
    if (!qrImageUrl) {
      setNotice('小程序码暂未生成成功，请刷新后重试')
      return
    }

    const lowerCaseUrl = qrImageUrl.toLowerCase()
    const extension = lowerCaseUrl.endsWith('.jpg') || lowerCaseUrl.endsWith('.jpeg') ? 'jpg' : lowerCaseUrl.endsWith('.webp') ? 'webp' : 'png'
    triggerDownload(qrImageUrl, `${sanitizeFileName(item.name) || '渠道小程序码'}-小程序码.${extension}`)
    setNotice('小程序码已下载')
  }

  function handleOpenCreateDialog() {
    setCreateDialogOpen(true)
    setCreateChannelName('')
    setCreateError('')
  }

  async function handleCreateChannel() {
    if (!groupId) {
      setNotice('请先选择星球后再新增渠道')
      return
    }

    const normalizedName = createChannelName.trim().replace(/\s+/g, ' ')
    const validationMessage = validateChannelName(normalizedName)
    if (validationMessage) {
      setCreateError(validationMessage)
      return
    }

    setCreateSubmitting(true)
    setCreateError('')

    try {
      const payload = await createPromotionChannel({
        groupId,
        name: normalizedName,
      })

      setRows((currentValue) => [...currentValue, payload.row])
      setHideZero(false)
      setSelectedChannelId(payload.row.id)
      setCreateDialogOpen(false)
      setPosterThemeIndex(Math.floor(Math.random() * POSTER_THEMES.length))
      setPosterChannel(payload.row)
      setNotice('小程序码已生成')
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : '生成小程序码失败')
    } finally {
      setCreateSubmitting(false)
    }
  }

  function handleCopyLink(item: PromotionChannelDetailItem) {
    void handleCopy(getChannelJoinLink(item), '推广链接已复制')
  }

  function handleChangePosterTheme() {
    setPosterThemeIndex((currentValue) => (currentValue + 1) % POSTER_THEMES.length)
  }

  function handleDownloadPoster() {
    if (!posterChannel) return
    if (!posterQrImageUrl) {
      setNotice('小程序码暂未生成成功，请刷新后重试')
      return
    }

    const svg = buildPosterSvg({
      channelName: posterChannel.name,
      groupName,
      ownerName: posterOwnerName,
      qrImageUrl: posterQrImageUrl,
      theme: posterTheme,
    })
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const downloadUrl = window.URL.createObjectURL(blob)

    triggerDownload(downloadUrl, `${sanitizeFileName(posterChannel.name) || '渠道小程序码'}-海报.svg`)
    window.URL.revokeObjectURL(downloadUrl)
    setNotice('海报已下载')
  }

  function handleResetFilters() {
    navigate(buildAdminPath('/promotion/channel-qrcodes'))
  }

  return (
    <AdminLayout
      title="渠道小程序码"
      subtitle="每日 8 点前更新昨日数据，导出数据后可查看更全面的数据。"
      tag="推广拉新"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page channel-qrcode-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        <div className="channel-page-group-block">
          <div className="channel-page-group-name">{groupName}</div>
          <div className="channel-page-group-meta">
            <span>{`星主：${ownerName}`}</span>
            <span>{`groupId：${groupId || '-'}`}</span>
          </div>
        </div>

        <section className="admin-resource-panel channel-sheet-panel">
          <div className="channel-sheet-header">
            <div>
              <div className="channel-sheet-title">数据概览</div>
              <div className="channel-sheet-subtitle">每日 8 点前更新昨日数据</div>
            </div>
          </div>

          <div className="channel-overview-grid">
            <OverviewCard label="总渠道数" value={String(filteredRows.length)} />
            <OverviewCard label="渠道总访问次数" ratioLabel="昨日新增访问" ratioValue="--" value={String(totalVisits)} />
            <OverviewCard label="渠道总加入人数" ratioLabel="昨日新增人数" ratioValue="--" value={String(totalJoinedCount)} />
            <OverviewCard
              hint={PAID_HINT}
              label="渠道总付费人数"
              ratioLabel="昨日新增人数"
              ratioValue="--"
              value={String(totalPaidCount)}
            />
            <OverviewCard
              hint={INCOME_HINT}
              label="渠道总收入(元)"
              money
              ratioLabel="昨日新增收入"
              ratioValue="--"
              value={`${totalIncomeParts.integerPart}.${totalIncomeParts.decimalPart}`}
            />
          </div>
        </section>

        <section className="admin-resource-panel channel-sheet-panel">
          <div className="channel-sheet-header">
            <div>
              <div className="channel-sheet-title">渠道小程序码数据报表</div>
              <div className="channel-sheet-subtitle">每日 8 点前更新昨日数据，导出数据后可查看更全面的数据</div>
            </div>
            <div className="channel-sheet-tip">* 星主可以设置不同渠道的小程序码，可对比不同渠道带来的拉新效果～</div>
          </div>

          {hasFilterSummary ? (
            <div className="channel-filter-summary">
              <span>{filterSummary}</span>
              <button onClick={handleResetFilters} type="button">
                恢复默认视图
              </button>
            </div>
          ) : null}

          <div className="channel-report-shell">
            <div className="channel-report-toolbar">
              <label className="channel-hide-zero">
                <input checked={hideZero} onChange={(event) => setHideZero(event.target.checked)} type="checkbox" />
                <span>隐藏访问人数为 0 的渠道</span>
              </label>

              <div className="channel-report-toolbar-actions">
                <label className="channel-export-picker">
                  <span className="channel-export-picker-icon" aria-hidden="true">
                    □
                  </span>
                  <input placeholder="按付费时间选择要导出的数据" readOnly value="" />
                </label>
                <button className="channel-export-button" onClick={handleExport} type="button">
                  导出数据
                </button>
                <button className="channel-add-button" onClick={handleOpenCreateDialog} type="button">
                  新增推广渠道
                </button>
              </div>
            </div>

            <div className="channel-report-header">
              <span>渠道名</span>
              <span>生成时间</span>
              <span>访问人数</span>
              <span>
                加入人数/付费人数
                <InfoExplain text={JOIN_PAID_HINT} />
              </span>
              <span>
                收入(元)
                <InfoExplain text={TABLE_INCOME_HINT} />
              </span>
              <span>
                操作
                <InfoExplain text={TABLE_ACTION_HINT} />
              </span>
            </div>

            <div className="channel-report-body">
              {loading ? <div className="admin-resource-empty">加载中...</div> : null}

              {!loading && visibleRows.length ? (
                visibleRows.map((item) => (
                  <ChannelRow
                    creatorName={item.creatorName || ownerName}
                    item={item}
                    key={item.id}
                    onCopyLink={handleCopyLink}
                    onDownloadQr={handleDownloadQr}
                    onExportRow={handleExportRow}
                    onSelect={setSelectedChannelId}
                    qrImageUrl={getChannelQrImageUrl(item)}
                    selected={selectedChannelId === item.id}
                  />
                ))
              ) : null}

              {!loading && !visibleRows.length ? (
                <div className="channel-report-empty">
                  <div className="channel-report-empty-icon" aria-hidden="true" />
                  <div>暂无数据，你可以分享星球渠道小程序码来获取数据</div>
                </div>
              ) : null}
            </div>

            <div className="channel-report-footer">
              <div className="channel-report-pagination">
                <div className="channel-report-page-switcher">
                  <button disabled type="button">
                    ‹
                  </button>
                  <span>1</span>
                  <button disabled type="button">
                    ›
                  </button>
                </div>

                <div className="channel-report-page-jump">
                  <input disabled type="number" />
                  <button disabled type="button">
                    跳转
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {createDialogOpen ? (
          <div
            className="channel-create-dialog-backdrop"
            onClick={() => {
              if (!createSubmitting) {
                setCreateDialogOpen(false)
              }
            }}
          >
            <div
              aria-labelledby="channel-create-title"
              aria-modal="true"
              className="channel-create-dialog"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="channel-create-dialog-title" id="channel-create-title">
                新增渠道
              </div>
              <div className="channel-create-dialog-subtitle">
                这次要用在哪个渠道？编辑渠道名后，就可获得专属推广小程序码了
              </div>
              <div className="channel-create-dialog-field">
                <textarea
                  maxLength={30}
                  onChange={(event) => {
                    setCreateChannelName(sanitizeChannelInput(event.target.value))
                    if (createError) {
                      setCreateError('')
                    }
                  }}
                  placeholder={CHANNEL_NAME_PLACEHOLDER}
                  spellCheck={false}
                  value={createChannelName}
                />
                <div className={`channel-create-dialog-tips${createError ? ' is-error' : ''}`}>
                  {createError || CHANNEL_NAME_HINT}
                </div>
              </div>
              <div className="channel-create-dialog-footer">
                <button className="channel-create-dialog-confirm" onClick={() => void handleCreateChannel()} type="button">
                  {createSubmitting ? '生成中...' : '生成小程序码'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {posterChannel ? (
          <div className="channel-poster-backdrop" onClick={() => setPosterChannel(null)}>
            <div className="channel-poster-shell" onClick={(event) => event.stopPropagation()}>
                <div className={`channel-poster-card ${posterTheme.className}`}>
                  <div className="channel-poster-group">{groupName}</div>
                <div className="channel-poster-owner">{posterOwnerName}</div>
                <div className="channel-poster-role">星主</div>
                <div className="channel-poster-qr-box">
                  {posterQrImageUrl ? <img alt={posterChannel.name} src={posterQrImageUrl} /> : <div className="channel-detail-qr-empty">小程序码生成中...</div>}
                </div>
                <div className="channel-poster-channel-name">{posterChannel.name}</div>
              </div>
              <div className="channel-poster-actions">
                <button onClick={handleChangePosterTheme} type="button">
                  换一张
                </button>
                <button className="is-primary" disabled={!posterQrImageUrl} onClick={handleDownloadPoster} type="button">
                  {posterQrImageUrl ? '下载' : '生成中...'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
