import { apiRequest } from './apiClient'

export interface AdminScoreboardRuleItem {
  eventType: string
  label: string
  score: number
}

export interface AdminScoreboardMemberItem {
  id: string
  userId: string
  nickname: string
  avatarUrl: string
  roleLabel: string
  status: string
  statusLabel: string
  rank: number
  totalScore: number
  postCount: number
  commentCount: number
  checkinCount: number
  assignmentCount: number
  likeReceived: number
  lastActiveAt: string
  joinedAt: string
}

export interface AdminScoreboardPayload {
  ok: true
  data: {
    group: {
      id: string
      name: string
      ownerName: string
    }
    filters: {
      memberStatus: string
      search: string
      rangeDays: number
    }
    settings: {
      enabled: boolean
      enabledHonor: boolean
      excludePrivilegeUser: boolean
      rulesUpdatedAt: string
    }
    summary: {
      trackedMembers: number
      scoredMembers: number
      totalScore: number
      averageScore: number
      topScore: number
      topMemberName: string
    }
    rules: AdminScoreboardRuleItem[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
    items: AdminScoreboardMemberItem[]
  }
}

export interface AdminScoreboardQuery {
  groupId?: string
  memberStatus?: string
  search?: string
  rangeDays?: number
  page?: number
  pageSize?: number
}

export interface UpdateAdminScoreboardInput {
  groupId: string
  rules: Array<{
    eventType: AdminScoreboardRuleItem['eventType']
    score: number
  }>
}

export async function getAdminScoreboard(query: AdminScoreboardQuery = {}) {
  return apiRequest<AdminScoreboardPayload>('/api/admin/scoreboard', {
    query: {
      groupId: query.groupId,
      memberStatus: query.memberStatus || 'ACTIVE',
      search: query.search || '',
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })
}

export async function updateAdminScoreboard(input: UpdateAdminScoreboardInput) {
  return apiRequest<AdminScoreboardPayload>('/api/admin/scoreboard', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
