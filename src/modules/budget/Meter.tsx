import { money } from '../../lib/format'
import { limitStatus } from './weekMath'

// One category row: name, spent against its soft limit, and a bar.
export function Meter({ name, spent, limit }: { name: string; spent: number; limit: number | null }) {
  const status = limitStatus(spent, limit)
  const width = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  return (
    <div className={`meter ${status}`}>
      <span>
        {name}
        {status === 'over' && <span className="flag">▲ {money(spent - limit!)} over</span>}
        {status === 'near' && <span className="flag">! near limit</span>}
      </span>
      <span className="num small">
        {money(spent)}
        {limit ? ` / ${money(limit)}` : ''}
      </span>
      {limit ? (
        <div className="bar">
          <i style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  )
}
