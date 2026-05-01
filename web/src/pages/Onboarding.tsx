import { useEffect, useState } from 'react'
import { CheckCircle, Rocket, Sparkles, ExternalLink } from 'lucide-react'
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { Button, Card, CardHeader, Spinner, toast } from '../components/ui'
import { Bunny } from '../components/Bunny'
import {
  factoryAbi,
  FACTORY_ADDRESS,
  explorerAddr,
} from '../lib/contracts'
import { type Address } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000'

type PageState = 'loading' | 'not-deployed' | 'already-deployed' | 'deploying'

export function OnboardingPage({
  onDeployed,
}: {
  onDeployed: (auditLog: Address) => void
}) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [pendingTx, setPendingTx] = useState<`0x${string}` | undefined>()
  const { writeContractAsync, isPending } = useWriteContract()

  const {
    data: existing,
    isLoading: checkingDeployed,
    isError: checkFailed,
    refetch,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'deployedFor',
    args: address ? [address] : undefined,
    query: { enabled: !!address && FACTORY_ADDRESS !== ZERO },
  })

  const { isSuccess: txMined } = useWaitForTransactionReceipt({
    hash: pendingTx,
    query: { enabled: !!pendingTx },
  })

  const hasExisting = existing && existing !== ZERO
  const factoryMissing = FACTORY_ADDRESS === ZERO
  const wrongNetwork = chainId !== 11155111

  // Resolve page state
  let pageState: PageState = 'loading'
  if (factoryMissing || checkFailed) {
    pageState = 'not-deployed'
  } else if (checkingDeployed) {
    pageState = 'loading'
  } else if (hasExisting) {
    pageState = pendingTx ? 'deploying' : 'already-deployed'
  } else {
    pageState = pendingTx ? 'deploying' : 'not-deployed'
  }

  useEffect(() => {
    if (txMined && pendingTx) {
      refetch()
    }
  }, [txMined, pendingTx, refetch])

  async function deploy() {
    if (!address) return
    try {
      const tx = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: 'deploy',
        args: [address],
      })
      setPendingTx(tx)
      toast('info', 'Deploying your AuditLog…', 'One Sepolia transaction.')
    } catch (e) {
      toast('error', 'Deploy failed', (e as Error).message.slice(0, 120))
    }
  }

  return (
    <div
      className="row"
      style={{
        minHeight: 'calc(100dvh - var(--nav-h))',
        justifyContent: 'center',
        padding: 'var(--s-6)',
      }}
    >
      <Card style={{ maxWidth: 520, width: '100%' }}>
        <CardHeader>
          <h2 style={{ margin: 0 }}>
            <Sparkles
              size={20}
              style={{ verticalAlign: '-3px', marginRight: 6 }}
            />
            One-time setup
          </h2>
        </CardHeader>

        {pageState === 'loading' ? (
          <div
            className="stack"
            style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-4)', padding: 'var(--s-8) 0' }}
          >
            <Spinner size={40} />
            <p className="muted">Checking for existing AuditLog on Sepolia…</p>
          </div>
        ) : pageState === 'already-deployed' ? (
          <div
            className="stack"
            style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-4)' }}
          >
            <Bunny size={120} hop />
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--c-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 'var(--s-2)',
              }}
            >
              <CheckCircle size={28} color="white" />
            </div>
            <h2>AuditLog already deployed</h2>
            <p className="muted">
              You already have an AuditLog on Sepolia. Every Aye and Nay you sign
              is recorded there forever.
            </p>

            <div
              className="stack"
              style={{
                background: 'var(--c-bg-soft)',
                padding: 'var(--s-4)',
                borderRadius: 'var(--r-lg)',
                gap: 'var(--s-2)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div
                className="row-between"
                style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}
              >
                <span className="label" style={{ margin: 0 }}>
                  Your AuditLog address
                </span>
                <a
                  href={explorerAddr(chainId, existing as string)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="small"
                >
                  Etherscan <ExternalLink size={12} />
                </a>
              </div>
              <code className="code" style={{ fontSize: 13 }}>
                {existing as string}
              </code>
            </div>

            <Button
              variant="primary"
              className="grow"
              onClick={() => onDeployed(existing! as Address)}
            >
              <CheckCircle size={18} /> Use this AuditLog
            </Button>
          </div>
        ) : (
          <div
            className="stack"
            style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-4)' }}
          >
            <Bunny size={120} hop />
            <h2>Deploy your AuditLog</h2>
            <p className="muted">
              Aye will deploy a personal append-only log on Sepolia. Only your
              wallet can write to it. Every Aye and Nay you sign goes here,
              forever.
            </p>

            {wrongNetwork && !factoryMissing ? (
              <div
                className="small"
                style={{
                  background: 'rgba(255,183,3,0.12)',
                  border: '1px solid rgba(255,183,3,0.3)',
                  padding: 'var(--s-3)',
                  borderRadius: 'var(--r-md)',
                  color: '#B8860B',
                }}
              >
                <strong>Wrong network.</strong> Switch your wallet to Sepolia to
                deploy.
              </div>
            ) : null}

            {checkFailed ? (
              <div
                className="small"
                style={{
                  background: 'rgba(239,71,111,0.08)',
                  border: '1px solid rgba(239,71,111,0.3)',
                  padding: 'var(--s-3)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-failure)',
                }}
              >
                <strong>Failed to check deployment status.</strong> Make sure
                you're connected to Sepolia and try refreshing.
              </div>
            ) : null}

            <Button
              variant="primary"
              loading={isPending || (!!pendingTx && !txMined)}
              onClick={deploy}
              disabled={
                !address || factoryMissing || wrongNetwork
              }
            >
              <Rocket size={18} /> Deploy on Sepolia
            </Button>

            {(factoryMissing || checkFailed) && (
              <p className="tiny" style={{ color: 'var(--c-failure)' }}>
                {factoryMissing ? (
                  <>
                    Factory address not set. Edit <code>web/.env</code> and restart
                    dev.
                  </>
                ) : checkFailed ? (
                  <>
                    Could not reach the factory contract. Check your RPC endpoint in{' '}
                    <code>web/.env</code>.
                  </>
                ) : null}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
