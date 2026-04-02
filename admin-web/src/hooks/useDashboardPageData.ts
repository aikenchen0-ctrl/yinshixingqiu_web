import { useEffect, useState } from 'react'
import { getDashboardPageData } from '../services/adminService'
import type { AsyncState, DashboardPageData } from '../types'

export function useDashboardPageData(pathname: string): AsyncState<DashboardPageData> {
  const [state, setState] = useState<AsyncState<DashboardPageData>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true

    setState({
      data: null,
      loading: true,
      error: null,
    })

    getDashboardPageData(pathname)
      .then((data) => {
        if (!active) return
        setState({
          data,
          loading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : '页面数据加载失败',
        })
      })

    return () => {
      active = false
    }
  }, [pathname])

  return state
}
