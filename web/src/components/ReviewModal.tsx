import { useState } from 'react'
import { Check, X as XIcon, ExternalLink } from 'lucide-react'
import { type Address } from 'viem'
import {
  useAccount,
  useSendTransaction,
  useSignTypedData,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { Button, Modal, toast } from './ui'
import {
  buildLogTypedData,
  formatValueEth,
  NAY_RISK_LEVEL,
  shortHex,
  type ProposedIntent,
} from '../lib/intent'
import { auditLogAbi, explorerTx } from '../lib/contracts'
import {
  clearInflight,
  markInflight,
  removeIntent,
  useInvalidateQueue,
} from '../lib/queue'

type Step = 'review' | 'signing' | 'logging' | 'executing' | 'done' | 'error'

export function ReviewModal({
  open,
  decision,
  intent,
  auditLog,
  whitelisted,
  onClose,
}: {
  open: boolean
  decision: 'aye' | 'nay'
  intent: ProposedIntent
  auditLog: Address
  whitelisted: boolean | null
  onClose: () => void
}) {
  const { address: account } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()
  const { sendTransactionAsync } = useSendTransaction()
  const [step, setStep] = useState<Step>('review')
  const [errMsg, setErrMsg] = useState('')
  const [logTx, setLogTx] = useState<`0x${string}` | undefined>()
  const [execTx, setExecTx] = useState<`0x${string}` | undefined>()
  const invalidate = useInvalidateQueue()

  const { isLoading: logPending } = useWaitForTransactionReceipt({
    hash: logTx,
    query: { enabled: !!logTx },
  })
  const { isLoading: execPending } = useWaitForTransactionReceipt({
    hash: execTx,
    query: { enabled: !!execTx },
  })

  const isAye = decision === 'aye'
  const riskLevelOnLog = isAye ? intent.riskLevel : NAY_RISK_LEVEL

  function close() {
    if (step === 'signing' || step === 'logging' || step === 'executing') return
    setStep('review')
    setErrMsg('')
    setLogTx(undefined)
    setExecTx(undefined)
    onClose()
  }

  async function run() {
    if (!account) {
      toast('error', 'Wallet not connected')
      return
    }
    setErrMsg('')
    try {
      setStep('signing')
      const typedData = buildLogTypedData({
        auditLog,
        chainId: 11155111,
        agentId: intent.agentId,
        intentHash: intent.intentHash,
        riskLevel: riskLevelOnLog,
        nonce: BigInt(intent.nonce),
        deadline: BigInt(intent.deadline),
      })
      const sig = await signTypedDataAsync(typedData)

      setStep('logging')
      markInflight(intent.intentHash)
      const tx1 = await writeContractAsync({
        address: auditLog,
        abi: auditLogAbi,
        functionName: 'log',
        args: [
          intent.agentId,
          intent.intentHash,
          riskLevelOnLog,
          BigInt(intent.nonce),
          BigInt(intent.deadline),
          sig,
        ],
      })
      setLogTx(tx1)

      if (isAye) {
        setStep('executing')
        const tx2 = await sendTransactionAsync({
          to: intent.target as Address,
          data: intent.data,
          value: BigInt(intent.value),
        })
        setExecTx(tx2)
      }

      setStep('done')
      await removeIntent(intent.intentHash)
      invalidate()
      toast(
        'success',
        isAye ? 'Action approved & executed' : 'Rejection logged on-chain',
        isAye
          ? 'Both transactions confirmed.'
          : 'The agent will not retry this intent.',
      )
    } catch (e) {
      const msg = (e as Error).message ?? 'Unknown error'
      setErrMsg(msg)
      setStep('error')
      toast('error', 'Transaction failed', msg.slice(0, 120))
    } finally {
      clearInflight(intent.intentHash)
    }
  }

  const title = isAye ? 'Aye — sign & execute' : 'Nay — log rejection'

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        step === 'done' ? (
          <Button variant="primary" className="grow" onClick={close}>
            Close
          </Button>
        ) : step === 'error' ? (
          <>
            <Button variant="ghost" className="grow" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" className="grow" onClick={run}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              className="grow"
              onClick={close}
              disabled={
                step === 'signing' || step === 'logging' || step === 'executing'
              }
            >
              Back
            </Button>
            <Button
              variant={isAye ? 'aye' : 'nay'}
              className="grow"
              loading={step !== 'review'}
              onClick={run}
            >
              {isAye ? (
                <>
                  <Check size={18} /> Sign & execute
                </>
              ) : (
                <>
                  <XIcon size={18} /> Sign rejection
                </>
              )}
            </Button>
          </>
        )
      }
    >
      <div className="stack">
        {whitelisted === false && isAye && (
          <div
            style={{
              background: 'rgba(239,71,111,0.08)',
              border: '1px solid rgba(239,71,111,0.3)',
              padding: 'var(--s-3)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <strong style={{ color: 'var(--c-failure)' }}>
              Target is NOT on your whitelist.
            </strong>
            <div className="muted small">
              You can still sign, but the action will likely fail downstream
              checks. We strongly recommend Nay.
            </div>
          </div>
        )}

        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <Row label="Decision">
            <span style={{ fontWeight: 700 }}>
              {isAye ? 'Aye (approve)' : 'Nay (reject)'}
            </span>
          </Row>
          <Row label="Agent">{intent.agentId}</Row>
          <Row label="Target" mono>
            {intent.target}
          </Row>
          <Row label="Value">{formatValueEth(intent.value)}</Row>
          <Row label="Calldata" mono>
            {shortHex(intent.data, 14, 8)}
          </Row>
          <Row label="Intent hash" mono>
            {shortHex(intent.intentHash, 14, 8)}
          </Row>
          <Row label="Nonce" mono>
            {shortHex(intent.nonce, 8, 6)}
          </Row>
          <Row label="riskLevel on log">
            {riskLevelOnLog} {!isAye && '(0 = Nay sentinel)'}
          </Row>
        </div>

        <hr />

        <Steps
          step={step}
          isAye={isAye}
          logTx={logTx}
          execTx={execTx}
          chainId={11155111}
          logPending={logPending}
          execPending={execPending}
          errMsg={errMsg}
        />
      </div>
    </Modal>
  )
}

function Row({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-3)' }}>
      <span
        className="tiny muted"
        style={{
          minWidth: 110,
          fontFamily: 'var(--f-display)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        className={mono ? 'mono small' : 'small'}
        style={{ wordBreak: 'break-all' }}
      >
        {children}
      </span>
    </div>
  )
}

function Steps({
  step,
  isAye,
  logTx,
  execTx,
  chainId,
  logPending,
  execPending,
  errMsg,
}: {
  step: Step
  isAye: boolean
  logTx?: `0x${string}`
  execTx?: `0x${string}`
  chainId: number
  logPending: boolean
  execPending: boolean
  errMsg: string
}) {
  const items: { id: Step; label: string }[] = [
    { id: 'signing', label: '1. Sign EIP-712 attestation' },
    { id: 'logging', label: '2. AuditLog.log() — onchain proof' },
  ]
  if (isAye) items.push({ id: 'executing', label: '3. Execute target action' })

  function statusOf(id: Step): 'pending' | 'active' | 'done' {
    const order: Step[] = ['review', 'signing', 'logging', 'executing', 'done']
    const cur = order.indexOf(step)
    const ix = order.indexOf(id)
    if (step === 'error') return ix < cur ? 'done' : 'pending'
    if (cur > ix) return 'done'
    if (cur === ix) return 'active'
    return 'pending'
  }

  return (
    <div className="stack" style={{ gap: 'var(--s-2)' }}>
      {items.map((it) => {
        const s = statusOf(it.id)
        return (
          <div
            key={it.id}
            className="row"
            style={{
              gap: 'var(--s-2)',
              color:
                s === 'done'
                  ? 'var(--c-success)'
                  : s === 'active'
                    ? 'var(--c-primary)'
                    : 'var(--c-text-subtle)',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background:
                  s === 'done'
                    ? 'var(--c-success)'
                    : s === 'active'
                      ? 'var(--c-primary)'
                      : 'var(--c-input)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              {s === 'done' ? <Check size={12} /> : null}
            </span>
            <span className="small" style={{ fontWeight: 600 }}>
              {it.label}
            </span>
            {it.id === 'logging' && logTx && (
              <a
                href={explorerTx(chainId, logTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="small"
              >
                <ExternalLink size={12} /> {logPending ? 'pending' : 'tx'}
              </a>
            )}
            {it.id === 'executing' && execTx && (
              <a
                href={explorerTx(chainId, execTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="small"
              >
                <ExternalLink size={12} /> {execPending ? 'pending' : 'tx'}
              </a>
            )}
          </div>
        )
      })}
      {step === 'error' && (
        <div
          className="small"
          style={{
            color: 'var(--c-failure)',
            background: 'rgba(239,71,111,0.08)',
            padding: 'var(--s-3)',
            borderRadius: 'var(--r-md)',
          }}
        >
          {errMsg.slice(0, 240)}
        </div>
      )}
    </div>
  )
}
