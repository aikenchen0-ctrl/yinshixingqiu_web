export interface ModerationNoticeView {
  visible: boolean
  tone: 'warning' | 'success' | 'neutral'
  title: string
  message: string
  meta: string
}

export const createEmptyModerationNotice = (): ModerationNoticeView => ({
  visible: false,
  tone: 'neutral',
  title: '',
  message: '',
  meta: '',
})

export const mapViewerModerationNotice = (post: Record<string, any> | null | undefined): ModerationNoticeView => {
  const moderation =
    post && typeof post === 'object' && post.viewerModeration && typeof post.viewerModeration === 'object'
      ? (post.viewerModeration as Record<string, any>)
      : null

  if (!moderation) {
    return createEmptyModerationNotice()
  }

  const title = typeof moderation.title === 'string' ? moderation.title.trim() : ''
  const message = typeof moderation.message === 'string' ? moderation.message.trim() : ''
  if (!title && !message) {
    return createEmptyModerationNotice()
  }

  const toneValue = typeof moderation.tone === 'string' ? moderation.tone.trim() : ''
  const tone: ModerationNoticeView['tone'] =
    toneValue === 'warning' || toneValue === 'success' ? toneValue : 'neutral'

  const metaParts: string[] = []
  const statusLabel = typeof moderation.statusLabel === 'string' ? moderation.statusLabel.trim() : ''
  const reviewStatus = typeof moderation.reviewStatus === 'string' ? moderation.reviewStatus.trim() : ''
  const reviewStatusLabel = typeof moderation.reviewStatusLabel === 'string' ? moderation.reviewStatusLabel.trim() : ''
  const reportStatusLabel = typeof moderation.reportStatusLabel === 'string' ? moderation.reportStatusLabel.trim() : ''
  const reportTotal = Number(moderation.reportTotal || 0)
  const reportPendingCount = Number(moderation.reportPendingCount || 0)

  if (statusLabel) {
    metaParts.push(`内容状态 ${statusLabel}`)
  }

  if (reviewStatus && reviewStatus !== 'UNSET' && reviewStatusLabel) {
    metaParts.push(`审核 ${reviewStatusLabel}`)
  }

  if (reportTotal > 0 && reportStatusLabel) {
    metaParts.push(
      reportPendingCount > 0 ? `${reportStatusLabel} · 待处理 ${reportPendingCount}` : `${reportStatusLabel} · 共 ${reportTotal} 条`
    )
  }

  return {
    visible: true,
    tone,
    title: title || '内容状态已更新',
    message: message || '当前内容状态有变更，请留意后续处理结果。',
    meta: metaParts.join(' ｜ '),
  }
}
