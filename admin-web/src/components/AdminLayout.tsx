import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { menuGroups as defaultMenuGroups } from '../data/menu'
import { useOptionalAdminGroupContext } from '../hooks/useAdminGroupContext'
import type { MenuGroup } from '../types'

interface AdminLayoutProps {
  title: string
  subtitle: string
  tag?: string
  breadcrumb?: string
  menuGroups?: MenuGroup[]
  brandName?: string
  brandTag?: string
  brandLogo?: string
  hideGroupPicker?: boolean
  hideTopbarAction?: boolean
  hidePageHeader?: boolean
  preserveGroupQuery?: boolean
  topbarActionLabel?: string
  onTopbarAction?: () => void
  onBeforeLeavePage?: () => boolean
  onBeforeGroupChange?: (nextGroupId: string) => boolean
  children: React.ReactNode
}

type AccessRedirectState = {
  accessRedirect?: {
    fromPath?: string
    toPath?: string
    roleLabel?: string
  }
} & Record<string, unknown>

const primaryPaths = new Set(['/income', '/courses', '/course/courses', '/course/lessons', '/promotion/data', '/renewal/data', '/activity/members', '/activity/content', '/permissions'])

function resolveMenuPathLabel(pathname: string, groups: MenuGroup[]) {
  for (const group of groups) {
    if (group.path === pathname) {
      return group.label
    }

    const matchedChild = group.children?.find((item) => item.path === pathname)
    if (matchedChild) {
      return matchedChild.label
    }
  }

  return pathname
}

function filterMenuGroupsByCapabilities(groups: MenuGroup[], currentGroupCapabilities?: {
  canViewDashboard: boolean
  canViewIncome: boolean
}) {
  if (!currentGroupCapabilities) {
    return groups
  }

  return groups.filter((group) => {
    if (group.key === 'income' || group.key === 'promotion') {
      return currentGroupCapabilities.canViewDashboard && currentGroupCapabilities.canViewIncome
    }

    if (group.key === 'activity') {
      return currentGroupCapabilities.canViewDashboard
    }

    return true
  })
}

function canAccessCurrentPath(pathname: string, currentGroupCapabilities?: {
  canViewDashboard: boolean
  canViewIncome: boolean
}) {
  if (!currentGroupCapabilities) {
    return true
  }

  if (pathname === '/income') {
    return currentGroupCapabilities.canViewDashboard && currentGroupCapabilities.canViewIncome
  }

  if (pathname.startsWith('/promotion/')) {
    return currentGroupCapabilities.canViewDashboard && currentGroupCapabilities.canViewIncome
  }

  if (pathname.startsWith('/activity/')) {
    return currentGroupCapabilities.canViewDashboard
  }

  return true
}

function pickFirstVisiblePath(groups: MenuGroup[]) {
  for (const group of groups) {
    if (group.path) {
      return group.path
    }

    if (group.children?.length) {
      return group.children[0].path
    }
  }

  return '/permissions'
}

function readAccessRedirectState(locationState: unknown) {
  if (!locationState || typeof locationState !== 'object' || !('accessRedirect' in locationState)) {
    return undefined
  }

  return (locationState as AccessRedirectState).accessRedirect
}

function stripAccessRedirectState(locationState: unknown) {
  if (!locationState || typeof locationState !== 'object' || !('accessRedirect' in locationState)) {
    return undefined
  }

  const { accessRedirect: _accessRedirect, ...rest } = locationState as AccessRedirectState
  return Object.keys(rest).length ? rest : null
}

export function AdminLayout({
  title,
  subtitle,
  tag,
  breadcrumb,
  menuGroups,
  brandName = '饮视星球',
  brandTag = '社群工具',
  brandLogo = 'C',
  hideGroupPicker,
  hideTopbarAction,
  hidePageHeader,
  preserveGroupQuery = true,
  topbarActionLabel,
  onTopbarAction,
  onBeforeLeavePage,
  onBeforeGroupChange,
  children,
}: AdminLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const adminGroupContext = useOptionalAdminGroupContext()
  const groupId = adminGroupContext?.groupId || ''
  const currentGroup = adminGroupContext?.currentGroup || null
  const groups = adminGroupContext?.groups || []
  const groupLoading = adminGroupContext?.loading || false
  const hasGroups = adminGroupContext?.hasGroups || false
  const changeGroup = adminGroupContext?.changeGroup || (() => {})
  const preservedGroupId = useMemo(() => new URLSearchParams(location.search).get('groupId') || '', [location.search])
  const [accessRedirectNotice, setAccessRedirectNotice] = useState('')
  const sourceMenuGroups = menuGroups || defaultMenuGroups
  const accessibleMenuGroups = useMemo(
    () => filterMenuGroupsByCapabilities(sourceMenuGroups, currentGroup?.capabilities),
    [currentGroup?.capabilities, sourceMenuGroups],
  )
  const visibleMenuGroups = accessibleMenuGroups
  const firstVisiblePath = useMemo(() => pickFirstVisiblePath(accessibleMenuGroups), [accessibleMenuGroups])

  function withCurrentSearch(path: string) {
    const [pathname, rawSearch = ''] = path.split('?')
    const nextSearchParams = new URLSearchParams(rawSearch)

    if (preserveGroupQuery && preservedGroupId) {
      nextSearchParams.set('groupId', preservedGroupId)
    }

    const nextSearch = nextSearchParams.toString()
    return `${pathname}${nextSearch ? `?${nextSearch}` : ''}`
  }

  function canLeavePage(nextPath?: string) {
    if (!onBeforeLeavePage) {
      return true
    }

    const currentPath = `${location.pathname}${location.search}`
    if (nextPath && nextPath === currentPath) {
      return true
    }

    return onBeforeLeavePage()
  }

  function handleProtectedNavClick(
    event: Pick<MouseEvent, 'altKey' | 'button' | 'ctrlKey' | 'defaultPrevented' | 'metaKey' | 'preventDefault' | 'shiftKey'>,
    nextPath: string,
  ) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return
    }

    if (!canLeavePage(nextPath)) {
      event.preventDefault()
    }
  }

  useEffect(() => {
    if (groupLoading || !currentGroup) {
      return
    }

    if (canAccessCurrentPath(location.pathname, currentGroup.capabilities)) {
      return
    }

    navigate(withCurrentSearch(firstVisiblePath), {
      replace: true,
      state: {
        accessRedirect: {
          fromPath: location.pathname,
          toPath: firstVisiblePath,
          roleLabel: currentGroup.roleLabel,
        },
      },
    })
  }, [currentGroup, firstVisiblePath, groupLoading, location.pathname, navigate, preservedGroupId])

  useEffect(() => {
    const redirectState = readAccessRedirectState(location.state)

    if (!redirectState?.fromPath) {
      return
    }

    const fromLabel = resolveMenuPathLabel(redirectState.fromPath, sourceMenuGroups)
    const toLabel = resolveMenuPathLabel(redirectState.toPath || location.pathname, sourceMenuGroups)

    setAccessRedirectNotice(
      `${redirectState.roleLabel || '当前角色'} 无权访问「${fromLabel}」，已切换到「${toLabel}」。`,
    )

    navigate(withCurrentSearch(location.pathname), {
      replace: true,
      state: stripAccessRedirectState(location.state) ?? undefined,
    })
  }, [location.pathname, location.state, navigate, preserveGroupQuery, preservedGroupId, sourceMenuGroups])

  useEffect(() => {
    if (!accessRedirectNotice) {
      return
    }

    const timer = window.setTimeout(() => {
      setAccessRedirectNotice('')
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [accessRedirectNotice])

  return (
    <div className="admin-scaffold">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <div className="admin-topbar-logo">{brandLogo}</div>
          <div className="admin-topbar-name">{brandName}</div>
          <div className="admin-topbar-tag">{brandTag}</div>
        </div>
        <div className="admin-topbar-tools">
          {!hideGroupPicker && adminGroupContext && (groupLoading || hasGroups) ? (
            <label className="admin-topbar-group-picker">
              <span className="admin-topbar-group-label">当前星球</span>
              <select
                className="admin-topbar-group-select"
                disabled={groupLoading || !hasGroups}
                onChange={(event) => {
                  const nextGroupId = event.target.value
                  if (!onBeforeGroupChange || onBeforeGroupChange(nextGroupId)) {
                    changeGroup(nextGroupId)
                  }
                }}
                value={groupId}
              >
                {groupLoading ? <option value="">正在加载可管理星球...</option> : null}
                {!groupLoading
                  ? groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {`${group.name} · ${group.roleLabel}`}
                      </option>
                    ))
                  : null}
              </select>
              {currentGroup ? (
                <span className="admin-topbar-group-meta">{`${currentGroup.roleLabel} · ${currentGroup.memberCount} 人`}</span>
              ) : null}
            </label>
          ) : null}
          {!hideTopbarAction ? (
            <button
              className="admin-topbar-switch"
              onClick={() => {
                if (!canLeavePage()) {
                  return
                }

                onTopbarAction?.()
              }}
              type="button"
            >
              {topbarActionLabel ?? '切换到旧数据后台'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-back">{breadcrumb ?? '‹ 返回星球列表'}</div>

          <nav className="sidebar-nav">
            {visibleMenuGroups.map((group) => (
              <div className="menu-group" key={group.key}>
                {group.path ? (
                  <NavLink
                    to={withCurrentSearch(group.path)}
                    className={({ isActive }) => `menu-primary${isActive ? ' is-active' : ''}`}
                    onClick={(event) => handleProtectedNavClick(event, withCurrentSearch(group.path!))}
                  >
                    <span className="menu-icon">{group.icon}</span>
                    <span>{group.label}</span>
                  </NavLink>
                ) : (
                  <>
                    <div className="menu-group-label">
                      <span className="menu-icon">{group.icon}</span>
                      <span>{group.label}</span>
                      <span className="menu-caret">▾</span>
                    </div>
                    <div className="menu-children">
                      {group.children?.map((item) => (
                        <NavLink
                          to={withCurrentSearch(item.path)}
                          key={item.path}
                          className={({ isActive }) => `menu-secondary${isActive ? ' is-active' : ''}`}
                          onClick={(event) => handleProtectedNavClick(event, withCurrentSearch(item.path))}
                        >
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          {!hidePageHeader ? (
            <header className="page-header">
              <div>
                <div className="page-title-row">
                  <h1>{title}</h1>
                </div>
                {tag ? <div className="page-tagline">{tag}</div> : null}
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
            </header>
          ) : null}

          {accessRedirectNotice ? <div className="admin-inline-tip admin-layout-tip">{accessRedirectNotice}</div> : null}

          <section className={`page-body${primaryPaths.has(location.pathname) ? ' body-wide' : ''}`}>
            {children}
          </section>
        </main>
      </div>
    </div>
  )
}
