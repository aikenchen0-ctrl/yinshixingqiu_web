interface ArticleMetaPreviewProps {
  pageTitle: string
  pageUrl: string
  isWechatArticlePage: boolean
}

export function ArticleMetaPreview({ pageTitle, pageUrl, isWechatArticlePage }: ArticleMetaPreviewProps) {
  return (
    <section className="popup-card">
      <div className="popup-card-title">当前页面</div>
      <div className="popup-card-row">
        <strong>状态</strong>
        <span>{isWechatArticlePage ? '已识别微信公众号文章页' : '当前页面不支持同步'}</span>
      </div>
      <div className="popup-card-row">
        <strong>标题</strong>
        <span>{pageTitle || '-'}</span>
      </div>
      <div className="popup-card-row">
        <strong>链接</strong>
        <span>{pageUrl || '-'}</span>
      </div>
    </section>
  )
}
