import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveLegacyAdminEntryPath } from '../../adminNavigation'
import { AdminLayout } from '../../components/AdminLayout'
import { useAdminGroupContext } from '../../hooks/useAdminGroupContext'

const TOOL_ITEMS = [
  {
    key: 'homework',
    title: '作业',
    introduction:
      '如果有一个好的话题或任务，可以使用此功能让星球内成员集中发表自己的看法，作业发布后将自动通知所有成员填写。还可以去写写点评，让成员更有动力输出内容哦～',
  },
  {
    key: 'checkin',
    title: '打卡挑战',
    introduction:
      '如果希望成员针对一个任务进行持续的输出，比如健身打卡、xx技能训练营、工作日常总结等，可以使用此功能，它将有效的提高成员的持续活跃度。可搭配一些奖励措施，激励成员坚持打卡哦～',
  },
  {
    key: 'app',
    title: '引导下载 App',
    introduction:
      '数据表明，下载了饮视星球 App 的成员，留存率比未下载的要高出 2 倍以上。因此尽量通知下载 App，以提高成员的留存率～',
  },
  {
    key: 'weixin',
    title: '关注饮视星球公众号',
    introduction:
      '饮视星球的很多通知是通过公众号推送的，包括星主的「续期通知」，提醒成员关注饮视星球公众号，将有效提高通知的触达率，便于召回用户～',
  },
] as const

const STEP_DIALOGS = {
  homework: {
    title: '如何使用「作业」功能？',
    illustrationClassName: 'is-homework',
    steps: [
      '打开饮视星球 App ,在星球内找到作业功能',
      '输入作业题目',
      '在作业榜内查看成员提交的作业',
    ],
  },
  checkin: {
    title: '如何使用「打卡」功能？',
    illustrationClassName: 'is-checkin',
    steps: ['打开饮视星球 App ,在星球内找到打卡功能', '编辑本次打卡挑战的基本信息', '开始打卡吧！'],
  },
} as const

const DOWNLOAD_APP_POSTER_URL = '/reference-admin/activity-tools/download-app-poster.png'
const WEIXIN_OFFICIAL_QR_URL = '/reference-admin/activity-tools/weixin-official-account-qr.png'

type ToolKey = (typeof TOOL_ITEMS)[number]['key']

function buildActionNotice(label: string) {
  return `${label}入口当前版本还没有单独接进 admin-web，这里先按参考页保留展示和下载能力。`
}

function triggerAssetDownload(assetUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = assetUrl
  anchor.download = filename
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

function ActivityToolStepDialog({
  dialogKey,
  onClose,
}: {
  dialogKey: keyof typeof STEP_DIALOGS
  onClose: () => void
}) {
  const dialog = STEP_DIALOGS[dialogKey]

  return (
    <div
      aria-modal="true"
      className="activity-tool-dialog-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div className="activity-tool-step-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="activity-tool-dialog-header">
          <div className="activity-tool-dialog-title">{dialog.title}</div>
          <button aria-label="关闭" className="activity-tool-dialog-close" onClick={onClose} type="button" />
        </div>

        <div className="activity-tool-step-grid">
          {dialog.steps.map((step, index) => (
            <article className="activity-tool-step-card" key={step}>
              <div
                className={`activity-tool-step-image ${dialog.illustrationClassName} illustration-${index + 1}`}
              />
              <div className="activity-tool-step-index">{String(index + 1).padStart(2, '0')}</div>
              <div className="activity-tool-step-text">{step}</div>
            </article>
          ))}
        </div>

        <div className="activity-tool-dialog-footer">
          <button className="activity-tool-dialog-primary" onClick={onClose} type="button">
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}

function ActivityToolDownloadDialog({
  onClose,
  onPrimaryAction,
}: {
  onClose: () => void
  onPrimaryAction: () => void
}) {
  return (
    <div
      aria-modal="true"
      className="activity-tool-dialog-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div className="activity-tool-download-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="activity-tool-dialog-header is-centered">
          <div className="activity-tool-dialog-title">引导下载 App</div>
          <button aria-label="关闭" className="activity-tool-dialog-close" onClick={onClose} type="button" />
        </div>

        <div className="activity-tool-download-subtitle">下载 App 的用户，活跃度会提升 20% 以上</div>

        <img
          alt="引导下载 App 海报"
          className="activity-tool-download-poster"
          src={DOWNLOAD_APP_POSTER_URL}
        />

        <button className="activity-tool-dialog-primary is-wide" onClick={onPrimaryAction} type="button">
          发布「引导主题」
        </button>

        <button
          className="activity-tool-dialog-link"
          onClick={() => triggerAssetDownload(DOWNLOAD_APP_POSTER_URL, '引导下载App海报.png')}
          type="button"
        >
          仅下载海报
        </button>
      </div>
    </div>
  )
}

function ActivityToolWeixinDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      aria-modal="true"
      className="activity-tool-dialog-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div className="activity-tool-weixin-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="activity-tool-dialog-header is-centered">
          <div className="activity-tool-dialog-title">推荐关注公众号</div>
          <button aria-label="关闭" className="activity-tool-dialog-close" onClick={onClose} type="button" />
        </div>

        <div className="activity-tool-weixin-copy">此二维码可关注饮视星球公众号，保存后发送给成员吧～</div>

        <img
          alt="饮视星球公众号二维码"
          className="activity-tool-weixin-qrcode"
          src={WEIXIN_OFFICIAL_QR_URL}
        />

        <div className="activity-tool-dialog-footer">
          <button
            className="activity-tool-dialog-primary is-wide"
            onClick={() => triggerAssetDownload(WEIXIN_OFFICIAL_QR_URL, '饮视星球公众号二维码.png')}
            type="button"
          >
            下载二维码
          </button>
        </div>
      </div>
    </div>
  )
}

export function ActivityToolsPage() {
  const navigate = useNavigate()
  const { groupId, currentGroup, loading: groupLoading, error: groupError, hasGroups } = useAdminGroupContext()
  const [activeDialog, setActiveDialog] = useState<ToolKey | null>(null)
  const [actionNotice, setActionNotice] = useState('')

  useEffect(() => {
    if (!actionNotice) {
      return
    }

    const timer = window.setTimeout(() => {
      setActionNotice('')
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [actionNotice])

  useEffect(() => {
    if (!activeDialog) {
      return
    }

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDialog(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeDialog])

  return (
    <AdminLayout
      title="活跃工具"
      subtitle=""
      breadcrumb="‹ 返回星球列表"
      topbarActionLabel="切换到旧数据后台"
      onTopbarAction={() => navigate(resolveLegacyAdminEntryPath(groupId))}
    >
      <div className="admin-resource-page activity-tools-reference-page">
        {groupError ? <div className="admin-inline-error">{groupError}</div> : null}
        {groupLoading ? <div className="admin-resource-panel admin-resource-empty">正在识别可管理星球...</div> : null}
        {!groupLoading && !hasGroups ? (
          <div className="admin-resource-panel admin-resource-empty">当前账号还没有可管理的星球。</div>
        ) : null}

        {!groupLoading && hasGroups ? (
          <>
            <div className="activity-tools-reference-group-name">{currentGroup?.name || groupId || '-'}</div>

            <section className="admin-resource-panel activity-tools-reference-panel">
              {TOOL_ITEMS.map((item, index) => (
                <article className={`activity-tool-item${index === TOOL_ITEMS.length - 1 ? ' is-last' : ''}`} key={item.key}>
                  <div className={`activity-tool-icon-shell is-${item.key}`}>
                    <i className="activity-tool-icon" />
                  </div>

                  <div className="activity-tool-content">
                    <div className="activity-tool-copy">
                      <h2>{item.title}</h2>
                      <p>{item.introduction}</p>
                    </div>

                    <button className="activity-tool-action" onClick={() => setActiveDialog(item.key)} type="button">
                      立即使用
                    </button>
                  </div>
                </article>
              ))}
            </section>

            {actionNotice ? <div className="admin-inline-tip">{actionNotice}</div> : null}
          </>
        ) : null}
      </div>

      {activeDialog === 'homework' ? (
        <ActivityToolStepDialog dialogKey="homework" onClose={() => setActiveDialog(null)} />
      ) : null}
      {activeDialog === 'checkin' ? (
        <ActivityToolStepDialog dialogKey="checkin" onClose={() => setActiveDialog(null)} />
      ) : null}
      {activeDialog === 'app' ? (
        <ActivityToolDownloadDialog
          onClose={() => setActiveDialog(null)}
          onPrimaryAction={() => {
            setActiveDialog(null)
            setActionNotice(buildActionNotice('发布「引导主题」'))
          }}
        />
      ) : null}
      {activeDialog === 'weixin' ? <ActivityToolWeixinDialog onClose={() => setActiveDialog(null)} /> : null}
    </AdminLayout>
  )
}
