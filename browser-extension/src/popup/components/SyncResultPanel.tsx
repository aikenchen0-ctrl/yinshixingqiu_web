interface SyncResultPanelProps {
  notice: string
  error: string
  articleId: string
}

export function SyncResultPanel({ notice, error, articleId }: SyncResultPanelProps) {
  if (!notice && !error && !articleId) {
    return null
  }

  return (
    <section className={`popup-result-panel ${error ? 'is-error' : 'is-success'}`}>
      {notice ? <div className="popup-result-title">{notice}</div> : null}
      {error ? <div className="popup-result-title">{error}</div> : null}
      {articleId ? <div className="popup-result-meta">文章 ID: {articleId}</div> : null}
    </section>
  )
}
