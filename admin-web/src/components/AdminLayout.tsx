import { NavLink, useLocation } from 'react-router-dom'
import { menuGroups } from '../data/menu'

interface AdminLayoutProps {
  title: string
  subtitle: string
  tag?: string
  breadcrumb?: string
  hideHeaderActions?: boolean
  primaryActionLabel?: string
  secondaryActionLabel?: string
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  children: React.ReactNode
}

const primaryPaths = new Set(['/income', '/permissions'])

export function AdminLayout({
  title,
  subtitle,
  tag,
  breadcrumb,
  hideHeaderActions,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  children,
}: AdminLayoutProps) {
  const location = useLocation()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <div className="brand-mark">知</div>
          <div>
            <div className="brand-name">知识星球管理台</div>
            <div className="brand-subtitle">第一版复刻骨架</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group) => (
            <div className="menu-group" key={group.key}>
              {group.path ? (
                <NavLink
                  to={group.path}
                  className={({ isActive }) =>
                    `menu-primary${isActive ? ' is-active' : ''}`
                  }
                >
                  <span className="menu-icon">{group.icon}</span>
                  <span>{group.label}</span>
                </NavLink>
              ) : (
                <>
                  <div className="menu-group-label">
                    <span className="menu-icon">{group.icon}</span>
                    <span>{group.label}</span>
                  </div>
                  <div className="menu-children">
                    {group.children?.map((item) => (
                      <NavLink
                        to={item.path}
                        key={item.path}
                        className={({ isActive }) =>
                          `menu-secondary${isActive ? ' is-active' : ''}`
                        }
                      >
                        <span>{item.label}</span>
                        {item.badge ? <span className="menu-badge">{item.badge}</span> : null}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-note">
          <div>采集页面数</div>
          <strong>21</strong>
          <span>已对齐真实后台菜单结构</span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="page-header">
          <div>
            <div className="breadcrumb">{breadcrumb ?? '返回星球列表 / ysc的星球'}</div>
            <div className="page-title-row">
              <h1>{title}</h1>
              {tag ? <span className="page-tag">{tag}</span> : null}
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          {hideHeaderActions ? null : (
            <div className="header-actions">
              <button className="ghost-button" onClick={onSecondaryAction} type="button">
                {secondaryActionLabel ?? '切换星球'}
              </button>
              <button className="primary-button" onClick={onPrimaryAction} type="button">
                {primaryActionLabel ?? '导出数据'}
              </button>
            </div>
          )}
        </header>

        <section className={`page-body${primaryPaths.has(location.pathname) ? ' body-wide' : ''}`}>
          {children}
        </section>
      </main>
    </div>
  )
}
