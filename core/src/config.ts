import 'dotenv/config';
import { getAddress, type Address } from 'viem';

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`env ${name} must be a number, got ${v}`);
  return n;
}

function addr(name: string, def: string): Address {
  return getAddress((process.env[name] && process.env[name] !== '' ? process.env[name]! : def));
}

export const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  agentApiUrl: process.env.AGENT_API_URL ?? 'http://localhost:5173/api/intent',
  commandApiUrl: process.env.COMMAND_API_URL ?? 'http://localhost:5173/api/command',
  commandPollMs: num('COMMAND_POLL_MS', 3000),
  agentId: process.env.AGENT_ID ?? 'aye-agent-01',
  dailyCallLimit: num('DAILY_CALL_LIMIT', 500),
  intentDeadlineSec: num('INTENT_DEADLINE_SEC', 600),

  // Sepolia
  uniswapRouter: addr('UNISWAP_ROUTER', '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'),
  usdc: addr('USDC', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'),
  weth: addr('WETH', '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'),
} as const;

export function assertConfig() {
  if (!config.deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY is required (see core/.env.example)');
  }
  try {
    new URL(config.agentApiUrl);
  } catch {
    throw new Error(`AGENT_API_URL is not a valid URL: ${config.agentApiUrl}`);
  }
  try {
    new URL(config.commandApiUrl);
  } catch {
    throw new Error(`COMMAND_API_URL is not a valid URL: ${config.commandApiUrl}`);
  }
  if (config.commandPollMs < 500) {
    throw new Error(`COMMAND_POLL_MS too small (${config.commandPollMs}); refusing to hammer the queue`);
  }
  if (config.dailyCallLimit < 1) {
    throw new Error(`DAILY_CALL_LIMIT must be ≥ 1`);
  }
}
