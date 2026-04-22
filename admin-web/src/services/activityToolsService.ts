import { apiRequest } from './apiClient'

export interface ActivityChallengeItem {
  id: string
  title: string
  status: string
  statusLabel: string
  dayText: string
  validityText: string
  joinedCount: number
  checkinCount: number
  completedCount: number
  heroColor: string
  avatarUrls: string[]
  isJoined: boolean
  primaryActionText: string
  primaryActionDisabled: boolean
  canJoin: boolean
  canCheckin: boolean
}

interface ActivityChallengeResponse {
  ok: true
  data: {
    canCreateChallenge: boolean
    items: ActivityChallengeItem[]
  }
}

export async function getActivityChallenges(groupId: string) {
  const response = await apiRequest<ActivityChallengeResponse>('/api/checkin/challenges', {
    query: {
      groupId,
      status: 'ONGOING',
    },
  })

  return response.data
}
