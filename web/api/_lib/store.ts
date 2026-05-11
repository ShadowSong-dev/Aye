import { Redis } from '@upstash/redis'

export type Intent = {
  agentId: string
  intentHash: `0x${string}`
  target: `0x${string}`
  value: string
  data: `0x${string}`
  description: string
  riskLevel: number
  nonce: string
  deadline: number
  createdAt: number
  // Wallet that submitted the originating command. Used to scope GET /api/intent
  // so concurrent users on the same deployment don't see each other's pending
  // proposals. Missing means "legacy/unscoped" — bucketed under `_`.
  userAddress?: `0x${string}`
}

export type Command = {
  id: string
  prompt: string
  submittedAt: number
  userAddress?: `0x${string}`
}

let _redis: Redis | null = null
export function redis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set on the deployment',
    )
  }
  _redis = new Redis({ url, token })
  return _redis
}

const K = {
  intentHash: 'intents:pending',
  intentSeen: 'intents:seen',
  intentLastPush: 'intents:lastPushAt',
  cmdQueue: 'commands:queue',
  cmdSubmitted: 'commands:totalSubmitted',
  cmdConsumed: 'commands:totalConsumed',
} as const

const UNSCOPED = '_'

function ownerOf(intentOrAddr: Intent | string | undefined | null): string {
  if (!intentOrAddr) return UNSCOPED
  const raw =
    typeof intentOrAddr === 'string' ? intentOrAddr : intentOrAddr.userAddress
  return raw ? raw.toLowerCase() : UNSCOPED
}

// Storage field: `${owner}:${intentHash}` — gives each wallet its own slot
// inside the single `intents:pending` hash. Owner is the lowercased submitting
// wallet, or `_` for legacy/unscoped intents.
function fieldFor(owner: string, intentHash: string): string {
  return `${owner}:${intentHash.toLowerCase()}`
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function parseIntent(raw: unknown): Intent | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as Intent
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Intent
    } catch {
      return null
    }
  }
  return null
}

export async function listIntents(userAddress?: string): Promise<Intent[]> {
  const r = redis()
  const all = await r.hgetall<Record<string, unknown>>(K.intentHash)
  if (!all) return []
  const now = nowSec()
  const owner = userAddress ? userAddress.toLowerCase() : null
  const live: Intent[] = []
  const expiredFields: string[] = []
  for (const [field, raw] of Object.entries(all)) {
    const it = parseIntent(raw)
    if (!it) {
      expiredFields.push(field)
      continue
    }
    if (it.deadline < now) {
      expiredFields.push(field)
      continue
    }
    // Scope by submitter when requested. Fields stored before this change live
    // under `_` and have no userAddress — surface them only when no filter is
    // requested, so legacy entries don't leak across wallets.
    if (owner !== null) {
      const itOwner = ownerOf(it)
      if (itOwner !== owner) continue
    }
    live.push(it)
  }
  if (expiredFields.length) await r.hdel(K.intentHash, ...expiredFields)
  live.sort((a, b) => a.createdAt - b.createdAt)
  return live
}

export async function enqueueIntent(
  intent: Intent,
): Promise<{ ok: true; queued: number } | { ok: true; dedup: true }> {
  const r = redis()
  const owner = ownerOf(intent)
  // Dedup by (owner, intentHash, nonce) — owner is included so two users
  // proposing identical actions don't collide in the seen-set.
  const dedupKey = `${owner}:${intent.intentHash.toLowerCase()}:${intent.nonce}`
  const added = await r.sadd(K.intentSeen, dedupKey)
  if (added === 0) return { ok: true, dedup: true }
  await r.hset(K.intentHash, {
    [fieldFor(owner, intent.intentHash)]: JSON.stringify(intent),
  })
  await r.set(K.intentLastPush, Date.now())
  const size = await r.hlen(K.intentHash)
  return { ok: true, queued: size }
}

export async function removeIntent(
  hash: string,
  userAddress?: string,
): Promise<boolean> {
  const r = redis()
  const owner = ownerOf(userAddress)
  // Try the scoped field first; fall back to legacy unscoped `_:` for entries
  // written before per-user scoping landed.
  const fields =
    owner === UNSCOPED
      ? [fieldFor(UNSCOPED, hash)]
      : [fieldFor(owner, hash), fieldFor(UNSCOPED, hash)]
  const removed = await r.hdel(K.intentHash, ...fields)
  return removed > 0
}

export async function intentMeta(userAddress?: string): Promise<{
  queueSize: number
  lastPushAt: number
  seenCount: number
}> {
  const r = redis()
  // queueSize is scoped to the caller when an address is supplied so the
  // Agent page's "Queue size" stat lines up with what they see in the Queue.
  // seenCount and lastPushAt remain global lifetime stats.
  const [scopedItems, lastPushAt, seenCount] = await Promise.all([
    listIntents(userAddress),
    r.get<number>(K.intentLastPush),
    r.scard(K.intentSeen),
  ])
  return {
    queueSize: scopedItems.length,
    lastPushAt: lastPushAt ?? 0,
    seenCount: seenCount ?? 0,
  }
}

function parseCommand(raw: unknown): Command | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as Command
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Command
    } catch {
      return null
    }
  }
  return null
}

export async function listCommands(): Promise<Command[]> {
  const r = redis()
  const items = await r.lrange(K.cmdQueue, 0, -1)
  // LPUSH-then-RPOP FIFO: head of the list is the *newest*; reverse to oldest-first.
  const parsed = items.map(parseCommand).filter((c): c is Command => c !== null)
  return parsed.reverse()
}

export async function enqueueCommand(
  prompt: string,
  userAddress?: `0x${string}`,
): Promise<Command> {
  const r = redis()
  const cmd: Command = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    prompt,
    submittedAt: Date.now(),
    ...(userAddress ? { userAddress } : {}),
  }
  await r.lpush(K.cmdQueue, JSON.stringify(cmd))
  await r.incr(K.cmdSubmitted)
  return cmd
}

export async function popCommand(): Promise<Command | null> {
  const r = redis()
  const raw = await r.rpop(K.cmdQueue)
  const cmd = parseCommand(raw)
  if (cmd) await r.incr(K.cmdConsumed)
  return cmd
}

export async function commandMeta(): Promise<{
  pending: number
  totalSubmitted: number
  totalConsumed: number
}> {
  const r = redis()
  const [pending, totalSubmitted, totalConsumed] = await Promise.all([
    r.llen(K.cmdQueue),
    r.get<number>(K.cmdSubmitted),
    r.get<number>(K.cmdConsumed),
  ])
  return {
    pending: pending ?? 0,
    totalSubmitted: totalSubmitted ?? 0,
    totalConsumed: totalConsumed ?? 0,
  }
}
