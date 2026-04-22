import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'
import {
  getAdminPermissions,
  updateAdminPermissions,
  type AdminPermissionsPayload,
} from '../../services/adminPermissionService'

type PermissionFormState = {
  dashboardPartner: boolean
  dashboardAdmin: boolean
  incomePartner: boolean
  incomeAdmin: boolean
  memberContactPartner: boolean
  memberContactAdmin: boolean
  weeklyReportPartner: boolean
  weeklyReportAdmin: boolean
  allowStarCoinJoin: boolean
  allowStarCoinRenewal: boolean
  allowVirtualPayJoin: boolean
  allowVirtualPayRenewal: boolean
  allowJoin: boolean
  needExamine: boolean
  allowPreview: boolean
  allowSearch: boolean
}

type PermissionFieldKey = keyof PermissionFormState

const emptyFormState: PermissionFormState = {
  dashboardPartner: false,
  dashboardAdmin: false,
  incomePartner: false,
  incomeAdmin: false,
  memberContactPartner: false,
  memberContactAdmin: false,
  weeklyReportPartner: false,
  weeklyReportAdmin: false,
  allowStarCoinJoin: false,
  allowStarCoinRenewal: false,
  allowVirtualPayJoin: false,
  allowVirtualPayRenewal: false,
  allowJoin: false,
  needExamine: false,
  allowPreview: false,
  allowSearch: false,
}

const permissionMatrixItems: Array<{
  label: string
  description: string
  partnerField: PermissionFieldKey
  adminField: PermissionFieldKey
}> = [
  {
    label: '查看管理后台数据（不含收入数据）',
    description: '查看管理后台的“管理后台数据（不含收入数据）”。',
    partnerField: 'dashboardPartner',
    adminField: 'dashboardAdmin',
  },
  {
    label: '查看收入数据',
    description: '对应“收入数据、推广数据、成员活跃、续期数据”里的收入相关字段。',
    partnerField: 'incomePartner',
    adminField: 'incomeAdmin',
  },
  {
    label: '查看成员手机号和微信号',
    description: '成员活跃报表中手机号、微信号等敏感字段。',
    partnerField: 'memberContactPartner',
    adminField: 'memberContactAdmin',
  },
  {
    label: '查看星球周报',
    description: '与真实后台“查看星球周报”一致。',
    partnerField: 'weeklyReportPartner',
    adminField: 'weeklyReportAdmin',
  },
]

const paymentSwitchItems: Array<{
  label: string
  field: PermissionFieldKey
}> = [
  {
    label: '允许使用「星球币」加入星球',
    field: 'allowStarCoinJoin',
  },
  {
    label: '允许使用「星球币」续期星球',
    field: 'allowStarCoinRenewal',
  },
  {
    label: '允许使用「虚拟支付」加入星球',
    field: 'allowVirtualPayJoin',
  },
  {
    label: '允许使用「虚拟支付」续期星球',
    field: 'allowVirtualPayRenewal',
  },
]

const joinSwitchItems: Array<{
  label: string
  description?: string
  field: PermissionFieldKey
}> = [
  {
    label: '允许加入星球',
    description: '关闭后用户一律不可主动加入当前星球。',
    field: 'allowJoin',
  },
  {
    label: '加入需审核',
    description: '审核样本星球会校验创建-公开-发布流程是否覆盖这条链路。',
    field: 'needExamine',
  },
  {
    label: '允许预览星球',
    description: '关闭后星球对外只保留最小化访问能力。',
    field: 'allowPreview',
  },
  {
    label: '允许在发现页搜索到该星球',
    description: '关闭后发现页和搜索结果都不会暴露当前星球。',
    field: 'allowSearch',
  },
]

function createFormState(data: AdminPermissionsPayload['data']): PermissionFormState {
  return {
    dashboardPartner: data.permissions.dashboard.partner,
    dashboardAdmin: data.permissions.dashboard.admin,
    incomePartner: data.permissions.income.partner,
    incomeAdmin: data.permissions.income.admin,
    memberContactPartner: data.permissions.memberContact.partner,
    memberContactAdmin: data.permissions.memberContact.admin,
    weeklyReportPartner: data.permissions.weeklyReport.partner,
    weeklyReportAdmin: data.permissions.weeklyReport.admin,
    allowStarCoinJoin: data.payments.allowStarCoinJoin,
    allowStarCoinRenewal: data.payments.allowStarCoinRenewal,
    allowVirtualPayJoin: data.payments.allowVirtualPayJoin,
    allowVirtualPayRenewal: data.payments.allowVirtualPayRenewal,
    allowJoin: data.joinSettings.allowJoin,
    needExamine: data.joinSettings.needExamine,
    allowPreview: data.joinSettings.allowPreview,
    allowSearch: data.joinSettings.allowSearch,
  }
}

function PermissionRow({
  disabled = false,
  label,
  description,
  partnerValue,
  adminValue,
  onPartnerChange,
  onAdminChange,
}: {
  disabled?: boolean
  label: string
  description?: string
  partnerValue: boolean
  adminValue: boolean
  onPartnerChange: (nextValue: boolean) => void
  onAdminChange: (nextValue: boolean) => void
}) {
  return (
    <div className="permission-matrix-row">
      <div className="permission-matrix-copy">
        <div className="permission-matrix-label">{label}</div>
        {description ? <div className="permission-matrix-description">{description}</div> : null}
      </div>
      <label className={`permission-checkbox${disabled ? ' is-disabled' : ''}`}>
        <input checked={partnerValue} disabled={disabled} onChange={(event) => onPartnerChange(event.target.checked)} type="checkbox" />
        <span>合伙人</span>
      </label>
      <label className={`permission-checkbox${disabled ? ' is-disabled' : ''}`}>
        <input checked={adminValue} disabled={disabled} onChange={(event) => onAdminChange(event.target.checked)} type="checkbox" />
        <span>管理员 / 运营</span>
      </label>
    </div>
  )
}

function SwitchRow({
  disabled = false,
  label,
  description,
  checked,
  onChange,
}: {
  disabled?: boolean
  label: string
  description?: string
  checked: boolean
  onChange: (nextValue: boolean) => void
}) {
  return (
    <label className="permission-switch-row">
      <div>
        <div className="permission-matrix-label">{label}</div>
        {description ? <div className="permission-matrix-description">{description}</div> : null}
      </div>
      <span className={`permission-switch${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
        <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span className="permission-switch-track" />
      </span>
    </label>
  )
}

function buildChangedPermissionSections(formState: PermissionFormState, baseState: PermissionFormState) {
  const changedSections: string[] = []

  if (
    formState.dashboardPartner !== baseState.dashboardPartner ||
    formState.dashboardAdmin !== baseState.dashboardAdmin ||
    formState.incomePartner !== baseState.incomePartner ||
    formState.incomeAdmin !== baseState.incomeAdmin ||
    formState.memberContactPartner !== baseState.memberContactPartner ||
    formState.memberContactAdmin !== baseState.memberContactAdmin ||
    formState.weeklyReportPartner !== baseState.weeklyReportPartner ||
    formState.weeklyReportAdmin !== baseState.weeklyReportAdmin
  ) {
    changedSections.push('后台权限矩阵')
  }

  if (
    formState.allowStarCoinJoin !== baseState.allowStarCoinJoin ||
    formState.allowVirtualPayJoin !== baseState.allowVirtualPayJoin
  ) {
    changedSections.push('加入支付方式')
  }

  if (
    formState.allowStarCoinRenewal !== baseState.allowStarCoinRenewal ||
    formState.allowVirtualPayRenewal !== baseState.allowVirtualPayRenewal
  ) {
    changedSections.push('续期支付方式')
  }

  if (
    formState.allowJoin !== baseState.allowJoin ||
    formState.needExamine !== baseState.needExamine ||
    formState.allowPreview !== baseState.allowPreview ||
    formState.allowSearch !== baseState.allowSearch
  ) {
    changedSections.push('加入与搜索')
  }

  return changedSections
}

export function PermissionSettingsPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [data, setData] = useState<AdminPermissionsPayload['data'] | null>(null)
  const [formState, setFormState] = useState<PermissionFormState>(emptyFormState)

  useEffect(() => {
    if (!groupId) {
      setData(null)
      setFormState(emptyFormState)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    getAdminPermissions(groupId)
      .then((payload) => {
        if (!active) return
        setData(payload.data)
        setFormState(createFormState(payload.data))
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载权限设置失败')
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
    if (!notice) return
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  const baseFormState = useMemo(() => (data ? createFormState(data) : emptyFormState), [data])
  const isDirty = useMemo(() => {
    if (!data) return false
    return JSON.stringify(formState) !== JSON.stringify(baseFormState)
  }, [baseFormState, data, formState])
  const canEditPermissions = data?.viewer.capabilities.canEditPermissions ?? currentGroup?.isOwner ?? false
  const changedSections = useMemo(
    () => (data ? buildChangedPermissionSections(formState, baseFormState) : []),
    [baseFormState, data, formState],
  )

  const confirmDiscardPermissionChanges = useCallback(() => {
    if (!canEditPermissions || !isDirty) {
      return true
    }

    return window.confirm('当前权限设置尚未保存，离开本页会丢失修改。是否继续？')
  }, [canEditPermissions, isDirty])

  const visibleRoles = useMemo(
    () =>
      (data?.roles || []).filter(
        (item) => item.role === 'OWNER' || item.role === 'PARTNER' || item.role === 'ADMIN' || item.role === 'OPERATOR',
      ),
    [data?.roles],
  )

  useEffect(() => {
    if (!canEditPermissions || !isDirty) {
      return undefined
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [canEditPermissions, isDirty])

  function updateField<K extends keyof PermissionFormState>(key: K, value: PermissionFormState[K]) {
    if (!canEditPermissions) {
      return
    }

    setFormState((currentValue) => ({
      ...currentValue,
      [key]: value,
    }))
  }

  function handleResetForm() {
    if (!data || !canEditPermissions || !isDirty) return

    if (!window.confirm('确定恢复为当前已保存的权限设置吗？未保存修改会被清空。')) {
      return
    }

    setError('')
    setNotice('已恢复为当前已保存设置')
    setFormState(baseFormState)
  }

  async function handleSave() {
    if (!data || !canEditPermissions) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const payload = await updateAdminPermissions({
        groupId: data.group.id,
        ...formState,
      })
      setData(payload.data)
      setFormState(createFormState(payload.data))
      setNotice('权限设置已保存')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存权限设置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout
      title="权限设置（仅星主可以设置）"
      subtitle="先对齐真实后台里的权限矩阵、支付开关和加入条件，再把 groupId、角色、数据库字段连成闭环。"
      tag="系统权限"
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
      onBeforeLeavePage={confirmDiscardPermissionChanges}
      onBeforeGroupChange={(nextGroupId) => {
        if (!canEditPermissions || !isDirty || nextGroupId === groupId) {
          return true
        }

        return confirmDiscardPermissionChanges()
      }}
    >
      <div className="permission-page permission-page-reference">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {!loading && hasGroups && !canEditPermissions ? (
          <div className="admin-inline-tip">当前角色可查看权限配置，但只有星主可以修改并保存。</div>
        ) : null}
        {!loading && hasGroups && canEditPermissions && isDirty ? (
          <div className="admin-inline-tip">
            {`当前权限修改尚未保存，已改动 ${changedSections.length} 项分组：${changedSections.join(' / ')}。切换菜单、返回上一页或切换到旧数据后台前会要求确认。`}
          </div>
        ) : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {hasGroups ? (
          <>
            <section className="admin-resource-panel permission-summary-panel permission-reference-panel">
              <div className="permission-summary-copy">
                <div className="permission-summary-title">{data?.group.name || currentGroup?.name || groupId}</div>
                <div className="permission-summary-meta">
                  <span>星主：{data?.group.ownerName || currentGroup?.ownerName || '-'}</span>
                  <span>有效成员：{data?.group.memberCount ?? currentGroup?.memberCount ?? 0}</span>
                  <span>groupId：{groupId}</span>
                </div>
              </div>
              <div className="permission-summary-actions">
                <button
                  className="admin-resource-submit permission-summary-submit"
                  disabled={loading || saving || !isDirty || !canEditPermissions}
                  onClick={handleSave}
                  type="button"
                >
                  {saving ? '保存中...' : canEditPermissions ? '保存设置' : '仅星主可保存'}
                </button>
                {isDirty && canEditPermissions ? (
                  <button
                    className="permission-summary-reset"
                    disabled={loading || saving}
                    onClick={handleResetForm}
                    type="button"
                  >
                    恢复当前设置
                  </button>
                ) : null}
              </div>
            </section>

            <section className="admin-resource-panel permission-role-panel permission-reference-panel">
              <div className="permission-section-title">当前角色</div>
              <div className="permission-section-hint">运营角色沿用“管理员 / 运营”这一列权限，只开放日常运营动作，不开放权限保存能力。</div>
              <div className="permission-role-list">
                {visibleRoles.map((item) => (
                  <article className="permission-role-card" key={item.id}>
                    <div className="permission-role-tag">{item.roleLabel}</div>
                    <div className="permission-role-name">{item.nickname}</div>
                    <div className="permission-role-meta">{item.userId}</div>
                    {item.role === 'OPERATOR' ? <div className="permission-role-permission-hint">沿用管理员权限</div> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-resource-panel permission-reference-panel permission-matrix-panel">
              <div className="permission-section-title">后台权限矩阵</div>
              {loading ? <div className="admin-resource-empty">加载中...</div> : null}

              {!loading ? (
                <div className="permission-matrix">
                  <div className="permission-matrix-head">
                    <span>设置项</span>
                    <span>合伙人</span>
                    <span>管理员 / 运营</span>
                  </div>
                  {permissionMatrixItems.map((item) => (
                    <PermissionRow
                      key={item.label}
                      adminValue={formState[item.adminField]}
                      disabled={!canEditPermissions}
                      description={item.description}
                      label={item.label}
                      onAdminChange={(value) => updateField(item.adminField, value)}
                      onPartnerChange={(value) => updateField(item.partnerField, value)}
                      partnerValue={formState[item.partnerField]}
                    />
                  ))}
                </div>
              ) : null}
            </section>

            <section className="permission-grid permission-reference-grid">
              <section className="admin-resource-panel permission-switch-panel permission-reference-panel">
                <div className="permission-section-title">支付方式</div>
                {paymentSwitchItems.map((item) => (
                  <SwitchRow
                    key={item.label}
                    checked={formState[item.field]}
                    disabled={!canEditPermissions}
                    label={item.label}
                    onChange={(value) => updateField(item.field, value)}
                  />
                ))}
              </section>

              <section className="admin-resource-panel permission-switch-panel permission-reference-panel">
                <div className="permission-section-title">加入与搜索</div>
                {joinSwitchItems.map((item) => (
                  <SwitchRow
                    key={item.label}
                    checked={formState[item.field]}
                    disabled={!canEditPermissions}
                    description={item.description}
                    label={item.label}
                    onChange={(value) => updateField(item.field, value)}
                  />
                ))}
              </section>
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
