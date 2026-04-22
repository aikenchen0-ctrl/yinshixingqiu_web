export function normalizeMallUserFacingErrorMessage(error: unknown, fallbackMessage: string) {
  const rawMessage = error instanceof Error ? String(error.message || '').trim() : ''

  if (!rawMessage) {
    return fallbackMessage
  }

  if (
    rawMessage.includes('明确星球') ||
    rawMessage.includes('mall public group id') ||
    rawMessage.includes('MALL_PUBLIC_GROUP_ID') ||
    rawMessage.includes('没有明确数据源') ||
    rawMessage.includes('多个可用数据源')
  ) {
    return '商城数据源未确定，请确认当前连接的是独立商城后端。'
  }

  if (rawMessage.includes('没有可用数据源')) {
    return '商城还没有可用数据，请先确认商城商品和分类已经配置完成。'
  }

  if (
    rawMessage.includes('request:fail') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('Failed to connect') ||
    rawMessage.includes('请求失败')
  ) {
    return '商城接口暂时不可用，请确认小程序和后台连接的是同一套服务。'
  }

  return rawMessage
}
