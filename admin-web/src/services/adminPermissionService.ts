import { apiRequest } from './apiClient'
import type { AdminViewerSummary } from './adminResourceService'

export interface AdminPermissionRoleItem {
  id: string
  userId: string
  nickname: string
  role: string
  roleLabel: string
  isActive: boolean
}

export interface AdminPermissionsPayload {
  ok: true
  data: {
    group: {
      id: string
      name: string
      ownerName: string
      memberCount: number
    }
    viewer: AdminViewerSummary
    roles: AdminPermissionRoleItem[]
    permissions: {
      dashboard: { partner: boolean; admin: boolean }
      income: { partner: boolean; admin: boolean }
      memberContact: { partner: boolean; admin: boolean }
      weeklyReport: { partner: boolean; admin: boolean }
    }
    payments: {
      allowStarCoinJoin: boolean
      allowStarCoinRenewal: boolean
      allowVirtualPayJoin: boolean
      allowVirtualPayRenewal: boolean
    }
    joinSettings: {
      allowJoin: boolean
      needExamine: boolean
      allowPreview: boolean
      allowSearch: boolean
    }
  }
}

export interface UpdateAdminPermissionsInput {
  groupId: string
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

export async function getAdminPermissions(groupId: string) {
  return apiRequest<AdminPermissionsPayload>('/api/admin/permissions', {
    query: {
      groupId,
    },
  })
}

export async function updateAdminPermissions(input: UpdateAdminPermissionsInput) {
  return apiRequest<AdminPermissionsPayload>('/api/admin/permissions', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
