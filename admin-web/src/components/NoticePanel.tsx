export function NoticePanel({ items }: { items: string[] }) {
  return (
    <article className="panel notice-panel">
      <div className="panel-head">
        <div>
          <h3>实现提醒</h3>
          <p>这些提示来自当前已抓到的真实后台和你的项目阶段判断。</p>
        </div>
      </div>
      <div className="notice-list">
        {items.map((item) => (
          <div className="notice-item" key={item}>
            {item}
          </div>
        ))}
      </div>
    </article>
  )
}
