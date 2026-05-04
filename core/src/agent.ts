import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import type { Address } from 'viem';
import { buildTools } from './tools.js';

export type CallBudget = { remaining: number };

const SYSTEM_PROMPT = `You translate user requests into on-chain transaction proposals on Sepolia.

Tools:
- checkPrice: read ETH/USD spot price. Use only when the user explicitly asks for a price.
- proposeIntent: queue an intent for human Aye/Nay review. Pick the kind that matches the request:
  - swap-usdc-for-eth: Uniswap V3 USDC→WETH. Params: amountUsdc, fee?, recipient?.
  - swap-eth-for-usdc: Uniswap V3 native ETH→USDC (router auto-wraps). Params: amountEth, fee?, recipient?.
  - transfer-eth: send native ETH to an address. Params: to (required), amountEth (required).
  - transfer-erc20: transfer USDC or WETH to an address. Params: token (USDC|WETH), to, and amountUsdc or amountWeth.
  - approve-erc20: grant an ERC20 allowance (commonly the Uniswap router before a USDC→ETH swap). Params: token, spender? (defaults to Uniswap router), and amountUsdc/amountWeth or unlimited=true.
  - wrap-eth: deposit native ETH into WETH. Params: amountEth.
  - unwrap-weth: withdraw WETH back to native ETH. Params: amountWeth.

For each user request, call proposeIntent once with parameters matching the request. 
Pick a sensible riskLevel (1=routine, 2=meaningful, 3=large/unusual). 
Do not refuse, do not add conditions, do not second-guess — the human reviews and signs every proposal, that is the safety layer.`;

export async function runAgentTurn(opts: {
  callBudget: CallBudget;
  prompt: string;
  userAddress?: Address;
}) {
  if (opts.callBudget.remaining <= 0) {
    return { skipped: true as const, reason: 'daily-call-budget-exhausted' };
  }
  opts.callBudget.remaining -= 1;

  const system = opts.userAddress
    ? `${SYSTEM_PROMPT}\n\nThe connected wallet that submitted this command is ${opts.userAddress}. ` +
      `For swaps, leave "recipient" unset unless the user explicitly names a different destination — the tool will default it to the connected wallet.`
    : SYSTEM_PROMPT;

  const result = await generateText({
    model: deepseek('deepseek-chat'),
    tools: buildTools({ userAddress: opts.userAddress }),
    maxSteps: 5,
    system,
    prompt: opts.prompt,
  });

  return {
    skipped: false as const,
    text: result.text,
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    steps: result.steps,
    finishReason: result.finishReason,
    usage: result.usage,
  };
}
