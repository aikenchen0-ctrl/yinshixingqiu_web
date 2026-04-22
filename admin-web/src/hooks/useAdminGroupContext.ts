import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  getAdminManageableGroups,
  type AdminManageableGroupItem,
  type AdminManageableGroupsPayload,
} from '../services/adminGroupService'

function resolveActiveGroup(
  requestedGroupId: string,
  payload: AdminManageableGroupsPayload | null,
): AdminManageableGroupItem | null {
  const groups = payload?.groups || []
  if (!groups.length) {
    return null
  }

  return (
    groups.find((item) => item.id === requestedGroupId) ||
    groups.find((item) => item.id === payload?.defaultGroupId) ||
    groups[0] ||
    null
  )
}

type AdminGroupContextValue = {
  groupId: string
  currentGroup: AdminManageableGroupItem | null
  groups: AdminManageableGroupItem[]
  loading: boolean
  error: string
  hasGroups: boolean
  changeGroup: (nextGroupId: string) => void
}

const AdminGroupContext = createContext<AdminGroupContextValue | null>(null)

export function AdminGroupProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const [payload, setPayload] = useState<AdminManageableGroupsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestedGroupId = useMemo(
    () => new URLSearchParams(location.search).get('groupId') || '',
    [location.search],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    getAdminManageableGroups()
      .then((responsePayload) => {
        if (!active) return
        setPayload(responsePayload)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setPayload(null)
        setError(requestError.message || '加载可管理星球列表失败')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const groups = payload?.groups || []
  const currentGroup = useMemo(() => resolveActiveGroup(requestedGroupId, payload), [payload, requestedGroupId])
  const groupId = currentGroup?.id || ''
  const hasGroups = groups.length > 0

  const changeGroup = useCallback(
    (nextGroupId: string) => {
      if (!nextGroupId || nextGroupId === groupId) {
        return
      }

      const nextSearchParams = new URLSearchParams(location.search)
      nextSearchParams.set('groupId', nextGroupId)
      setSearchParams(nextSearchParams)
    },
    [groupId, location.search, setSearchParams],
  )

  useEffect(() => {
    if (loading || !groupId || requestedGroupId === groupId) {
      return
    }

    const nextSearchParams = new URLSearchParams(location.search)
    nextSearchParams.set('groupId', groupId)
    setSearchParams(nextSearchParams, { replace: true })
  }, [groupId, loading, location.search, requestedGroupId, setSearchParams])

  const value = useMemo<AdminGroupContextValue>(
    () => ({
      groupId,
      currentGroup,
      groups,
      loading,
      error,
      hasGroups,
      changeGroup,
    }),
    [changeGroup, currentGroup, error, groupId, groups, hasGroups, loading],
  )

  return createElement(AdminGroupContext.Provider, { value }, children)
}

export function useAdminGroupContext() {
  const context = useOptionalAdminGroupContext()
  if (!context) {
    throw new Error('useAdminGroupContext must be used within AdminGroupProvider')
  }

  return context
}

export function useOptionalAdminGroupContext() {
  return useContext(AdminGroupContext)
}
