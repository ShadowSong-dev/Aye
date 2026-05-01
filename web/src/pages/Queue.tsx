import { useMemo, useState } from 'react'
import { Filter as FilterIcon, RefreshCw } from 'lucide-react'
import { type Address } from 'viem'
import { Badge, Button, Card } from '../components/ui'
import { Bunny } from '../components/Bunny'
import { IntentCard } from '../components/IntentCard'
import { getInflight, useIntentQueue } from '../lib/queue'
import { type ProposedIntent } from '../lib/intent'

type RiskFilter = 'all' | 1 | 2 | 3

export function QueuePage({ auditLog }: { auditLog: Address }) {
  const { data: rawIntents = [], isLoading, refetch, isFetching } = useIntentQueue()
  const [filter, setFilter] = useState<RiskFilter>('all')

  const intents = useMemo(() => {
    const inflight = getInflight()
    return rawIntents
      .filter((i) => !inflight.has(i.intentHash.toLowerCase()))
      .filter((i) => filter === 'all' || i.riskLevel === filter)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [rawIntents, filter])

  return (
    <Card>
      <div className="stack">
        <div className="row-between" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1>Queue</h1>
            <p className="muted small" style={{ marginTop: 'var(--s-1)' }}>
              Pending agent proposals. Aye to approve & execute, Nay to reject —
              both are signed and recorded onchain.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          <FilterIcon size={16} className="muted" />
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={rawIntents.length}
          >
            All
          </FilterChip>
          <FilterChip
            active={filter === 1}
            onClick={() => setFilter(1)}
            count={rawIntents.filter((i) => i.riskLevel === 1).length}
          >
            Low risk
          </FilterChip>
          <FilterChip
            active={filter === 2}
            onClick={() => setFilter(2)}
            count={rawIntents.filter((i) => i.riskLevel === 2).length}
          >
            Med risk
          </FilterChip>
          <FilterChip
            active={filter === 3}
            onClick={() => setFilter(3)}
            count={rawIntents.filter((i) => i.riskLevel === 3).length}
          >
            High risk
          </FilterChip>
        </div>

        {isLoading ? (
          <Card>
            <p className="muted">Polling /api/intent…</p>
          </Card>
        ) : intents.length === 0 ? (
          <EmptyQueue total={rawIntents.length} />
        ) : (
          <div className="stack">
            {intents.map((intent: ProposedIntent) => (
              <IntentCard
                key={intent.intentHash}
                intent={intent}
                auditLog={auditLog}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function FilterChip({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean
  count: number
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'var(--c-primary)' : 'var(--c-card)',
        color: active ? 'white' : 'var(--c-text)',
        border: '1px solid var(--c-card-border)',
        borderRadius: 'var(--r-pill)',
        padding: '6px 12px',
        fontFamily: 'var(--f-display)',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background var(--d-fast) var(--ease-out)',
      }}
    >
      {children}
      <Badge tone={active ? 'violet' : 'neutral'}>{count}</Badge>
    </button>
  )
}

function EmptyQueue({ total }: { total: number }) {
  return (
    <Card>
      <div
        className="stack"
        style={{ alignItems: 'center', padding: 'var(--s-8) 0', textAlign: 'center' }}
      >
        <Bunny size={120} hop />
        <h2 style={{ marginTop: 'var(--s-3)' }}>
          {total === 0 ? 'All quiet on the agent front' : 'Nothing matches that filter'}
        </h2>
        <p className="muted" style={{ maxWidth: 400 }}>
          {total === 0
            ? 'When the agent proposes an action, it shows up here for your Aye or Nay.'
            : 'Try a different risk filter, or refresh to fetch the latest queue.'}
        </p>
      </div>
    </Card>
  )
}
