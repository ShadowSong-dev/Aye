import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { type Address } from 'viem'
import { useIntentQueue } from './lib/queue'
import { Layout, useRoute } from './components/Layout'
import { ToastRegion, Card } from './components/ui'
import { Bunny } from './components/Bunny'
import { QueuePage } from './pages/Queue'
import { AuditPage } from './pages/Audit'
import { AgentPage } from './pages/Agent'
import { WhitelistPage } from './pages/Whitelist'
import { OnboardingPage } from './pages/Onboarding'
import { Wallet } from 'lucide-react'

const STORAGE_KEY = 'aye:auditlog'

function App() {
  const { address, status } = useAccount()
  const [auditLog, setAuditLog] = useState<Address | null>(null)

  useEffect(() => {
    if (!address) {
      setAuditLog(null)
      return
    }
    const cachedKey = `${STORAGE_KEY}:${address.toLowerCase()}`
    const v = localStorage.getItem(cachedKey)
    setAuditLog(v && v.startsWith('0x') ? (v as Address) : null)
  }, [address])

  function handleDeployed(addr: Address) {
    if (!address) return
    setAuditLog(addr)
    localStorage.setItem(`${STORAGE_KEY}:${address.toLowerCase()}`, addr)
  }

  if (status !== 'connected') {
    return (
      <>
        <Layout>
          <ConnectGate />
        </Layout>
        <ToastRegion />
      </>
    )
  }

  if (!auditLog) {
    return (
      <>
        <Layout>
          <OnboardingPage onDeployed={handleDeployed} />
        </Layout>
        <ToastRegion />
      </>
    )
  }

  return (
    <>
      <Routed auditLog={auditLog} />
      <ToastRegion />
    </>
  )
}

function Routed({ auditLog }: { auditLog: Address }) {
  const [route] = useRoute()
  const { data: queue = [] } = useIntentQueue()

  return (
    <Layout badge={{ count: queue.length }}>
      {route === 'queue' && <QueuePage auditLog={auditLog} />}
      {route === 'audit' && <AuditPage auditLog={auditLog} />}
      {route === 'agent' && <AgentPage />}
      {route === 'whitelist' && <WhitelistPage auditLog={auditLog} />}
    </Layout>
  )
}

function ConnectGate() {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'center',
        minHeight: 'calc(100dvh - var(--nav-h) - var(--s-12))',
      }}
    >
      <Card style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div className="stack" style={{ alignItems: 'center', gap: 'var(--s-4)' }}>
          <Bunny size={120} hop />
          <h1>Welcome to Aye</h1>
          <p className="muted">
            Every action your DeFi agent proposes lands here for your{' '}
            <strong>Aye</strong> or <strong>Nay</strong>. Approvals are signed
            with EIP-712 and recorded onchain forever.
          </p>
          <p className="muted small">
            <Wallet size={14} style={{ verticalAlign: '-2px' }} /> Connect your
            wallet using the button in the top-right to begin.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default App
