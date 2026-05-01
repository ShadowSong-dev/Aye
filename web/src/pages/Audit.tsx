import { useQuery } from '@tanstack/react-query'
import { useChainId, usePublicClient } from 'wagmi'
import { type Address } from 'viem'
import { ExternalLink, Scroll } from 'lucide-react'
import { Badge, Card } from '../components/ui'
import { auditLogAbi, explorerAddr } from '../lib/contracts'
import { NAY_RISK_LEVEL, shortHex } from '../lib/intent'
import { Bunny } from '../components/Bunny'

type Entry = {
  agentId: string
  intentHash: `0x${string}`
  riskLevel: number
  nonce: bigint
  timestamp: bigint
  approver: Address
  approvalSig: `0x${string}`
}

export function AuditPage({ auditLog }: { auditLog: Address }) {
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const { data, isLoading } = useQuery({
    queryKey: ['audit-entries', auditLog, chainId],
    enabled: !!publicClient,
    queryFn: async (): Promise<Entry[]> => {
      if (!publicClient) return []
      const count = (await publicClient.readContract({
        address: auditLog,
        abi: auditLogAbi,
        functionName: 'entriesCount',
      })) as bigint
      const n = Number(count)
      if (n === 0) return []
      const entries: Entry[] = []
      for (let i = n - 1; i >= Math.max(0, n - 50); i--) {
        const e = (await publicClient.readContract({
          address: auditLog,
          abi: auditLogAbi,
          functionName: 'entryAt',
          args: [BigInt(i)],
        })) as Entry
        entries.push(e)
      }
      return entries
    },
    refetchInterval: 15000,
  })

  return (
    <div className="stack">
      <div>
        <h1>Audit Log</h1>
        <p className="muted small">
          Every Aye and Nay you've ever signed. Append-only,{' '}
          <a
            href={explorerAddr(chainId, auditLog)}
            target="_blank"
            rel="noopener noreferrer"
          >
            on Sepolia <ExternalLink size={12} />
          </a>
          .
        </p>
      </div>

      <Card>
        {isLoading ? (
          <p className="muted">Reading on-chain entries…</p>
        ) : !data || data.length === 0 ? (
          <div
            className="stack"
            style={{ alignItems: 'center', padding: 'var(--s-6) 0', textAlign: 'center' }}
          >
            <Bunny size={80} />
            <h3>No entries yet</h3>
            <p className="muted small">
              Approve or reject an intent on the Queue to start filling this log.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>When</th>
                  <th>Agent</th>
                  <th>Intent hash</th>
                  <th>Nonce</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => {
                  const isNay = e.riskLevel === NAY_RISK_LEVEL
                  const ts = new Date(Number(e.timestamp) * 1000)
                  return (
                    <tr key={`${e.intentHash}-${e.nonce.toString()}`}>
                      <td>
                        <Badge tone={isNay ? 'danger' : 'success'}>
                          {isNay ? (
                            <>
                              <Scroll size={12} /> Nay
                            </>
                          ) : (
                            <>
                              <Scroll size={12} /> Aye
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="small muted">{ts.toLocaleString()}</td>
                      <td className="small">{e.agentId}</td>
                      <td className="mono small">
                        {shortHex(e.intentHash, 8, 6)}
                      </td>
                      <td className="mono small">
                        {shortHex(e.nonce.toString(16).padStart(2, '0'), 6, 4)}
                      </td>
                      <td>
                        <Badge
                          tone={
                            isNay
                              ? 'neutral'
                              : e.riskLevel === 3
                                ? 'danger'
                                : e.riskLevel === 2
                                  ? 'warning'
                                  : 'success'
                          }
                        >
                          {isNay ? '— ' : `L${e.riskLevel}`}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
