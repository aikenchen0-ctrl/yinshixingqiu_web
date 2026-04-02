import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { defaultReferencePath, referencePageMap } from '../data/referencePages'

const titleRouteMap: Record<string, string> = {
  收入数据: '/income',
  权限设置: '/permissions',
}

const subtitleRouteEntries = [
  { label: '推广数据', path: '/promotion/data' },
  { label: '新人优惠券', path: '/promotion/new-user-coupons' },
  { label: '渠道二维码', path: '/promotion/channel-qrcodes' },
  { label: '付费页优化', path: '/promotion/paywall-optimization' },
  { label: '成员活跃', path: '/activity/members' },
  { label: '内容活跃', path: '/activity/content' },
  { label: '成员积分榜', path: '/activity/scoreboard' },
  { label: '活跃工具', path: '/activity/tools' },
  { label: '续期数据', path: '/renewal/data' },
  { label: '续期优惠券', path: '/renewal/coupons' },
  { label: '分组通知', path: '/renewal/group-notices' },
  { label: '续期页优化', path: '/renewal/page-optimization' },
  { label: '续期折扣', path: '/renewal/discounts' },
  { label: '优惠券', path: '/tools/coupons' },
  { label: '分组通知', path: '/tools/group-notices' },
  { label: '渠道二维码', path: '/tools/channel-qrcodes' },
  { label: '付费页优化', path: '/tools/paywall-optimization' },
  { label: '成员积分榜', path: '/tools/scoreboard' },
  { label: '创作灵感', path: '/tools/idea-lab' },
  { label: '视频号直播', path: '/tools/channel-live' },
  { label: '成员身份验证', path: '/tools/member-verification' },
]

export function ReferenceFramePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const frameSource = referencePageMap[location.pathname]

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const bindNavigation = () => {
      const frameWindow = frame.contentWindow
      const frameDocument = frame.contentDocument
      if (!frameWindow || !frameDocument) return

      const titleNodes = Array.from(frameDocument.querySelectorAll<HTMLElement>('.navigation .title'))
      titleNodes.forEach((node) => {
        const label = node.innerText.trim()
        const targetPath = titleRouteMap[label]
        if (!targetPath) return
        node.style.cursor = 'pointer'
        node.onclick = (event) => {
          event.preventDefault()
          navigate(targetPath)
        }
      })

      const subtitleNodes = Array.from(frameDocument.querySelectorAll<HTMLElement>('.navigation .subtitle'))
      subtitleNodes.forEach((node, index) => {
        const label = node.innerText.replace(/\nnew$/i, '').trim()
        const entry = subtitleRouteEntries[index]
        if (!entry || entry.label !== label) return
        node.style.cursor = 'pointer'
        node.onclick = (event) => {
          event.preventDefault()
          navigate(entry.path)
        }
      })
    }

    frame.addEventListener('load', bindNavigation)
    bindNavigation()

    return () => {
      frame.removeEventListener('load', bindNavigation)
    }
  }, [location.pathname, navigate])

  if (!frameSource) {
    return <Navigate to={defaultReferencePath} replace />
  }

  return (
    <main className="reference-shell">
      <iframe
        ref={frameRef}
        key={location.pathname}
        className="reference-frame"
        src={frameSource}
        title={location.pathname}
      />
    </main>
  )
}
