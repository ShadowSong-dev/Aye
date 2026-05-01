import { useState } from 'react'
import {
  ChevronRight,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { type Address, isAddress, getAddress } from 'viem'
import {
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { Badge, Button, Card, CardHeader, toast } from '../components/ui'
import {
  auditLogAbi,
  explorerAddr,
  SEPOLIA_PRESETS,
} from '../lib/contracts'

export function WhitelistPage({ auditLog }: { auditLog: Address }) {
  const chainId = useChainId()
  const { data: addresses, refetch, isLoading } = useReadContract({
    address: auditLog,
    abi: auditLogAbi,
    functionName: 'getAddresses',
  })
  const list = (addresses as Address[] | undefined) ?? []

  const [input, setInput] = useState('')
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>()
  const { writeContractAsync, isPending } = useWriteContract()
  const { isLoading: txWaiting } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  })

  async function add(addr: string) {
    if (!isAddress(addr)) {
      toast('error', 'Invalid address')
      return
    }
    try {
      const tx = await writeContractAsync({
        address: auditLog,
        abi: auditLogAbi,
        functionName: 'addAddress',
        args: [getAddress(addr)],
      })
      setPendingHash(tx)
      toast('info', 'Adding to whitelist…', 'Confirm in your wallet.')
      setInput('')
      setTimeout(() => refetch(), 6000)
    } catch (e) {
      toast('error', 'Add failed', (e as Error).message.slice(0, 120))
    }
  }

  async function remove(addr: Address) {
    try {
      const tx = await writeContractAsync({
        address: auditLog,
        abi: auditLogAbi,
        functionName: 'removeAddress',
        args: [addr],
      })
      setPendingHash(tx)
      toast('info', 'Removing…')
      setTimeout(() => refetch(), 6000)
    } catch (e) {
      toast('error', 'Remove failed', (e as Error).message.slice(0, 120))
    }
  }

  const presetsToAdd = SEPOLIA_PRESETS.filter(
    (p) =>
      !list.some(
        (a) => getAddress(a) === getAddress(p.address),
      ),
  )

  return (
    <div className="stack">
      <div>
        <h1>Whitelist</h1>
        <p className="muted small">
          Targets your AuditLog will accept without warning. Stored on-chain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h3 style={{ margin: 0 }}>Add an address</h3>
        </CardHeader>
        <div className="stack">
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <input
              type="text"
              placeholder="0x…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input mono"
            />
            <Button
              variant="primary"
              loading={isPending || txWaiting}
              onClick={() => add(input)}
            >
              <Plus size={16} /> Add
            </Button>
          </div>

          {presetsToAdd.length > 0 && (
            <>
              <div className="label">Sepolia presets (one-click)</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                {presetsToAdd.map((p) => (
                  <button
                    type="button"
                    key={p.address}
                    onClick={() => add(p.address)}
                    style={{
                      background: 'var(--c-input)',
                      border: 0,
                      borderRadius: 'var(--r-pill)',
                      padding: '6px 12px',
                      fontFamily: 'var(--f-display)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--c-text)',
                    }}
                  >
                    <Plus size={12} />
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="row-between">
            <h3 style={{ margin: 0 }}>
              <ShieldCheck
                size={18}
                style={{ verticalAlign: '-3px', marginRight: 6 }}
              />
              Active whitelist
            </h3>
            <Badge tone="violet">{list.length}</Badge>
          </div>
        </CardHeader>
        {isLoading ? (
          <p className="muted">Loading on-chain whitelist…</p>
        ) : list.length === 0 ? (
          <p className="muted small">
            Empty. Aye actions to non-listed targets will show a red flag in the
            queue.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <tbody>
                {list.map((addr) => (
                  <tr key={addr}>
                    <td className="mono small" style={{ wordBreak: 'break-all' }}>
                      {addr}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <a
                        href={explorerAddr(chainId, addr)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-text btn-sm"
                      >
                        Etherscan <ChevronRight size={12} />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(addr)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
