import { apiRequest } from './apiClient'

export interface AdminManageableGroupCapabilities {
  canViewDashboard: boolean
  canViewIncome: boolean
  canViewMemberContact: boolean
  canViewWeeklyReport: boolean
  canManageMembers: boolean
  canManageContent: boolean
  canEditPermissions: boolean
}

export interface AdminManageableGroupItem {
  id: string
  name: string
  slug: string
  ownerName: string
  memberCount: number
  role: string
  roleLabel: string
  isOwner: boolean
  status: string
  createdAt: string
  publishedAt: string
  capabilities: AdminManageableGroupCapabilities
}

export interface AdminManageableGroupsPayload {
  groups: AdminManageableGroupItem[]
  total: number
  defaultGroupId: string
}

interface AdminManageableGroupsResponse {
  ok: boolean
  data: AdminManageableGroupsPayload
}

export async function getAdminManageableGroups() {
  const response = await apiRequest<AdminManageableGroupsResponse>('/api/admin/groups')
  return response.data
}
