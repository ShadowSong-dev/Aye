import { useEffect, useState, type ReactNode } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Inbox, ShieldCheck, Bot, Scroll } from 'lucide-react'
import { Bunny } from './Bunny'

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

