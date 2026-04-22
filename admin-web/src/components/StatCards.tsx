import type { StatCardItem } from '../types'

export function StatCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="stats-grid">
      {items.map((item) => (
        <article className="panel stat-card" key={item.label}>
          <div className="panel-label">{item.label}</div>
          <div className="stat-value">{item.value}</div>
          <div className="panel-hint">{item.hint}</div>
        </article>
      ))}
    </div>
  )
}
