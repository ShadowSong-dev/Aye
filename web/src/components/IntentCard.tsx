import { useEffect, useState } from 'react'
import {
  AlertOctagon,
  Check,
  Clock,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X as XIcon,
} from 'lucide-react'
import { type Address, type Hex } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Badge, Button, Card } from './ui'
import {
  formatValueEth,
  shortHex,
  timeLeft,
  type ProposedIntent,
} from '../lib/intent'
import { auditLogAbi } from '../lib/contracts'
import { ReviewModal } from './ReviewModal'

export function IntentCard({
  intent,
  auditLog,
}: {
  intent: ProposedIntent
  auditLog: Address
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const { address: account } = useAccount()
  const { data: isWhitelistedOnchain } = useReadContract({
    address: auditLog,
    abi: auditLogAbi,
    functionName: 'isWhitelisted',
    args: [intent.target as Address],
    query: { enabled: !!account },
  })

  const [decision, setDecision] = useState<'aye' | 'nay' | null>(null)

  const expired = intent.deadline - Math.floor(Date.now() / 1000) <= 0
  const whitelisted = isWhitelistedOnchain ?? null
  const tone =
    whitelisted === false ? 'danger' : whitelisted === true ? 'success' : 'neutral'

  const riskLabel =
    intent.riskLevel === 1
      ? { label: 'Low risk', tone: 'success' as const }
      : intent.riskLevel === 2
        ? { label: 'Med risk', tone: 'warning' as const }
        : { label: 'High risk', tone: 'danger' as const }

  // tick is read so React picks up the rerender for the countdown
  void tick

  return (
    <>
      <Card hover className="stack">
        <div className="row-between">
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <Badge tone="violet">
              <Sparkles size={12} /> {intent.agentId}
            </Badge>
            <Badge tone={riskLabel.tone}>{riskLabel.label}</Badge>
            {whitelisted === false && (
              <Badge tone="danger">
                <ShieldX size={12} /> Not whitelisted
              </Badge>
            )}
            {whitelisted === true && (
              <Badge tone="success">
                <ShieldCheck size={12} /> Whitelisted
              </Badge>
            )}
          </div>
          <Badge tone={expired ? 'danger' : 'neutral'}>
            <Clock size={12} /> {timeLeft(intent.deadline)}
          </Badge>
        </div>

        <p style={{ fontSize: 16, lineHeight: 1.5 }}>{intent.description}</p>

        {whitelisted === false && (
          <div
            className="row"
            style={{
              background: 'rgba(239, 71, 111, 0.08)',
              border: '1px solid rgba(239, 71, 111, 0.3)',
              padding: 'var(--s-3)',
              borderRadius: 'var(--r-md)',
              gap: 'var(--s-2)',
              alignItems: 'flex-start',
            }}
          >
            <AlertOctagon
              size={18}
              color="var(--c-failure)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div className="small">
              <strong>Target is not on your whitelist.</strong>
            </div>
          </div>
        )}

        <div
          className="stack"
          style={{
            background: 'var(--c-bg-soft)',
            padding: 'var(--s-3)',
            borderRadius: 'var(--r-md)',
            gap: 'var(--s-2)',
          }}
        >
          <DetailRow label="Target" mono value={intent.target} />
          <DetailRow label="Value" value={formatValueEth(intent.value)} />
          <DetailRow
            label="Calldata"
            mono
            value={shortHex(intent.data, 10, 8)}
            full={intent.data}
          />
          <DetailRow
            label="Intent hash"
            mono
            value={shortHex(intent.intentHash, 10, 8)}
            full={intent.intentHash}
          />
        </div>

        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <Button
            variant="aye"
            className="grow"
            disabled={expired || whitelisted === false}
            onClick={() => setDecision('aye')}
          >
            <Check size={18} /> Aye — approve
          </Button>
          <Button
            variant="nay"
            className="grow"
            disabled={expired}
            onClick={() => setDecision('nay')}
          >
            <XIcon size={18} /> Nay — reject
          </Button>
        </div>
        {tone !== 'neutral' && null}
      </Card>

      <ReviewModal
        open={decision !== null}
        decision={decision ?? 'aye'}
        intent={intent}
        auditLog={auditLog}
        whitelisted={whitelisted}
        onClose={() => setDecision(null)}
      />
    </>
  )
}

function DetailRow({
  label,
  value,
  mono,
  full,
}: {
  label: string
  value: string | Hex
  mono?: boolean
  full?: string
}) {
  return (
    <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline' }}>
      <span
        className="tiny"
        style={{
          color: 'var(--c-text-subtle)',
          fontFamily: 'var(--f-display)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          minWidth: 88,
        }}
      >
        {label}
      </span>
      <span
        className={mono ? 'mono small' : 'small'}
        style={{ wordBreak: 'break-all' }}
        title={full ?? undefined}
      >
        {value}
      </span>
    </div>
  )
}
