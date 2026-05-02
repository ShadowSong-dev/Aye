import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem';

export type IntentAction = {
  target: Address;
  value: bigint;
  data: Hex;
};

// bigints are serialized as decimal strings.
export type ProposedIntent = {
  agentId: string;
  intentHash: Hex;
  target: Address;
  value: string;
  data: Hex;
  description: string;
  riskLevel: number;
  nonce: string;
  deadline: number;
  createdAt: number;
};

// Frontend must compute the intentHash with the exact same encoding,
// otherwise the EIP-712 signature won't validate against what the user reviewed.
export function computeIntentHash(action: IntentAction): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
      [action.target, action.value, action.data],
    ),
  );
}

// 96 bits of entropy, fits comfortably in uint256. Uniqueness, not security.
export function newNonce(): bigint {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let v = 0n;
  for (const b of buf) v = (v << 8n) | BigInt(b);
  return v;
}
