import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProposedIntent } from './intent'

const QUEUE_KEY = ['intent-queue'] as const

export async function fetchIntents(): Promise<ProposedIntent[]> {
  const res = await fetch('/api/intent', { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`queue fetch failed: ${res.status}`)
  return (await res.json()) as ProposedIntent[]
}

export async function fetchQueueMeta(): Promise<{
  queueSize: number
  lastPushAt: number
  seenCount: number
}> {
  const res = await fetch('/api/intent/meta')
  if (!res.ok) throw new Error(`meta fetch failed: ${res.status}`)
  return await res.json()
}

export async function removeIntent(intentHash: string): Promise<void> {
  await fetch(`/api/intent/${intentHash}`, { method: 'DELETE' })
}

export function useIntentQueue() {
  return useQuery({
    queryKey: QUEUE_KEY,
    queryFn: fetchIntents,
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

export async function submitCommand(prompt: string): Promise<{ id: string; pending: number }> {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
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
