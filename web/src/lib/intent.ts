import {
  encodeAbiParameters,
  keccak256,
  type Address,
  type Hex,
} from 'viem'

export type ProposedIntent = {
  agentId: string
  intentHash: Hex
  target: Address
  value: string
  data: Hex
  description: string
  riskLevel: number
  nonce: string
  deadline: number
  createdAt: number
}

/**
 * MUST match core/src/intent.ts exactly.
 * keccak256(abi.encode(address target, uint256 value, bytes data))
 * Pinned by core/test/intent.test.ts.
 */
export function computeIntentHash(args: {
  target: Address
  value: bigint
  data: Hex
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
      [args.target, args.value, args.data],
    ),
  )
}

/**
 * EIP-712 typed data for AuditLog.log().
 * Domain: ("ElizaAuditLog", "1") — set by AuditLog constructor.
 *
 * NAY_RISK_LEVEL is the sentinel value for rejections. Aye uses the
 * intent's original riskLevel (1/2/3); Nay overrides to 0. The contract
 * doesn't interpret riskLevel, so off-chain readers use the convention
 * "0 == rejected, anything else == approved".
 */
export const NAY_RISK_LEVEL = 0

export function buildLogTypedData(opts: {
  auditLog: Address
  chainId: number
  agentId: string
  intentHash: Hex
  riskLevel: number
  nonce: bigint
  deadline: bigint
}) {
  return {
    domain: {
      name: 'ElizaAuditLog',
      version: '1',
      chainId: opts.chainId,
      verifyingContract: opts.auditLog,
    },
    types: {
      TxIntent: [
        { name: 'agentId', type: 'string' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'riskLevel', type: 'uint8' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'TxIntent' as const,
    message: {
      agentId: opts.agentId,
      intentHash: opts.intentHash,
      riskLevel: opts.riskLevel,
      nonce: opts.nonce,
      deadline: opts.deadline,
    },
  }
}

export function shortHex(h: string, head = 6, tail = 4): string {
  if (!h) return ''
  if (h.length <= head + tail + 2) return h
  return `${h.slice(0, head + 2)}…${h.slice(-tail)}`
}

export function formatValueEth(weiStr: string): string {
  const wei = BigInt(weiStr)
  if (wei === 0n) return '0'
  const eth = Number(wei) / 1e18
  if (eth < 0.0001) return `${wei.toString()} wei`
  return `${eth.toFixed(4)} ETH`
}

export function timeLeft(deadlineSec: number): string {
  const left = deadlineSec - Math.floor(Date.now() / 1000)
  if (left <= 0) return 'expired'
  if (left < 60) return `${left}s`
  const m = Math.floor(left / 60)
  const s = left % 60
  return `${m}m ${s}s`
}
