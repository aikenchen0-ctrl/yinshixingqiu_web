import { pageDataMap } from '../data/menu'
import type { DashboardPageData } from '../types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const defaultPage: DashboardPageData = {
  title: '功能建设中',
  subtitle: '这页已经纳入真实后台菜单，下一轮会补细节交互和数据联调。',
  pageTag: '占位页',
  notices: ['当前页面先保留框架位置，方便后续逐页替换成真实业务组件。'],
}

export async function getDashboardPageData(pathname: string): Promise<DashboardPageData> {
  await delay(160)

  return pageDataMap[pathname] || {
    ...defaultPage,
    title: `${pathname} 页面`,
  }
}
