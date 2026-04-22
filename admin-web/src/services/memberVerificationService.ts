import { apiRequest } from './apiClient'

export interface MemberVerificationSampleItem {
  id: string
  memberNo: number | null
  nickname: string
  mobile: string
  wechatNo: string
  status: string
  statusLabel: string
  isPaid: boolean
  expireAt: string
  joinedAt: string
}

export interface MemberVerificationStatusBucket {
  status: string
  label: string
  count: number
}

export interface MemberVerificationPayload {
  ok: true
  data: {
    group: {
      id: string
      name: string
      ownerName: string
    }
    summary: {
      activeCount: number
      paidCount: number
      totalCount: number
      snapshotCount: number
      activeRate: number
      statusBuckets: MemberVerificationStatusBucket[]
    }
    docs: {
      endpoint: string
      method: string
      requiresLogin: boolean
      supportedFields: string[]
    }
    verification: {
      matched: boolean
      message: string
      memberId?: string
      userId?: string
      memberNo?: number | null
      nickname?: string
      mobile?: string
      wechatNo?: string
      status?: string
      statusLabel?: string
      isActive?: boolean
      isPaid?: boolean
      expireAt?: string
      joinedAt?: string
    }
    sampleMembers: MemberVerificationSampleItem[]
  }
}

export interface PublicMemberVerificationCheckPayload {
  ok: true
  data: {
    groupId: string
    groupName: string
    verifyType: string
    keyword: string
    matched: boolean
    member: {
      memberNo: number | null
      nickname: string
      status: string
      statusLabel: string
      isActive: boolean
      isPaid: boolean
      expireAt: string
      joinedAt: string
    } | null
    message: string
  }
}

export async function getMemberVerificationOverview(groupId: string, verifyType?: string, keyword?: string) {
  return apiRequest<MemberVerificationPayload>('/api/admin/member-verification', {
    query: {
      groupId,
      verifyType: verifyType || '',
      keyword: keyword || '',
    },
  })
}

export async function getPublicMemberVerificationCheck(groupId: string, verifyType: string, keyword: string) {
  return apiRequest<PublicMemberVerificationCheckPayload>('/api/member-verification/check', {
    query: {
      groupId,
      verifyType,
      keyword,
    },
  })
}
