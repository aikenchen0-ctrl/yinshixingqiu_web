import type { TableColumn, TableRow } from '../types'

export function TablePanel({
  title,
  hint,
  columns,
  rows,
}: {
  title: string
  hint: string
  columns: TableColumn[]
  rows: TableRow[]
}) {
  return (
    <article className="panel table-panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <button className="ghost-button">查看全部</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row[columns[0].key]}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>{row[column.key] || '-'}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-cell" colSpan={columns.length}>
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
