import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  createAdminCoupon,
  getCouponPageData,
  updateAdminCoupon,
  updateAdminCouponStatus,
  type CouponFormInput,
  type RenewalCouponItem,
} from '../../services/promotionService'

const PAGE_SIZE = 8

type CouponDisplayStatus = 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'EXPIRED'
type CouponEditorMode = 'create' | 'edit'
type CouponStatusAction = 'ACTIVE' | 'PAUSED' | 'DRAFT'
type ManagedCouponType = 'PROMOTION' | 'RENEWAL'

interface CouponFormState {
  name: string
  amount: string
  totalQuantity: string
  validFrom: string
  validTo: string
  memberOnly: boolean
}

const STATUS_RANK: Record<CouponDisplayStatus, number> = {
  ACTIVE: 0,
  DRAFT: 1,
  PAUSED: 2,
  EXPIRED: 3,
}

const STATUS_LABELS: Record<CouponDisplayStatus, string> = {
  ACTIVE: '生效中',
  DRAFT: '草稿',
  PAUSED: '已暂停',
  EXPIRED: '已过期',
}

function buildPageMeta(pathname: string) {
  if (pathname === '/tools/coupons') {
    return {
      title: '优惠券',
      queryType: undefined,
      allowedCreateTypes: ['PROMOTION', 'RENEWAL'] as ManagedCouponType[],
    }
  }

  return {
    title: '续期优惠券',
    queryType: 'RENEWAL',
    allowedCreateTypes: ['RENEWAL'] as ManagedCouponType[],
  }
}

function createEmptyForm(): CouponFormState {
  return {
    name: '',
    amount: '',
    totalQuantity: '',
    validFrom: '',
    validTo: '',
    memberOnly: false,
  }
}

function normalizeCouponType(type: string): ManagedCouponType {
  return type === 'PROMOTION' ? 'PROMOTION' : 'RENEWAL'
}

function buildCouponTypeLabel(type: ManagedCouponType) {
  return type === 'PROMOTION' ? '新人券' : '续期券'
}

function buildCreateButtonLabel(type: ManagedCouponType) {
  return type === 'PROMOTION' ? '新增新人券' : '新增续期券'
}

function buildEditorTitle(mode: CouponEditorMode, type: ManagedCouponType) {
  const name = type === 'PROMOTION' ? '新人优惠券' : '续期优惠券'
  return `${mode === 'create' ? '创建' : '编辑'}「${name}」`
}

function buildEditorTips(type: ManagedCouponType) {
  if (type === 'PROMOTION') {
    return ['仅限「新用户」加入星球时使用', '以后修改星球价格，大于或等于星球价格的优惠券将自动失效']
  }

  return ['仅限「即将到期成员」续期时使用', '以后修改星球价格，大于或等于星球价格的优惠券将自动失效']
}

function buildEditorSaveLabel(mode: CouponEditorMode) {
  return mode === 'create' ? '确认创建' : '保存修改'
}

function buildEditorPublishLabel(mode: CouponEditorMode, statusActionLabel?: string) {
  if (mode === 'create') {
    return '创建并上线'
  }

  return statusActionLabel === '恢复' ? '保存并恢复' : '保存并上线'
}

function buildFormFromCoupon(item: RenewalCouponItem): CouponFormState {
  return {
    name: item.name,
    amount: item.amount,
    totalQuantity: String(item.totalQuantity),
    validFrom: formatDateInput(item.validFrom),
    validTo: formatDateInput(item.validTo),
    memberOnly: false,
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatDateInput(value: string) {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatDateRange(validFrom: string, validTo: string) {
  return `${formatDate(validFrom)} 至 ${formatDate(validTo)}`
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)}%`
}

function getCouponDisplayStatus(item: RenewalCouponItem): CouponDisplayStatus {
  if (item.status === 'EXPIRED') {
    return 'EXPIRED'
  }

  const validTo = item.validTo ? new Date(item.validTo).getTime() : 0
  if (validTo && validTo < Date.now() && item.status !== 'DRAFT') {
    return 'EXPIRED'
  }

  if (item.status === 'ACTIVE' || item.status === 'PAUSED' || item.status === 'DRAFT') {
    return item.status
  }

  return 'DRAFT'
}

function getCouponStatusLabel(item: RenewalCouponItem) {
  const displayStatus = getCouponDisplayStatus(item)
  return displayStatus === item.status ? item.statusLabel : STATUS_LABELS[displayStatus]
}

function buildStatusClass(item: RenewalCouponItem) {
  const displayStatus = getCouponDisplayStatus(item)
  if (displayStatus === 'ACTIVE') return ' is-success'
  if (displayStatus === 'DRAFT') return ' is-warning'
  return ' is-muted'
}

function buildStatusAction(item: RenewalCouponItem) {
  const displayStatus = getCouponDisplayStatus(item)

  if (displayStatus === 'DRAFT') {
    return { label: '上线', status: 'ACTIVE' as const }
  }

  if (displayStatus === 'ACTIVE') {
    return { label: '暂停', status: 'PAUSED' as const }
  }

  if (displayStatus === 'PAUSED') {
    return { label: '恢复', status: 'ACTIVE' as const }
  }

  return null
}

function buildAutoCouponCode(type: ManagedCouponType) {
  return `${type === 'PROMOTION' ? 'XR' : 'XQ'}${Date.now().toString(36).toUpperCase()}`
}

function buildUsageRate(rows: RenewalCouponItem[]) {
  const totalQuantity = rows.reduce((sum, item) => sum + item.totalQuantity, 0)
  const usedQuantity = rows.reduce((sum, item) => sum + item.usedQuantity, 0)
  return totalQuantity ? (usedQuantity / totalQuantity) * 100 : 0
}

function upsertCouponRow(rows: RenewalCouponItem[], nextRow: RenewalCouponItem) {
  const targetIndex = rows.findIndex((item) => item.id === nextRow.id)
  if (targetIndex === -1) {
    return [nextRow, ...rows]
  }

  const nextRows = [...rows]
  nextRows[targetIndex] = nextRow
  return nextRows
}

function CouponRow({
  item,
  pending,
  onEdit,
  onCopy,
  onStatusChange,
}: {
  item: RenewalCouponItem
  pending: boolean
  onEdit: (item: RenewalCouponItem) => void
  onCopy: (code: string) => void
  onStatusChange: (item: RenewalCouponItem, status: CouponStatusAction) => void
}) {
  const statusAction = buildStatusAction(item)

  return (
    <div className="new-user-coupon-table-row">
      <span>{item.typeLabel || buildCouponTypeLabel(normalizeCouponType(item.type))}</span>
      <span className="new-user-coupon-name-cell" title={item.name}>
        {item.name}
      </span>
      <span>{item.amount}</span>
      <span>{formatDateRange(item.validFrom, item.validTo)}</span>
      <span>{`${item.totalQuantity}/${item.usedQuantity}`}</span>
      <span>{String(item.visitCount)}</span>
      <span>
        <span className={`resource-table-chip${buildStatusClass(item)}`}>{getCouponStatusLabel(item)}</span>
      </span>
      <span className="new-user-coupon-actions-cell">
        <button disabled={pending} onClick={() => onEdit(item)} type="button">
          编辑
        </button>
        <button disabled={pending} onClick={() => onCopy(item.code)} type="button">
          复制券码
        </button>
        {statusAction ? (
          <button disabled={pending} onClick={() => onStatusChange(item, statusAction.status)} type="button">
            {statusAction.label}
          </button>
        ) : null}
      </span>
    </div>
  )
}

export function RenewalCouponPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const meta = useMemo(() => buildPageMeta(location.pathname), [location.pathname])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rows, setRows] = useState<RenewalCouponItem[]>([])
  const [groupName, setGroupName] = useState('')
  const [editorMode, setEditorMode] = useState<CouponEditorMode | null>(null)
  const [editingCouponId, setEditingCouponId] = useState('')
  const [editingCouponType, setEditingCouponType] = useState<ManagedCouponType>('RENEWAL')
  const [form, setForm] = useState<CouponFormState>(createEmptyForm)
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingCouponId, setPendingCouponId] = useState('')
  const [page, setPage] = useState(1)
  const [jumpPageInput, setJumpPageInput] = useState('1')

  useEffect(() => {
    if (!groupId) {
      setRows([])
      setGroupName('')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getCouponPageData(groupId, meta.queryType)
      .then((payload) => {
        if (!active) return
        setRows(Array.isArray(payload.rows) ? payload.rows : [])
        setGroupName(payload.group?.name || '')
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载优惠券失败')
        setRows([])
        setGroupName('')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId, meta.queryType])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const sortedRows = useMemo(() => {
    return [...rows].sort((leftItem, rightItem) => {
      if (!meta.queryType) {
        const typeGap =
          Number(normalizeCouponType(leftItem.type) === 'RENEWAL') - Number(normalizeCouponType(rightItem.type) === 'RENEWAL')
        if (typeGap !== 0) {
          return typeGap
        }
      }

      const statusGap = STATUS_RANK[getCouponDisplayStatus(leftItem)] - STATUS_RANK[getCouponDisplayStatus(rightItem)]
      if (statusGap !== 0) {
        return statusGap
      }

      return rightItem.validFrom.localeCompare(leftItem.validFrom)
    })
  }, [meta.queryType, rows])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE)), [sortedRows.length])

  useEffect(() => {
    setPage((currentValue) => Math.min(currentValue, totalPages))
  }, [totalPages])

  useEffect(() => {
    setJumpPageInput(String(page))
  }, [page])

  const visibleRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return sortedRows.slice(startIndex, startIndex + PAGE_SIZE)
  }, [page, sortedRows])

  const totalQuantity = useMemo(() => sortedRows.reduce((sum, item) => sum + item.totalQuantity, 0), [sortedRows])
  const usedQuantity = useMemo(() => sortedRows.reduce((sum, item) => sum + item.usedQuantity, 0), [sortedRows])
  const usageRate = useMemo(() => buildUsageRate(sortedRows), [sortedRows])

  const editingCoupon = useMemo(
    () => rows.find((item) => item.id === editingCouponId) || null,
    [editingCouponId, rows],
  )
  const editorStatusAction = useMemo(() => (editingCoupon ? buildStatusAction(editingCoupon) : null), [editingCoupon])
  const canPublishFromEditor = Boolean(editorMode === 'create' || editorStatusAction?.status === 'ACTIVE')

  function closeEditor(force = false) {
    if (saving && !force) {
      return
    }

    setEditorMode(null)
    setEditingCouponId('')
    setEditingCouponType(meta.allowedCreateTypes[0] || 'RENEWAL')
    setEditorError('')
    setForm(createEmptyForm())
  }

  function handleCreateStart(type: ManagedCouponType) {
    setEditorMode('create')
    setEditingCouponId('')
    setEditingCouponType(type)
    setEditorError('')
    setForm(createEmptyForm())
  }

  function handleEditStart(item: RenewalCouponItem) {
    setEditorMode('edit')
    setEditingCouponId(item.id)
    setEditingCouponType(normalizeCouponType(item.type))
    setEditorError('')
    setForm(buildFormFromCoupon(item))
  }

  function handleFormChange<K extends keyof CouponFormState>(field: K, value: CouponFormState[K]) {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }))
  }

  async function handleCopy(code: string) {
    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setNotice('券码已复制')
    } catch {
      setNotice('复制失败，请手动复制券码')
    }
  }

  async function handleStatusChange(item: RenewalCouponItem, status: CouponStatusAction) {
    if (!groupId) {
      return
    }

    setPendingCouponId(item.id)
    setError('')

    try {
      const response = await updateAdminCouponStatus({
        groupId,
        id: item.id,
        status,
      })
      setRows((currentValue) => upsertCouponRow(currentValue, response.data.row))
      setNotice(status === 'ACTIVE' ? '优惠券已上线' : status === 'PAUSED' ? '优惠券已暂停' : '优惠券已回到草稿')
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : ''
      setError(message || '更新优惠券状态失败，请稍后再试。')
    } finally {
      setPendingCouponId('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldPublish = submitter?.dataset.intent === 'publish'

    if (!groupId) {
      setEditorError('当前没有可管理星球，暂时不能创建优惠券。')
      return
    }

    if (editorMode === 'edit' && !editingCoupon) {
      setEditorError('当前优惠券不存在，请刷新后重试。')
      return
    }

    const name = form.name.trim()
    const amount = form.amount.trim()
    const totalQuantityValue = Number(form.totalQuantity)

    if (!name) {
      setEditorError('请输入优惠券名称。')
      return
    }

    if (!Number.isInteger(Number(amount)) || Number(amount) < 1) {
      setEditorError('面额需要填写不小于 1 的整数。')
      return
    }

    if (!Number.isInteger(totalQuantityValue) || totalQuantityValue < 1) {
      setEditorError('数量需要填写不小于 1 的整数。')
      return
    }

    if (!form.validFrom || !form.validTo) {
      setEditorError('请补齐开始时间和结束时间。')
      return
    }

    if (form.validFrom > form.validTo) {
      setEditorError('结束时间不能早于开始时间。')
      return
    }

    const payload: CouponFormInput = {
      groupId,
      id: editingCoupon?.id,
      type: editingCouponType,
      ...(shouldPublish ? { status: 'ACTIVE' as const } : {}),
      name,
      code: editingCoupon?.code || buildAutoCouponCode(editingCouponType),
      amount,
      totalQuantity: totalQuantityValue,
      validFrom: form.validFrom,
      validTo: form.validTo,
    }

    setSaving(true)
    setEditorError('')

    try {
      const response =
        editorMode === 'edit' && editingCoupon ? await updateAdminCoupon(payload) : await createAdminCoupon(payload)

      setRows((currentValue) => upsertCouponRow(currentValue, response.data.row))
      setNotice(
        shouldPublish ? (editorMode === 'edit' ? '优惠券已更新并上线' : '优惠券已创建并上线') : editorMode === 'edit' ? '优惠券已更新' : '优惠券已创建',
      )
      setPage(1)
      closeEditor(true)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : ''
      setEditorError(message || '保存优惠券失败，请稍后再试。')
    } finally {
      setSaving(false)
    }
  }

  function handleJumpPage() {
    const nextPage = Number(jumpPageInput)
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages) {
      return
    }

    setPage(nextPage)
  }

  const editorTips = buildEditorTips(editingCouponType)

  return (
    <AdminLayout
      title={meta.title}
      subtitle=""
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate('/group_data')}
    >
      <div className="admin-resource-page new-user-coupon-page coupon-reference-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        <div className="new-user-coupon-group-name">{groupName || currentGroup?.name || groupId || '未分配星球'}</div>

        <section className="admin-resource-panel new-user-coupon-panel">
          <div className="new-user-coupon-section-title">数据概览</div>
          <div className="new-user-coupon-overview">
            <div className="new-user-coupon-overview-item">
              <div className="new-user-coupon-overview-label">总发券张数</div>
              <div className="new-user-coupon-overview-value">{String(totalQuantity)}</div>
            </div>
            <div className="new-user-coupon-overview-item is-bordered">
              <div className="new-user-coupon-overview-label">使用张数</div>
              <div className="new-user-coupon-overview-value">{String(usedQuantity)}</div>
            </div>
            <div className="new-user-coupon-overview-item">
              <div className="new-user-coupon-overview-label">使用率</div>
              <div className="new-user-coupon-overview-value">{formatPercent(usageRate)}</div>
            </div>
          </div>
        </section>

        <section className="admin-resource-panel new-user-coupon-panel">
          <div className="new-user-coupon-toolbar">
            <div className="new-user-coupon-section-title">优惠券数据</div>
            <div className="coupon-reference-toolbar-actions">
              {meta.allowedCreateTypes.includes('PROMOTION') ? (
                <button
                  className="new-user-coupon-create-button"
                  disabled={!groupId || loading || groupLoading}
                  onClick={() => handleCreateStart('PROMOTION')}
                  type="button"
                >
                  {buildCreateButtonLabel('PROMOTION')}
                </button>
              ) : null}
              {meta.allowedCreateTypes.includes('RENEWAL') ? (
                <button
                  className="new-user-coupon-create-button"
                  disabled={!groupId || loading || groupLoading}
                  onClick={() => handleCreateStart('RENEWAL')}
                  type="button"
                >
                  {buildCreateButtonLabel('RENEWAL')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="new-user-coupon-table-shell">
            <div className="new-user-coupon-table-head">
              <span>类型</span>
              <span>名称</span>
              <span>面额(元)</span>
              <span>有效期</span>
              <span>总数/已用</span>
              <span className="new-user-coupon-visit-head" title="访问人数仅支持展示 2020 年 1 月 9 日之后的数据">
                访问数
              </span>
              <span>状态</span>
              <span>操作</span>
            </div>

            {loading ? <div className="admin-resource-empty">加载中...</div> : null}

            {!loading && !visibleRows.length ? (
              <div className="new-user-coupon-empty">
                <div className="new-user-coupon-empty-icon" />
                <span>暂时还没有优惠券，点击「新增优惠券」试试吧</span>
              </div>
            ) : null}

            {!loading && visibleRows.length
              ? visibleRows.map((item) => (
                  <CouponRow
                    item={item}
                    key={item.id}
                    onCopy={handleCopy}
                    onEdit={handleEditStart}
                    onStatusChange={handleStatusChange}
                    pending={pendingCouponId === item.id}
                  />
                ))
              : null}

            <div className="new-user-coupon-pagination">
              <div className="new-user-coupon-pagination-main">
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
              <div className="new-user-coupon-pagination-jump">
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

        {editorMode ? (
          <div className="new-user-coupon-modal-backdrop" onClick={() => closeEditor()} role="presentation">
            <div className="new-user-coupon-modal" onClick={(event) => event.stopPropagation()} role="dialog">
              <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="new-user-coupon-modal-header">
                  <div className="new-user-coupon-modal-title">{buildEditorTitle(editorMode, editingCouponType)}</div>
                  <ul className="new-user-coupon-modal-tips">
                    {editorTips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="new-user-coupon-modal-grid">
                  <label className="new-user-coupon-modal-field">
                    <span>优惠券名称</span>
                    <input
                      disabled={saving}
                      maxLength={30}
                      onChange={(event) => handleFormChange('name', event.target.value)}
                      placeholder="请输入 30 个字以内的名称"
                      value={form.name}
                    />
                  </label>

                  <label className="new-user-coupon-modal-field is-short">
                    <span>面额</span>
                    <div className="new-user-coupon-input-with-unit">
                      <input
                        disabled={saving}
                        min={1}
                        onChange={(event) => handleFormChange('amount', event.target.value)}
                        placeholder="请输入不小于 1 的整数"
                        type="number"
                        value={form.amount}
                      />
                      <em>元</em>
                    </div>
                  </label>

                  <label className="new-user-coupon-modal-field is-short">
                    <span>数量</span>
                    <div className="new-user-coupon-input-with-unit">
                      <input
                        disabled={saving}
                        min={1}
                        onChange={(event) => handleFormChange('totalQuantity', event.target.value)}
                        placeholder="请输入不小于 1 的整数"
                        type="number"
                        value={form.totalQuantity}
                      />
                      <em>张</em>
                    </div>
                  </label>

                  <div className="new-user-coupon-modal-field">
                    <span>起止时间</span>
                    <div className="new-user-coupon-date-range">
                      <input
                        disabled={saving}
                        onChange={(event) => handleFormChange('validFrom', event.target.value)}
                        type="date"
                        value={form.validFrom}
                      />
                      <em>至</em>
                      <input
                        disabled={saving}
                        onChange={(event) => handleFormChange('validTo', event.target.value)}
                        type="date"
                        value={form.validTo}
                      />
                    </div>
                  </div>
                </div>

                {editorError ? <div className="new-user-coupon-modal-error">{editorError}</div> : null}

                <div className="new-user-coupon-modal-footer">
                  {editingCouponType === 'PROMOTION' ? (
                    <label className="new-user-coupon-switch-row">
                      <input
                        checked={form.memberOnly}
                        disabled={saving}
                        onChange={(event) => handleFormChange('memberOnly', event.target.checked)}
                        type="checkbox"
                      />
                      <span className="new-user-coupon-switch-track" />
                      <span className="new-user-coupon-switch-label">仅限特定星球的成员专属</span>
                    </label>
                  ) : (
                    <div />
                  )}

                  <div className="new-user-coupon-modal-actions">
                    <button className="is-ghost" disabled={saving} onClick={() => closeEditor()} type="button">
                      取消
                    </button>
                    <button className={canPublishFromEditor ? 'is-ghost' : 'is-primary'} disabled={saving} type="submit">
                      {buildEditorSaveLabel(editorMode)}
                    </button>
                    {canPublishFromEditor ? (
                      <button className="is-primary" data-intent="publish" disabled={saving} type="submit">
                        {buildEditorPublishLabel(editorMode, editorStatusAction?.label)}
                      </button>
                    ) : null}
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
