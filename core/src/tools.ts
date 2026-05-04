import { tool } from 'ai';
import { z } from 'zod';
import { encodeFunctionData, parseUnits, type Address, type Hex } from 'viem';
import { config } from './config.js';
import { computeIntentHash, newNonce, type ProposedIntent } from './intent.js';
import { pushIntent } from './api.js';

const MAX_UINT256 = (1n << 256n) - 1n;

const erc20Abi = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const wethAbi = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const exactInputSingleAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

type PriceProbe = {
  source: string;
  fetch: () => Promise<number | null>;
};

async function probeJson(url: string, pick: (j: any) => number | null): Promise<number | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const v = pick(j);
    return Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// price source
const PROBES: PriceProbe[] = [
  {
    source: 'coingecko',
    fetch: () =>
      probeJson(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        (j) => j?.ethereum?.usd ?? null,
      ),
  },
  {
    source: 'binance',
    fetch: () =>
      probeJson(
        'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
        (j) => (j?.price ? Number(j.price) : null),
      ),
  },
  {
    source: 'cryptocompare',
    fetch: () =>
      probeJson(
        'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
        (j) => j?.USD ?? null,
      ),
  },
  {
    source: 'coinbase',
    fetch: () =>
      probeJson(
        'https://api.coinbase.com/v2/prices/ETH-USD/spot',
        (j) => (j?.data?.amount ? Number(j.data.amount) : null),
      ),
  },
];

export const checkPriceTool = tool({
  description:
    'Get the current spot price of ETH in USD via public price feeds. ' +
    'Tries CoinGecko, Binance, CryptoCompare, and Coinbase in order; returns the first one that responds. ' +
    'Returns { price, source, ts, tried }. price is null only if every upstream feed fails.',
  parameters: z.object({
    asset: z
      .enum(['ETH'])
      .default('ETH')
      .describe('Asset symbol. Only ETH is supported in this loop.'),
  }),
  execute: async () => {
    const tried: string[] = [];
    for (const p of PROBES) {
      tried.push(p.source);
      const price = await p.fetch();
      if (price !== null) {
        return { price, source: p.source, ts: Date.now(), tried };
      }
    }
    return { price: null, source: 'none', ts: Date.now(), tried, error: 'all upstream feeds failed' };
  },
});

export type ToolCtx = {
  /** Connected wallet address from the frontend that submitted this command.
   *  Used as the default swap recipient so swap output goes back to the user
   *  instead of being burned to a placeholder. */
  userAddress?: Address;
};

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as Address;

const proposeIntentDescription =
  'Propose an on-chain action that the human user must Aye (approve) or Nay (reject) before anything happens. ' +
  'You DO NOT execute on-chain — proposing only enqueues the intent for human review. ' +
  'Supported kinds: ' +
  'swap-usdc-for-eth (Uniswap V3 USDC→WETH), ' +
  'swap-eth-for-usdc (Uniswap V3 native ETH→USDC, router auto-wraps), ' +
  'transfer-eth (send native ETH to an address), ' +
  'transfer-erc20 (transfer USDC or WETH to an address), ' +
  'approve-erc20 (set ERC20 allowance for a spender — typically the Uniswap router), ' +
  'wrap-eth (deposit native ETH into WETH), ' +
  'unwrap-weth (withdraw WETH back to native ETH).';

function makeProposeIntentTool(ctx: ToolCtx) {
  return tool({
  description: proposeIntentDescription,
  parameters: z.object({
    kind: z.enum([
      'swap-usdc-for-eth',
      'swap-eth-for-usdc',
      'transfer-eth',
      'transfer-erc20',
      'approve-erc20',
      'wrap-eth',
      'unwrap-weth',
    ]),
    description: z
      .string()
      .min(8)
      .max(280)
      .describe('Human-readable explanation of the intent. The user reads this before signing.'),
    riskLevel: z
      .number()
      .int()
      .min(1)
      .max(3)
      .describe('1=routine, 2=meaningful, 3=large/unusual. Stored verbatim on-chain.'),
    amountUsdc: z
      .number()
      .positive()
      .max(10)
      .optional()
      .describe('USDC units. Used by swap-usdc-for-eth, transfer-erc20 (token=USDC), approve-erc20 (token=USDC). Hard-capped at 10 (Sepolia demo).'),
    amountEth: z
      .number()
      .positive()
      .max(0.01)
      .optional()
      .describe('Native ETH units. Used by swap-eth-for-usdc, transfer-eth, wrap-eth. Hard-capped at 0.01 (Sepolia demo).'),
    amountWeth: z
      .number()
      .positive()
      .max(0.01)
      .optional()
      .describe('WETH units. Used by transfer-erc20 (token=WETH), approve-erc20 (token=WETH), unwrap-weth. Hard-capped at 0.01 (Sepolia demo).'),
    fee: z
      .union([z.literal(500), z.literal(3000), z.literal(10000)])
      .optional()
      .describe('Uniswap V3 fee tier. Default 3000 (0.3%). Swaps only.'),
    recipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('Optional swap recipient. Defaults to the connected wallet that submitted the command; only set this if the user explicitly wants the output sent to a different address.'),
    to: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('Destination address for transfer-eth and transfer-erc20. Required for those kinds; not overridden by the frontend.'),
    token: z
      .enum(['USDC', 'WETH'])
      .optional()
      .describe('Token symbol for transfer-erc20 and approve-erc20.'),
    spender: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .describe('Spender address for approve-erc20. Defaults to the Uniswap router.'),
    unlimited: z
      .boolean()
      .optional()
      .describe('For approve-erc20: set allowance to 2^256-1. Overrides amountUsdc/amountWeth.'),
  }),
  execute: async (input) => {
    let target: Address;
    let data: Hex;
    let value: bigint;

    if (input.kind === 'swap-usdc-for-eth') {
      const amount = input.amountUsdc ?? 1;
      const fee = input.fee ?? 3000;
      const recipient = (input.recipient ?? ctx.userAddress ?? BURN_ADDRESS) as Address;
      target = config.uniswapRouter;
      value = 0n;
      data = encodeFunctionData({
        abi: exactInputSingleAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: config.usdc,
            tokenOut: config.weth,
            fee,
            recipient,
            amountIn: parseUnits(String(amount), 6),
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
    } else if (input.kind === 'swap-eth-for-usdc') {
      const amount = input.amountEth ?? 0.001;
      const fee = input.fee ?? 3000;
      const recipient = (input.recipient ?? ctx.userAddress ?? BURN_ADDRESS) as Address;
      const amountIn = parseUnits(String(amount), 18);
      target = config.uniswapRouter;
      value = amountIn;
      data = encodeFunctionData({
        abi: exactInputSingleAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: config.weth,
            tokenOut: config.usdc,
            fee,
            recipient,
            amountIn,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
    } else if (input.kind === 'transfer-eth') {
      if (!input.to) throw new Error('transfer-eth requires "to"');
      if (input.amountEth === undefined) throw new Error('transfer-eth requires "amountEth"');
      target = input.to as Address;
      value = parseUnits(String(input.amountEth), 18);
      data = '0x';
    } else if (input.kind === 'transfer-erc20') {
      if (!input.to) throw new Error('transfer-erc20 requires "to"');
      if (!input.token) throw new Error('transfer-erc20 requires "token"');
      const tokenAddr = input.token === 'USDC' ? config.usdc : config.weth;
      const decimals = input.token === 'USDC' ? 6 : 18;
      const amount = input.token === 'USDC' ? input.amountUsdc : input.amountWeth;
      if (amount === undefined) {
        throw new Error(`transfer-erc20 (${input.token}) requires ${input.token === 'USDC' ? 'amountUsdc' : 'amountWeth'}`);
      }
      target = tokenAddr;
      value = 0n;
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [input.to as Address, parseUnits(String(amount), decimals)],
      });
    } else if (input.kind === 'approve-erc20') {
      if (!input.token) throw new Error('approve-erc20 requires "token"');
      const tokenAddr = input.token === 'USDC' ? config.usdc : config.weth;
      const decimals = input.token === 'USDC' ? 6 : 18;
      const spender = (input.spender ?? config.uniswapRouter) as Address;
      let allowance: bigint;
      if (input.unlimited) {
        allowance = MAX_UINT256;
      } else {
        const amount = input.token === 'USDC' ? input.amountUsdc : input.amountWeth;
        if (amount === undefined) {
          throw new Error(
            `approve-erc20 (${input.token}) requires ${input.token === 'USDC' ? 'amountUsdc' : 'amountWeth'} when unlimited is not set`,
          );
        }
        allowance = parseUnits(String(amount), decimals);
      }
      target = tokenAddr;
      value = 0n;
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, allowance],
      });
    } else if (input.kind === 'wrap-eth') {
      if (input.amountEth === undefined) throw new Error('wrap-eth requires "amountEth"');
      target = config.weth;
      value = parseUnits(String(input.amountEth), 18);
      data = encodeFunctionData({
        abi: wethAbi,
        functionName: 'deposit',
        args: [],
      });
    } else {
      // unwrap-weth
      if (input.amountWeth === undefined) throw new Error('unwrap-weth requires "amountWeth"');
      target = config.weth;
      value = 0n;
      data = encodeFunctionData({
        abi: wethAbi,
        functionName: 'withdraw',
        args: [parseUnits(String(input.amountWeth), 18)],
      });
    }

    const intentHash = computeIntentHash({ target, value, data });
    const nonce = newNonce();
    const deadline = Math.floor(Date.now() / 1000) + config.intentDeadlineSec;

    const proposed: ProposedIntent = {
      agentId: config.agentId,
      intentHash,
      target,
      value: value.toString(),
      data,
      description: input.description,
      riskLevel: input.riskLevel,
      nonce: nonce.toString(),
      deadline,
      createdAt: Date.now(),
    };

    const pushed = await pushIntent(proposed);

    return {
      ok: pushed.ok,
      status: pushed.status,
      intentHash,
      summary: pushed.ok
        ? `queued ${input.kind} → ${target}; awaiting human Aye/Nay.`
        : `failed to queue intent (status ${pushed.status}): ${pushed.error}`,
    };
  },
  });
}

export function buildTools(ctx: ToolCtx = {}) {
  return {
    checkPrice: checkPriceTool,
    proposeIntent: makeProposeIntentTool(ctx),
  };
}

export const tools = buildTools();
