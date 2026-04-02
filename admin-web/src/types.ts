export type MenuGroupKey =
  | 'income'
  | 'promotion'
  | 'activity'
  | 'renewal'
  | 'tools'
  | 'permissions'

export interface MenuLeaf {
  label: string
  path: string
  badge?: string
}

export interface MenuGroup {
  key: MenuGroupKey
  label: string
  icon: string
  path?: string
  children?: MenuLeaf[]
}

export interface StatCardItem {
  label: string
  value: string
  hint: string
}

export interface TableColumn {
  key: string
  label: string
}

export interface TableRow {
  [key: string]: string
}

export interface DashboardPageData {
  title: string
  subtitle: string
  pageTag?: string
  stats?: StatCardItem[]
  secondaryStats?: StatCardItem[]
  chartTitle?: string
  chartHint?: string
  chartPoints?: number[]
  tableTitle?: string
  tableHint?: string
  tableColumns?: TableColumn[]
  tableRows?: TableRow[]
  notices?: string[]
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}
