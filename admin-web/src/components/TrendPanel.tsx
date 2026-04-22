export function TrendPanel({
  title,
  hint,
  points,
}: {
  title: string
  hint: string
  points: number[]
}) {
  const max = Math.max(...points, 1)
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100
      const y = 100 - (point / max) * 100
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <article className="panel chart-panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <div className="chart-switch">
          <button className="switch-chip is-active">近 7 天</button>
          <button className="switch-chip">近 30 天</button>
        </div>
      </div>

      <div className="chart-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(49, 191, 172, 0.28)" />
              <stop offset="100%" stopColor="rgba(49, 191, 172, 0)" />
            </linearGradient>
          </defs>
          <path d={`${path} L 100 100 L 0 100 Z`} fill="url(#chartFill)" />
          <path d={path} fill="none" stroke="#31bfac" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    </article>
  )
}
