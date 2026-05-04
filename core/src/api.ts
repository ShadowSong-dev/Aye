import { config } from './config.js';
import type { ProposedIntent } from './intent.js';

export type PushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string };

// push the intent to frontend
export async function pushIntent(intent: ProposedIntent): Promise<PushResult> {
  try {
    const res = await fetch(config.agentApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: body.slice(0, 200) || res.statusText };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

export type PendingCommand = {
  id: string;
  prompt: string;
  submittedAt: number;
  userAddress?: `0x${string}`;
};

// get the command from the frontend
export async function fetchPendingCommand(): Promise<PendingCommand | null> {
  try {
    const res = await fetch(`${config.commandApiUrl}/next`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PendingCommand | null;
    if (!body || typeof body.prompt !== 'string') return null;
    if (
      body.userAddress !== undefined &&
      !/^0x[a-fA-F0-9]{40}$/.test(body.userAddress)
    ) {
      // drop malformed address rather than letting it leak into encoded calldata
      delete (body as { userAddress?: string }).userAddress;
    }
    return body;
  } catch {
    return null;
  }
}
