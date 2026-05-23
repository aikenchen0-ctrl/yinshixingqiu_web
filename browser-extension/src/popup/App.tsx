import { useEffect, useState } from 'react'
import { isSupportedWechatArticleUrl } from '../content/page-detector'
import { ArticleMetaPreview } from './components/ArticleMetaPreview'
import { SyncButton } from './components/SyncButton'
import { SyncResultPanel } from './components/SyncResultPanel'

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [articleId, setArticleId] = useState('')

  useEffect(() => {
    void (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setTabId(typeof activeTab?.id === 'number' ? activeTab.id : null)
      setPageTitle(String(activeTab?.title || ''))
      setPageUrl(String(activeTab?.url || ''))
    })()
  }, [])

  async function handleSync() {
    if (tabId === null) {
      setError('当前没有可用的微信公众号文章页')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    setArticleId('')

    const result = await chrome.runtime.sendMessage({
      type: 'popup/run-sync',
      tabId,
    })

    if (!result?.ok) {
      setError(result?.message || '同步失败')
      setBusy(false)
      return
    }

    setNotice('已提交到小程序文章')
    setArticleId(String(result.data?.id || ''))
    setBusy(false)
  }

  const isWechatArticlePage = isSupportedWechatArticleUrl(pageUrl)

  return (
    <main className="popup-shell">
      <ArticleMetaPreview isWechatArticlePage={isWechatArticlePage} pageTitle={pageTitle} pageUrl={pageUrl} />
      <SyncButton busy={busy} disabled={!isWechatArticlePage} onClick={() => void handleSync()} />
      <SyncResultPanel articleId={articleId} error={error} notice={notice} />
    </main>
  )
}
