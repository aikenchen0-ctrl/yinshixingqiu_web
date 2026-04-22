import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  createAdminRenewalNotice,
  getRenewalNoticePageData,
  getRenewalSettingPageData,
  type RenewalDiscountItem,
  type RenewalNoticeItem,
} from '../../services/promotionService'

type GroupSummary = {
  id: string
  name: string
  ownerName: string
}

type NoticeRowItem = RenewalNoticeItem & {
  groupLabel?: string
}

type AutoReminderItem = {
  id: string
  timing: string
  content: string
}

type NoticeFormState = {
  target: string
  content: string
  buttonText: string
  buttonUrl: string
  routeKey: string
}

const PAGE_SIZE = 10

const NOTICE_TARGET_OPTIONS = [
  { value: 'renew-before-30', label: '到期前 30 天成员' },
  { value: 'renew-before-7', label: '到期前 7 天成员' },
  { value: 'renew-before-1', label: '到期前 1 天成员' },
  { value: 'renew-after-3', label: '到期后 3 天成员' },
  { value: 'renew-after-7', label: '到期后 7 天成员' },
] as const

const DEFAULT_NOTICE_FORM: NoticeFormState = {
  target: '',
  content: '',
  buttonText: '',
  buttonUrl: '',
  routeKey: 'renewal-page',
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value || '0')
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDurationDays(duration: string) {
  const matched = /^(\d+)([DWMY])$/i.exec((duration || '').trim())
  if (!matched) return 0

  const amount = Number.parseInt(matched[1], 10)
  const unit = matched[2].toUpperCase()

  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (unit === 'D') return amount
  if (unit === 'W') return amount * 7
  if (unit === 'M') return amount * 30
  if (unit === 'Y') return amount * 365
  return 0
}

function buildDailyPrice(setting: RenewalDiscountItem | null) {
  if (!setting) return '0.00'

  const durationDays = parseDurationDays(setting.duration)
  const amount = parseAmount(setting.amount)
  if (!durationDays || amount <= 0) return amount.toFixed(2)

  return (amount / durationDays).toFixed(2)
}

function buildNoticeStatusClass(status: string) {
  if (status === 'SENT') return ' is-success'
  if (status === 'SCHEDULED') return ' is-warning'
  if (status === 'DRAFT') return ' is-muted'
  return ''
}

function buildPushTimeLabel(item: NoticeRowItem) {
  return formatDateTime(item.sentAt || item.scheduledAt)
}

function buildPushGroupLabel(item: NoticeRowItem) {
  if (item.groupLabel) return item.groupLabel

  const source = `${item.title} ${item.content}`
  if (source.includes('30 天')) return '到期前 30 天成员'
  if (source.includes('7 天') && !source.includes('过期') && !source.includes('到期后')) return '到期前 7 天成员'
  if (source.includes('1 天') || source.includes('明天')) return '到期前 1 天成员'
  if (source.includes('当天')) return '到期当天成员'
  if (source.includes('3 天') && (source.includes('过期') || source.includes('到期后'))) return '到期后 3 天成员'
  if (source.includes('7 天') && (source.includes('过期') || source.includes('到期后'))) return '到期后 7 天成员'
  if (item.routeKey === 'renewal-recall') return '过期成员'
  if (item.routeKey === 'renewal-page') return '续期成员'
  return '自定义分组'
}

function buildAutoReminders(groupName: string, setting: RenewalDiscountItem | null): AutoReminderItem[] {
  const dailyPrice = buildDailyPrice(setting)

  return [
    {
      id: 'before-30',
      timing: '到期前 30 天',
      content: `你加入的星球「${groupName}」开启续期了，现在参加仅需 ${dailyPrice} 元/天，速戳查看～`,
    },
    {
      id: 'before-7',
      timing: '到期前 7 天',
      content: `你加入的星球「${groupName}」开启续期了，现在参加仅需 ${dailyPrice} 元/天，速戳查看～`,
    },
    {
      id: 'on-day',
      timing: '到期当天',
      content: `你的会员已到期，星球内新增 N 条精彩内容，仅需 ${dailyPrice} 元/天即可全部解锁，速戳查看～`,
    },
    {
      id: 'after-3',
      timing: '到期后 3 天',
      content: `你的会员已到期，星球内新增 N 条精彩内容，仅需 ${dailyPrice} 元/天即可全部解锁，速戳查看～`,
    },
    {
      id: 'after-7',
      timing: '到期后 7 天',
      content: `你的会员已到期，星球内新增 N 条精彩内容，仅需 ${dailyPrice} 元/天即可全部解锁，速戳查看～`,
    },
  ]
}

function buildCreatedNoticeTitle(groupLabel: string) {
  return `${groupLabel}提醒`
}

export function RenewalNoticePage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [group, setGroup] = useState<GroupSummary | null>(null)
  const [setting, setSetting] = useState<RenewalDiscountItem | null>(null)
  const [rows, setRows] = useState<NoticeRowItem[]>([])
  const [page, setPage] = useState(1)
  const [jumpPageInput, setJumpPageInput] = useState('1')
  const [editorMode, setEditorMode] = useState<'create' | 'reminder' | ''>('')
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [savingCreateNotice, setSavingCreateNotice] = useState(false)
  const [noticeForm, setNoticeForm] = useState<NoticeFormState>(DEFAULT_NOTICE_FORM)
  const [editingReminderId, setEditingReminderId] = useState('')
  const [reminderDraft, setReminderDraft] = useState('')

  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      setSetting(null)
      setRows([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.allSettled([getRenewalNoticePageData(groupId), getRenewalSettingPageData(groupId)])
      .then(([noticeResult, settingResult]) => {
        if (!active) return

        if (noticeResult.status === 'fulfilled') {
          setRows(noticeResult.value.rows)
        } else {
          setRows([])
          setError(noticeResult.reason instanceof Error ? noticeResult.reason.message : '加载分组通知页面失败')
        }

        if (settingResult.status === 'fulfilled') {
          setSetting(settingResult.value.setting)
        } else {
          setSetting(null)
        }

        if (noticeResult.status === 'fulfilled') {
          setGroup(noticeResult.value.group)
        } else if (settingResult.status === 'fulfilled') {
          setGroup(settingResult.value.group)
        } else {
          setGroup(null)
        }
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
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const groupDisplayName = group?.name || currentGroup?.name || groupId || '未分配星球'
  const baseAutoReminders = useMemo(() => buildAutoReminders(groupDisplayName, setting), [groupDisplayName, setting])
  const [autoReminders, setAutoReminders] = useState<AutoReminderItem[]>(baseAutoReminders)

  useEffect(() => {
    setAutoReminders(baseAutoReminders)
  }, [baseAutoReminders])

  const totalPages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const pagedRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page, rows])
  const editingReminder = useMemo(
    () => autoReminders.find((item) => item.id === editingReminderId) || null,
    [autoReminders, editingReminderId],
  )

  useEffect(() => {
    setPage((currentValue) => Math.min(currentValue, totalPages))
  }, [totalPages])

  useEffect(() => {
    setJumpPageInput(String(page))
  }, [page])

  function closeEditor() {
    setEditorMode('')
    setShowMoreSettings(false)
    setShowPreview(false)
    setEditorError('')
    setEditingReminderId('')
    setReminderDraft('')
    setNoticeForm({ ...DEFAULT_NOTICE_FORM })
  }

  function handleJumpPage() {
    const nextPage = Number.parseInt(jumpPageInput, 10)
    if (!Number.isFinite(nextPage)) {
      setJumpPageInput(String(page))
      return
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages)
    setPage(clampedPage)
    setJumpPageInput(String(clampedPage))
  }

  function handleOpenCreate() {
    setEditorMode('create')
    setShowMoreSettings(false)
    setShowPreview(false)
    setEditorError('')
    setNoticeForm({ ...DEFAULT_NOTICE_FORM })
  }

  function handleNoticeFormChange<Key extends keyof NoticeFormState>(key: Key, value: NoticeFormState[Key]) {
    setNoticeForm((currentValue) => ({
      ...currentValue,
      [key]: value,
    }))
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!groupId) {
      setEditorError('缺少星球 ID，暂时不能创建通知')
      return
    }

    const targetLabel = NOTICE_TARGET_OPTIONS.find((item) => item.value === noticeForm.target)?.label || ''
    const content = noticeForm.content.trim()
    const buttonText = noticeForm.buttonText.trim()
    const buttonUrl = noticeForm.buttonUrl.trim()

    if (!targetLabel) {
      setEditorError('请先选择发送对象')
      return
    }

    if (!content) {
      setEditorError('请填写推送内容')
      return
    }

    if (buttonUrl && !buttonText) {
      setEditorError('设置按钮跳转链接时，请同时填写按钮文案')
      return
    }

    setSavingCreateNotice(true)
    setEditorError('')

    try {
      const result = await createAdminRenewalNotice({
        groupId,
        title: buildCreatedNoticeTitle(targetLabel),
        content,
        buttonText,
        buttonUrl,
        routeKey: noticeForm.routeKey,
      })

      setRows((currentValue) => [
        {
          ...result.row,
          groupLabel: targetLabel,
        },
        ...currentValue,
      ])
      setPage(1)
      setJumpPageInput('1')
      setNotice('通知已写入后台，当前默认保存为草稿。')
      closeEditor()
    } catch (requestError) {
      setEditorError(requestError instanceof Error ? requestError.message : '创建通知失败')
    } finally {
      setSavingCreateNotice(false)
    }
  }

  function handleEditReminder(item: AutoReminderItem) {
    setEditorMode('reminder')
    setEditingReminderId(item.id)
    setReminderDraft(item.content)
    setEditorError('')
  }

  function handleReminderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const content = reminderDraft.trim()
    if (!editingReminder || !content) {
      setEditorError('请填写提醒文案')
      return
    }

    setAutoReminders((currentValue) =>
      currentValue.map((item) =>
        item.id === editingReminder.id
          ? {
              ...item,
              content,
            }
          : item,
      ),
    )
    setNotice('已更新提醒文案，当前先按页面稿预览。')
    closeEditor()
  }

  return (
    <AdminLayout
      title="分组通知"
      subtitle="对照旧后台，把分组通知记录和自动续期提醒先按原始结构还原。"
      tag="成员续期"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="admin-resource-page renewal-notice-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <div className="renewal-notice-group-name">{groupDisplayName}</div>

            <section className="renewal-notice-block">
              <div className="renewal-notice-titlebar">
                <div className="renewal-notice-titlebar-main">
                  <div className="renewal-notice-title-row">
                    <h2>分组通知记录</h2>
                    <span
                      className="renewal-notice-explain-icon"
                      title="星主可以通过此功能给星球内的成员发送通知，包括已过期成员。"
                    >
                      ?
                    </span>
                  </div>
                  <p>
                    <span>* 下载了饮视星球 App 的用户，成员收到推送的比例更高哦~</span>
                    <span className="renewal-notice-title-link">前往通知 &gt;</span>
                  </p>
                </div>
              </div>

              <div className="renewal-notice-operation">
                <button onClick={handleOpenCreate} type="button">
                  新建通知
                </button>
              </div>

              <div className="renewal-notice-list-card">
                <div className="renewal-notice-record-head renewal-notice-record-grid">
                  <span>推送时间</span>
                  <span>内容</span>
                  <span>按钮文案</span>
                  <span>按钮跳转链接</span>
                  <span>推送群组</span>
                  <span>状态</span>
                </div>

                <div className="renewal-notice-record-body">
                  {loading ? <div className="renewal-notice-empty">加载中...</div> : null}

                  {!loading && !pagedRows.length ? (
                    <div className="renewal-notice-empty">暂时还没有分组通知，点击「新建通知」试试吧</div>
                  ) : null}

                  {!loading
                    ? pagedRows.map((item) => (
                        <div className="renewal-notice-record-row renewal-notice-record-grid" key={item.id}>
                          <span>{buildPushTimeLabel(item)}</span>
                          <span className="renewal-notice-record-content" title={item.content || item.title}>
                            {item.content || item.title}
                          </span>
                          <span title={item.buttonText || '-'}>{item.buttonText || '-'}</span>
                          <span className="renewal-notice-record-link" title={item.buttonUrl || '-'}>
                            {item.buttonUrl || '-'}
                          </span>
                          <span title={buildPushGroupLabel(item)}>{buildPushGroupLabel(item)}</span>
                          <span>
                            <span className={`resource-table-chip${buildNoticeStatusClass(item.status)}`}>{item.statusLabel}</span>
                          </span>
                        </div>
                      ))
                    : null}
                </div>

                <div className="renewal-notice-pagination">
                  <div className="renewal-notice-pagination-main">
                    <button disabled={page <= 1} onClick={() => setPage((currentValue) => currentValue - 1)} type="button">
                      上一页
                    </button>
                    <span>{String(page)}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((currentValue) => currentValue + 1)}
                      type="button"
                    >
                      下一页
                    </button>
                  </div>
                  <div className="renewal-notice-pagination-jump">
                    <input
                      max={totalPages}
                      min={1}
                      onChange={(event) => setJumpPageInput(event.target.value)}
                      type="number"
                      value={jumpPageInput}
                    />
                    <button disabled={totalPages <= 1} onClick={handleJumpPage} type="button">
                      跳转
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="renewal-notice-block">
              <div className="renewal-notice-titlebar">
                <div className="renewal-notice-titlebar-main">
                  <div className="renewal-notice-title-row">
                    <h2>根据到期时间自动推送的续期提醒</h2>
                    <span
                      className="renewal-notice-explain-icon"
                      title="平台根据用户的到期时间，向用户自动推送续期提醒。"
                    >
                      ?
                    </span>
                  </div>
                  <p>
                    <span className="renewal-notice-highlight">固定时长的星球，未关闭「成员续期」才会推送提醒</span>
                  </p>
                </div>
              </div>

              <div className="renewal-notice-list-card">
                <div className="renewal-auto-head renewal-auto-grid">
                  <span>提醒时间</span>
                  <span>提醒文案</span>
                  <span>操作</span>
                </div>

                <ul className="renewal-auto-list">
                  {autoReminders.map((item) => (
                    <li className="renewal-auto-row renewal-auto-grid" key={item.id}>
                      <span>{item.timing}</span>
                      <span className="renewal-auto-content" title={item.content}>
                        {item.content}
                      </span>
                      <button onClick={() => handleEditReminder(item)} type="button">
                        修改文案
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        ) : null}

        {editorMode === 'create' ? (
          <div className="renewal-notice-modal-backdrop" onClick={closeEditor} role="presentation">
            <div className="renewal-notice-modal" onClick={(event) => event.stopPropagation()} role="dialog">
              <form onSubmit={handleCreateSubmit}>
                <div className="renewal-notice-modal-header">
                  <div className="renewal-notice-modal-title">新增分组通知</div>
                  <button className="renewal-notice-modal-close" onClick={closeEditor} type="button">
                    ×
                  </button>
                </div>

                <div className="renewal-notice-modal-body">
                  <label className="renewal-notice-modal-field">
                    <span>选择发送对象</span>
                    <select
                      disabled={savingCreateNotice}
                      onChange={(event) => handleNoticeFormChange('target', event.target.value)}
                      value={noticeForm.target}
                    >
                      <option value="">选择分组</option>
                      {NOTICE_TARGET_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="renewal-notice-modal-field">
                    <span>推送内容</span>
                    <div className="renewal-notice-modal-textarea">
                      <textarea
                        disabled={savingCreateNotice}
                        maxLength={300}
                        onChange={(event) => handleNoticeFormChange('content', event.target.value)}
                        placeholder="请简要描述星球内最近新增的优质内容、续期可获得价值和服务"
                        value={noticeForm.content}
                      />
                      <em>{`(${noticeForm.content.length}/300)`}</em>
                    </div>
                  </label>

                  <button
                    className={`renewal-notice-more-settings${showMoreSettings ? ' is-open' : ''}`}
                    disabled={savingCreateNotice}
                    onClick={() => setShowMoreSettings((currentValue) => !currentValue)}
                    type="button"
                  >
                    <span>更多设置</span>
                    <span>（引导语和目标页面）</span>
                  </button>

                  {showMoreSettings ? (
                    <div className="renewal-notice-modal-grid">
                      <label className="renewal-notice-modal-field">
                        <span>按钮文案</span>
                        <input
                          disabled={savingCreateNotice}
                          maxLength={20}
                          onChange={(event) => handleNoticeFormChange('buttonText', event.target.value)}
                          placeholder="例如：立即续期"
                          value={noticeForm.buttonText}
                        />
                      </label>

                      <label className="renewal-notice-modal-field">
                        <span>按钮跳转链接</span>
                        <input
                          disabled={savingCreateNotice}
                          onChange={(event) => handleNoticeFormChange('buttonUrl', event.target.value)}
                          placeholder="请输入跳转链接"
                          value={noticeForm.buttonUrl}
                        />
                      </label>

                      <label className="renewal-notice-modal-field">
                        <span>目标页面</span>
                        <select
                          disabled={savingCreateNotice}
                          onChange={(event) => handleNoticeFormChange('routeKey', event.target.value)}
                          value={noticeForm.routeKey}
                        >
                          <option value="renewal-page">续期页</option>
                          <option value="renewal-recall">续期召回页</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {showPreview ? (
                    <div className="renewal-notice-preview-card">
                      <div className="renewal-notice-preview-copy">{noticeForm.content || '请先填写推送内容'}</div>
                      <div className="renewal-notice-preview-action">
                        <span>{noticeForm.buttonText || '立即查看'}</span>
                      </div>
                    </div>
                  ) : null}

                  {editorError ? <div className="renewal-notice-modal-error">{editorError}</div> : null}
                </div>

                <div className="renewal-notice-modal-footer">
                  <div className="renewal-notice-modal-tip">
                    消息将通过 App 和 H5 推送给选中的成员，每两周可推送 <strong>1</strong> 次
                  </div>
                  <div className="renewal-notice-modal-actions">
                    <button
                      className="is-ghost"
                      disabled={savingCreateNotice}
                      onClick={() => setShowPreview((currentValue) => !currentValue)}
                      type="button"
                    >
                      {showPreview ? '收起预览' : '预览通知'}
                    </button>
                    <button className="is-primary" disabled={savingCreateNotice} type="submit">
                      {savingCreateNotice ? '提交中...' : '提交通知'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {editorMode === 'reminder' && editingReminder ? (
          <div className="renewal-notice-modal-backdrop" onClick={closeEditor} role="presentation">
            <div className="renewal-notice-modal renewal-notice-modal-compact" onClick={(event) => event.stopPropagation()} role="dialog">
              <form onSubmit={handleReminderSubmit}>
                <div className="renewal-notice-modal-header">
                  <div className="renewal-notice-modal-title">{`修改文案 · ${editingReminder.timing}`}</div>
                  <button className="renewal-notice-modal-close" onClick={closeEditor} type="button">
                    ×
                  </button>
                </div>

                <div className="renewal-notice-modal-body">
                  <label className="renewal-notice-modal-field">
                    <span>提醒文案</span>
                    <div className="renewal-notice-modal-textarea">
                      <textarea maxLength={300} onChange={(event) => setReminderDraft(event.target.value)} value={reminderDraft} />
                      <em>{`(${reminderDraft.length}/300)`}</em>
                    </div>
                  </label>

                  {editorError ? <div className="renewal-notice-modal-error">{editorError}</div> : null}
                </div>

                <div className="renewal-notice-modal-footer">
                  <div className="renewal-notice-modal-tip">当前先用于前端页面预览，不直接回写接口。</div>
                  <div className="renewal-notice-modal-actions">
                    <button className="is-ghost" onClick={closeEditor} type="button">
                      取消
                    </button>
                    <button className="is-primary" type="submit">
                      保存文案
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
