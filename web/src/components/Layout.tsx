import { useEffect, useState, type ReactNode } from 'react'
import { useAccount, useConnect, useConnectors, useDisconnect } from 'wagmi'
import {
  Inbox,
  ShieldCheck,
  Bot,
  Scroll,
  Wallet,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { Button, Modal } from './ui'
import { Bunny } from './Bunny'
import { shortHex } from '../lib/intent'

export type RouteId = 'queue' | 'audit' | 'agent' | 'whitelist'

const ROUTES: { id: RouteId; label: string; icon: ReactNode; hash: string }[] = [
  { id: 'queue', label: 'Queue', icon: <Inbox size={18} />, hash: '#/queue' },
  { id: 'audit', label: 'Audit Log', icon: <Scroll size={18} />, hash: '#/audit' },
  { id: 'agent', label: 'Agent', icon: <Bot size={18} />, hash: '#/agent' },
  {
    id: 'whitelist',
    label: 'Whitelist',
    icon: <ShieldCheck size={18} />,
    hash: '#/whitelist',
  },
]

export function useRoute(): [RouteId, (r: RouteId) => void] {
  const [route, setRouteState] = useState<RouteId>(() => fromHash())
  useEffect(() => {
    const onHash = () => setRouteState(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  function setRoute(r: RouteId) {
    location.hash = `#/${r}`
  }
  return [route, setRoute]
}

function fromHash(): RouteId {
  const h = location.hash.replace('#/', '')
  if (['queue', 'audit', 'agent', 'whitelist'].includes(h)) return h as RouteId
  return 'queue'
}

export function Layout({
  children,
  badge,
}: {
  children: ReactNode
  badge?: { count: number }
}) {
  const [route, setRoute] = useRoute()

  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopBar />
      <div
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: 'var(--s-4)',
        }}
      >
        <TabBar
          current={route}
          onChange={setRoute}
          queueBadge={badge?.count ?? 0}
        />
        <main style={{ marginTop: 'var(--s-4)', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

function TopBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 'var(--nav-h)',
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-card-border)',
      }}
    >
      <div
        className="row-between"
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: '0 var(--s-4)',
          height: '100%',
        }}
      >
        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <Bunny size={36} />
          <div>
            <div
              style={{
                fontFamily: 'var(--f-display)',
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              Aye
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              every agent action, on your terms
            </div>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  )
}

function TabBar({
  current,
  onChange,
  queueBadge,
}: {
  current: RouteId
  onChange: (r: RouteId) => void
  queueBadge: number
}) {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 'var(--s-2)',
      }}
    >
      <div
        className="row"
        style={{
          background: 'var(--c-card)',
          border: '1px solid var(--c-card-border)',
          borderRadius: 'var(--r-pill)',
          padding: 6,
          gap: 4,
          boxShadow: 'var(--shadow-card)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {ROUTES.map((r) => {
          const active = current === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              className="row"
              style={{
                background: active ? 'var(--c-primary)' : 'transparent',
                color: active ? 'var(--c-text-on-primary)' : 'var(--c-text)',
                border: 0,
                borderRadius: 'var(--r-pill)',
                padding: '8px 16px',
                fontFamily: 'var(--f-display)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                gap: 8,
                transition:
                  'background var(--d-fast) var(--ease-out), color var(--d-fast) var(--ease-out)',
              }}
            >
              {r.icon}
              {r.label}
              {r.id === 'queue' && queueBadge > 0 && (
                <span
                  className="badge badge-warning"
                  style={{ minWidth: 20, justifyContent: 'center' }}
                >
                  {queueBadge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function ConnectButton() {
  const { address, status, chainId } = useAccount()
  const { connect, isPending } = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()
  const [menu, setMenu] = useState(false)
  const [picker, setPicker] = useState(false)

  if (status === 'connected' && address) {
    const wrong = chainId !== 11155111 // Sepolia
    return (
      <div className="row" style={{ position: 'relative', gap: 'var(--s-2)' }}>
        {wrong && (
          <span
            className="badge badge-warning"
            title="Switch to Sepolia in your wallet"
          >
            <AlertTriangle size={12} /> Wrong network
          </span>
        )}
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="row"
          style={{
            background: 'var(--c-card)',
            border: '1px solid var(--c-card-border)',
            borderRadius: 'var(--r-pill)',
            padding: '6px 12px 6px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--f-display)',
            fontWeight: 600,
            color: 'var(--c-text)',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--c-primary)',
            }}
          />
          {shortHex(address, 4, 4)}
          <ChevronDown size={14} />
        </button>
        {menu && (
          <div
            className="card"
            onMouseLeave={() => setMenu(false)}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              padding: 'var(--s-2)',
              minWidth: 200,
              zIndex: 60,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="row-between"
              onClick={() => {
                disconnect()
                setMenu(false)
              }}
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        loading={isPending}
        onClick={() => setPicker(true)}
      >
        <Wallet size={16} /> Connect
      </Button>
      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Connect a wallet"
      >
        <div className="stack">
          <p className="muted small">
            Aye signs an EIP-712 attestation with your wallet for every agent
            action. Stay on Sepolia for the demo.
          </p>
          {connectors.map((c) => (
            <Button
              key={c.uid}
              variant="ghost"
              onClick={() => {
                connect({ connector: c })
                setPicker(false)
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  )
}
