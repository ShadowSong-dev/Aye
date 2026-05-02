import { getAddress, type Address } from 'viem';
import { config } from './config.js';

export const WHITELIST: ReadonlySet<Address> = new Set([
  getAddress(config.uniswapRouter),
  getAddress(config.usdc),
  getAddress(config.weth),
]);

export function isWhitelisted(target: string): boolean {
  try {
    return WHITELIST.has(getAddress(target));
  } catch {
    return false;
  }
}
