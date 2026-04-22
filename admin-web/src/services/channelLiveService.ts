import { apiRequest, downloadApiFile } from './apiClient'

export interface ChannelLivePagePayload {
  group: {
    id: string
    name: string
    ownerName: string
  }
  summary: {
    currentMemberCount: number
    validMemberCount: number
    exportableAllMemberCount: number
    exportableValidMemberCount: number
    missingOpenIdAllCount: number
    missingOpenIdValidCount: number
    lastExportedAt: string
    lastExportFileName: string
    lastExportOnlyValidMembers: boolean | null
  }
}

interface ChannelLivePageResponse {
  ok: true
  data: ChannelLivePagePayload
}

export async function getChannelLivePageData(groupId: string) {
  const response = await apiRequest<ChannelLivePageResponse>('/api/admin/channel-live', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function downloadChannelLiveMemberList(groupId: string, onlyValidMembers = true) {
  return downloadApiFile('/api/admin/channel-live/export', {
    query: {
      groupId,
      onlyValidMembers,
    },
    headers: {
      Accept: 'text/csv',
    },
    fallbackFileName: 'video-live-member-list.csv',
  })
}
