import type { Address } from 'viem'

export const FACTORY_ADDRESS = (import.meta.env.VITE_FACTORY_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as Address

export const DEFAULT_AGENT_ID =
  import.meta.env.VITE_DEFAULT_AGENT_ID ?? 'aye-agent-01'

/** Sepolia targets that match core/src/whitelist.ts — used as one-click presets. */
export const SEPOLIA_PRESETS: { label: string; address: Address }[] = [
  { label: 'Uniswap V3 Router', address: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' },
  { label: 'USDC (Sepolia)', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
  { label: 'WETH (Sepolia)', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' },
]

export const factoryAbi = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'auditLog', type: 'address' }],
  },
  {
    type: 'function',
    name: 'deployedFor',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'AuditLogDeployed',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'auditLog', type: 'address', indexed: true },
    ],
  },
] as const

export const auditLogAbi = [
  {
    type: 'function',
    name: 'log',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'string' },
      { name: 'intentHash', type: 'bytes32' },
      { name: 'riskLevel', type: 'uint8' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'approvalSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'entriesCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'entryAt',
    stateMutability: 'view',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'agentId', type: 'string' },
          { name: 'intentHash', type: 'bytes32' },
          { name: 'riskLevel', type: 'uint8' },
          { name: 'nonce', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'approver', type: 'address' },
          { name: 'approvalSig', type: 'bytes' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'usedNonce',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getAddresses',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'addAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addAddresses',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'addrs', type: 'address[]' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Logged',
    inputs: [
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'agentId', type: 'string', indexed: false },
      { name: 'intentHash', type: 'bytes32', indexed: true },
      { name: 'riskLevel', type: 'uint8', indexed: false },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'approver', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AddressAdded',
    inputs: [{ name: 'addr', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'AddressRemoved',
    inputs: [{ name: 'addr', type: 'address', indexed: true }],
  },
] as const

export const explorerTx = (chainId: number, hash: string): string => {
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`
  return `#${hash}`
}

export const explorerAddr = (chainId: number, addr: string): string => {
  if (chainId === 11155111) return `https://sepolia.etherscan.io/address/${addr}`
  if (chainId === 1) return `https://etherscan.io/address/${addr}`
  return `#${addr}`
}
