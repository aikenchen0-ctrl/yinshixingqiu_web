import { apiRequest, downloadApiFile } from './apiClient'

export type AdminMemberSourceType = 'ALL' | 'MEMBER' | 'APPLICATION'

export interface AdminPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AdminViewerCapabilities {
  canViewDashboard: boolean
  canViewIncome: boolean
  canViewMemberContact: boolean
  canViewWeeklyReport: boolean
  canManageMembers: boolean
  canManageContent: boolean
  canEditPermissions: boolean
}

export interface AdminViewerSummary {
  userId: string
  role: string
  roleLabel: string
  isOwner: boolean
  capabilities: AdminViewerCapabilities
}

export interface AdminMemberTrendItem {
  date: string
  label: string
  totalMemberCount: number
  activeMemberCount7d: number
  appDownloadedCount: number
  weeklyActiveRate: number
  appDownloadRate: number
}

export interface AdminMemberItem {
  id: string
  userId: string
  memberNo: number | null
  nickname: string
  avatarUrl: string
  mobile: string
  phone: string
  wechatNo: string
  remark: string
  roleLabel: string
  status: string
  statusLabel: string
  approvalStatus?: string
  approvalStatusLabel?: string
  sourceType?: 'MEMBER' | 'APPLICATION'
  orderNo?: string
  reviewReason?: string
  reviewedAt?: string
  appliedAt?: string
  lastReappliedAt?: string
  reapplyCount?: number
  isPaid: boolean
  joinSource: string
  joinedAt: string
  firstJoinedAt: string
  expireAt: string
  lastActiveAt: string
  renewTimes: number
  topicCount: number
  isExpiringSoon: boolean
  canRemove?: boolean
  removeDisabledReason?: string
  canApprove?: boolean
  canReject?: boolean
}

export interface AdminMemberOverviewSummary {
  totalCurrent: number
  totalJoinedYesterday: number
  paidCurrent: number
  paidJoinedYesterday: number
  freeCurrent: number
  freeJoinedYesterday: number
  quitTotal: number
  quitYesterday: number
}

export interface AdminMemberActivitySummary {
  totalCurrent: number
  weeklyActiveCount: number
  weeklyActiveRate: number
  monthActiveCount: number
  validMonthActiveCount: number
  expiredMonthActiveCount: number
  appDownloadedCount: number
  appDownloadRate: number
}

export interface AdminContentTrendItem {
  date: string
  label: string
  topicCount: number
  fileCount: number
  imageCount: number
  commentCount: number
  likeCount: number
}

export interface AdminContentReportLog {
  id: string
  reporterUserId: string
  reporterName: string
  reason: string
  status: string
  statusLabel: string
  createdAt: string
  resolvedAt: string
  resolutionNote: string
}

export interface AdminContentItem {
  id: string
  title: string
  summary: string
  authorName: string
  authorAvatarUrl: string
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  reviewStatus: string
  reviewStatusLabel: string
  reviewReason: string
  reportStatus: string
  reportStatusLabel: string
  reportTotal: number
  reportPendingCount: number
  reportResolvedCount: number
  reportIgnoredCount: number
  latestReportReason: string
  latestReportedAt: string
  reportResolutionNote: string
  reportLogs: AdminContentReportLog[]
  isPinned: boolean
  isEssence: boolean
  readingCount: number
  likeCount: number
  commentCount: number
  columnId: string
  columnTitle: string
  answerStatus: string
  attachments: string[]
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface AdminColumnItem {
  id: string
  title: string
  count: number
}

export interface AdminContentOverviewSummary {
  topicTotal: number
  topicAddedYesterday: number
  fileTotal: number
  fileAddedYesterday: number
  imageTotal: number
  imageAddedYesterday: number
  commentTotal: number
  commentAddedYesterday: number
  likeTotal: number
  likeAddedYesterday: number
}

export interface AdminContentRangeSummary {
  topicCount: number
  fileCount: number
  imageCount: number
  commentCount: number
  likeCount: number
}

export interface AdminContentFilteredSummary {
  total: number
  published: number
  hidden: number
  draft: number
  deleted: number
  topicTotal: number
  article: number
  notice: number
  fileTotal: number
  imageTotal: number
  commentTotal: number
  likeTotal: number
  columnCount: number
}

export interface AdminMembersPayload {
  ok: true
  data: {
    group: { id: string; name: string; ownerName: string }
    viewer: AdminViewerSummary
    filters: {
      status: string
      sourceType: AdminMemberSourceType
      search: string
      startDate: string
      endDate: string
      rangeDays: number
    }
    summary: {
      total: number
      active: number
      expired: number
      banned: number
      quit: number
      paid: number
      pendingApproval: number
      rejectedApproval: number
      applicationTotal: number
      reappliedApproval: number
      urgentPendingApproval: number
      latestApplicationSubmittedAt: string
      oldestPendingApplicationAt: string
      latestReappliedAt: string
      weeklyActiveCount: number
      weeklyActiveRate: number
      appDownloadedCount: number
      appDownloadRate: number
      overview: AdminMemberOverviewSummary
      activity: AdminMemberActivitySummary
    }
    trend: AdminMemberTrendItem[]
    pagination: AdminPagination
    items: AdminMemberItem[]
  }
}

export interface AdminContentPayload {
  ok: true
  data: {
    group: { id: string; name: string; ownerName: string }
    viewer: AdminViewerSummary
    filters: {
      status: string
      type: string
      reviewStatus: string
      reportStatus: string
      columnId: string
      search: string
      startDate: string
      endDate: string
      rangeDays: number
    }
    summary: {
      total: number
      published: number
      hidden: number
      draft: number
      deleted: number
      topic: number
      article: number
      notice: number
      fileCount: number
      imageCount: number
      commentCount: number
      likeCount: number
      reportPending: number
      reportResolved: number
      reportIgnored: number
      reportTotal: number
      latestReportedAt: string
      trendTopicCount: number
      filtersApplied: boolean
      filtered: AdminContentFilteredSummary
      overview: AdminContentOverviewSummary
      range: AdminContentRangeSummary
    }
    interactionTrend: AdminContentTrendItem[]
    pagination: AdminPagination
    items: AdminContentItem[]
  }
}

export interface AdminResourceQuery {
  groupId?: string
  status?: string
  sourceType?: AdminMemberSourceType
  type?: string
  reviewStatus?: string
  reportStatus?: string
  columnId?: string
  search?: string
  startDate?: string
  endDate?: string
  rangeDays?: number
  page?: number
  pageSize?: number
}

export interface UpdateAdminContentInput {
  postId: string
  status?: string
  reviewStatus?: string
  reviewReason?: string
  reportStatus?: string
  reportResolutionNote?: string
  isPinned?: boolean
  isEssence?: boolean
  columnId?: string
}

export interface UpdateAdminMemberReviewInput {
  groupId: string
  orderNo: string
  action: 'APPROVE' | 'REJECT'
  reviewReason?: string
}

export interface UpdateAdminMemberStatusInput {
  groupId: string
  memberId: string
  status: 'QUIT'
}

export type AdminExportScope = 'current' | 'all'

export async function getAdminMembers(query: AdminResourceQuery = {}) {
  return apiRequest<AdminMembersPayload>('/api/admin/members', {
    query: {
      groupId: query.groupId,
      status: query.status || 'ALL',
      sourceType: query.sourceType || 'ALL',
      search: query.search || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })
}

export async function getAdminContent(query: AdminResourceQuery = {}) {
  return apiRequest<AdminContentPayload>('/api/admin/content', {
    query: {
      groupId: query.groupId,
      status: query.status || 'ALL',
      type: query.type || 'ALL',
      reviewStatus: query.reviewStatus || 'ALL',
      reportStatus: query.reportStatus || 'ALL',
      columnId: query.columnId || '',
      search: query.search || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })
}

export async function getAdminColumns(groupId: string) {
  return apiRequest<{
    ok: true
    data: {
      groupId: string
      groupName: string
      canCreateColumn: boolean
      totalColumns: number
      items: AdminColumnItem[]
    }
  }>('/api/planets/columns', {
    query: {
      groupId,
    },
  })
}

export async function createAdminColumn(groupId: string, title: string) {
  return apiRequest<{
    ok: true
    data: {
      id: string
      groupId: string
      title: string
      sortOrder: number
    }
  }>('/api/planets/columns', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      title,
    }),
  })
}

export async function updateAdminMemberReview(input: UpdateAdminMemberReviewInput) {
  return apiRequest<{
    ok: true
    data: {
      action: string
      orderNo: string
      membershipStatus: string
      idempotent: boolean
    }
  }>('/api/admin/members', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function updateAdminMemberStatus(input: UpdateAdminMemberStatusInput) {
  return apiRequest<{
    ok: true
    data: {
      memberId: string
      membershipStatus: string
      idempotent: boolean
    }
  }>('/api/admin/members/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function updateAdminContent(input: UpdateAdminContentInput) {
  return apiRequest<{ ok: true; data: AdminContentItem }>('/api/admin/content', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function downloadAdminMembersExport(query: AdminResourceQuery = {}, scope: AdminExportScope = 'current') {
  return downloadApiFile('/api/admin/members/export', {
    query: {
      groupId: query.groupId,
      status: query.status || 'ALL',
      sourceType: query.sourceType || 'ALL',
      search: query.search || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      scope,
    },
    headers: {
      Accept: 'text/csv',
    },
    fallbackFileName: 'member-report.csv',
  })
}

export async function downloadAdminContentExport(query: AdminResourceQuery = {}, scope: AdminExportScope = 'all') {
  return downloadApiFile('/api/admin/content/export', {
    query: {
      groupId: query.groupId,
      status: query.status || 'ALL',
      type: query.type || 'ALL',
      reviewStatus: query.reviewStatus || 'ALL',
      reportStatus: query.reportStatus || 'ALL',
      columnId: query.columnId || '',
      search: query.search || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      scope,
    },
    headers: {
      Accept: 'text/csv',
    },
    fallbackFileName: 'content-report.csv',
  })
}
