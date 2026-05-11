import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { ProposedIntent } from './intent'

const QUEUE_KEY = ['intent-queue'] as const

// All /api/intent reads are scoped to the connected wallet. Without an
// address the server returns an empty list — this keeps a deployed instance
// from leaking pending intents between users.
function withAddress(url: string, userAddress?: `0x${string}`): string {
  if (!userAddress) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}userAddress=${userAddress}`
}

export async function fetchIntents(
  userAddress?: `0x${string}`,
): Promise<ProposedIntent[]> {
  if (!userAddress) return []
  const res = await fetch(withAddress('/api/intent', userAddress), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`queue fetch failed: ${res.status}`)
  return (await res.json()) as ProposedIntent[]
}

export async function fetchQueueMeta(
  userAddress?: `0x${string}`,
): Promise<{
  queueSize: number
  lastPushAt: number
  seenCount: number
}> {
  const res = await fetch(withAddress('/api/intent/meta', userAddress))
  if (!res.ok) throw new Error(`meta fetch failed: ${res.status}`)
  return await res.json()
}

export async function removeIntent(
  intentHash: string,
  userAddress?: `0x${string}`,
): Promise<void> {
  await fetch(withAddress(`/api/intent/${intentHash}`, userAddress), {
    method: 'DELETE',
  })
}

export function useIntentQueue() {
  const { address } = useAccount()
  return useQuery({
    // address is part of the key so React Query re-fetches (and re-caches
    // separately) when the user switches wallets.
    queryKey: [...QUEUE_KEY, address ?? null] as const,
    queryFn: () => fetchIntents(address),
    enabled: !!address,
    refetchInterval: 4000,
    staleTime: 2000,
  })
}

export function useInvalidateQueue() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: QUEUE_KEY })
}

export type CommandMeta = {
  pending: number
  totalSubmitted: number
  totalConsumed: number
}

export async function submitCommand(
  prompt: string,
  userAddress?: `0x${string}`,
): Promise<{ id: string; pending: number }> {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, ...(userAddress ? { userAddress } : {}) }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `submit failed: ${res.status}`)
  }
  return (await res.json()) as { id: string; pending: number }
}

export async function fetchCommandMeta(): Promise<CommandMeta> {
  const res = await fetch('/api/command/meta')
  if (!res.ok) throw new Error(`command meta fetch failed: ${res.status}`)
  return (await res.json()) as CommandMeta
}

/** Local "in-flight" set — hide intents whose Aye/Nay tx is pending so the
 *  user doesn't double-click while the queue endpoint hasn't been pruned yet. */
const INFLIGHT_KEY = 'aye:inflight'
export function getInflight(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(INFLIGHT_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}
export function markInflight(hash: string) {
  const s = getInflight()
  s.add(hash.toLowerCase())
  localStorage.setItem(INFLIGHT_KEY, JSON.stringify([...s]))
}
export function clearInflight(hash: string) {
  const s = getInflight()
  s.delete(hash.toLowerCase())
  localStorage.setItem(INFLIGHT_KEY, JSON.stringify([...s]))
}
