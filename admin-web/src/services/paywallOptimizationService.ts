import { apiRequest } from './apiClient'

export interface PaywallHighlightImageInput {
  name: string
  url: string
}

interface AdminPaywallHighlightResponse {
  ok: true
  data: {
    group: {
      id: string
      name: string
      ownerName: string
    }
    images: PaywallHighlightImageInput[]
    updatedAt: string
  }
}

export async function getAdminPaywallHighlights(groupId: string) {
  const response = await apiRequest<AdminPaywallHighlightResponse>('/api/admin/paywall/highlights', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function updateAdminPaywallHighlights(input: { groupId: string; images: PaywallHighlightImageInput[] }) {
  const response = await apiRequest<AdminPaywallHighlightResponse>('/api/admin/paywall/highlights', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.data
}
