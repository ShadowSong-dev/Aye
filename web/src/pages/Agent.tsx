import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import {
  Activity,
  Bot,
  Inbox,
  Send,
  Sparkles,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, toast } from '../components/ui'
import { fetchCommandMeta, fetchQueueMeta, submitCommand } from '../lib/queue'
import { DEFAULT_AGENT_ID } from '../lib/contracts'

export function AgentPage() {
  const { data: meta } = useQuery({
    queryKey: ['queue-meta'],
    queryFn: fetchQueueMeta,
    refetchInterval: 4000,
  })
  const { data: cmdMeta, refetch: refetchCmdMeta } = useQuery({
    queryKey: ['command-meta'],
    queryFn: fetchCommandMeta,
    refetchInterval: 3000,
  })

  const lastPushed = meta?.lastPushAt
    ? new Date(meta.lastPushAt).toLocaleString()
    : '—'

  return (
    <div className="stack">
      <div>
        <h1>Agent</h1>
        <p className="muted small">
          Send a request below — the agent translates it into a single intent
          and queues it for your Aye/Nay.
        </p>
      </div>

      <CommandComposer
        pending={cmdMeta?.pending ?? 0}
        onSubmitted={() => refetchCmdMeta()}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--s-4)',
        }}
      >
        <Stat
          icon={<Inbox size={18} />}
          label="Queue size"
          value={`${meta?.queueSize ?? 0}`}
        />
        <Stat
          icon={<Activity size={18} />}
          label="Last proposal"
          value={lastPushed}
        />
        <Stat
          icon={<Sparkles size={18} />}
          label="Lifetime intents"
          value={`${meta?.seenCount ?? 0}`}
        />
        <Stat
          icon={<Bot size={18} />}
          label="Default agentId"
          value={DEFAULT_AGENT_ID}
          mono
        />
      </div>

      <Card>
        <CardHeader>
          <h3 style={{ margin: 0 }}>How it talks to the web</h3>
        </CardHeader>
        <ol className="stack" style={{ paddingLeft: 20, gap: 'var(--s-2)' }}>
          <li className="small">
            You submit a prompt above → POST <code>/api/command</code> on this
            dev server queues it.
          </li>
          <li className="small">
            <code>core/</code> polls <code>/api/command/next</code> every{' '}
            <code>COMMAND_POLL_MS</code> (default 3s), pops one command, and
            calls <code>deepseek-chat</code> with the <code>checkPrice</code>{' '}
            and <code>proposeIntent</code> tools.
          </li>
          <li className="small">
            The model translates your request into a single{' '}
            <code>proposeIntent</code> call; the tool computes the intent hash
            and POSTs it to <code>/api/intent</code>.
          </li>
          <li className="small">
            The Queue page polls <code>/api/intent</code> every 4 seconds and
            renders any pending intent for your Aye/Nay.
          </li>
        </ol>
      </Card>
    </div>
  )
}

function CommandComposer({
  pending,
  onSubmitted,
}: {
  pending: number
  onSubmitted: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const { address: account } = useAccount()

  const trimmed = prompt.trim()
  const disabled = busy || trimmed.length === 0 || !account

  async function send() {
    if (disabled) return
    setBusy(true)
    try {
      const r = await submitCommand(trimmed, account)
      toast(
        'success',
        'Command queued',
        `${r.pending} pending — agent will pick it up on its next tick.`,
      )
      setPrompt('')
      onSubmitted()
      qc.invalidateQueries({ queryKey: ['command-meta'] })
    } catch (e) {
      toast('error', 'Submit failed', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="row-between" style={{ width: '100%' }}>
          <h3 style={{ margin: 0 }}>Send a command</h3>
          <Badge tone={pending > 0 ? 'violet' : 'neutral'}>
            {pending} pending
          </Badge>
        </div>
      </CardHeader>
      <div className="stack" style={{ gap: 'var(--s-3)' }}>
        <p className="small muted" style={{ margin: 0 }}>
          Describe the on-chain action you want. The agent translates it
          directly into a single intent (no judgement, no editorialising) and
          drops it in the queue for your Aye/Nay.
        </p>
        {!account && (
          <p className="small" style={{ margin: 0, color: 'var(--c-failure)' }}>
            Connect your wallet first — the agent uses your address as the
            default swap recipient.
          </p>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What on-chain action do you want to propose?"
          rows={3}
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void send()
            }
          }}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: 'var(--s-3)',
            background: 'var(--c-input)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-card-border)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--f-body)',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        />
        <div className="row-between" style={{ alignItems: 'center' }}>
          <span className="tiny muted">
            <kbd className="kbd">⌘/Ctrl</kbd> + <kbd className="kbd">Enter</kbd>{' '}
            to send
          </span>
          <Button variant="primary" onClick={send} disabled={disabled} loading={busy}>
            <Send size={14} /> Send
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Card>
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--c-input)',
            color: 'var(--c-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div className="stack" style={{ gap: 0 }}>
          <span
            className="tiny muted"
            style={{
              fontFamily: 'var(--f-display)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          <span
            className={mono ? 'mono' : ''}
            style={{ fontWeight: 700, fontSize: 20 }}
          >
            {value}
          </span>
        </div>
      </div>
    </Card>
  )
}

