import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function readJson(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function send(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.end(JSON.stringify(body))
}

/**
 * In-memory FIFO intent queue served at /api/intent.
 * - POST /api/intent           → enqueue a ProposedIntent (called by core)
 * - GET  /api/intent           → list pending intents
 * - DELETE /api/intent/:hash   → remove one (after Aye/Nay)
 * - GET  /api/intent/meta      → { queueSize, lastPushAt, agentId, characters[] }
 *
 * For demo only. Restart-safe persistence is out of scope; pushed intents
 * have a 10-minute deadline and are pruned on every read.
 */
function intentQueuePlugin(): Plugin {
  type Intent = {
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
  }

  const queue: Intent[] = []
  let lastPushAt = 0
  // Dedup by (intentHash, nonce) — intentHash alone collides across legit
  // repeat proposals of the same action, since on-chain uniqueness comes from
  // nonce (see AuditLog's EIP-712 TxIntent + usedNonce mapping).
  const seenKeys = new Set<string>()
  const keyOf = (i: Pick<Intent, 'intentHash' | 'nonce'>) =>
    `${i.intentHash.toLowerCase()}:${i.nonce}`

  function prune() {
    const now = Math.floor(Date.now() / 1000)
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].deadline < now) queue.splice(i, 1)
    }
  }

  return {
    name: 'aye-intent-queue',
    configureServer(server) {
      server.middlewares.use('/api/intent', async (req, res, next) => {
        if (req.method === 'OPTIONS') return send(res, 204, {})
        prune()

        const url = req.url || '/'

        if (url.startsWith('/meta')) {
          return send(res, 200, {
            queueSize: queue.length,
            lastPushAt,
            seenCount: seenKeys.size,
          })
        }

        if (req.method === 'GET') {
          return send(res, 200, queue)
        }

        if (req.method === 'POST') {
          try {
            const body = (await readJson(req)) as Intent
            if (
              !body ||
              !body.intentHash ||
              !body.target ||
              body.nonce === undefined ||
              body.nonce === null
            ) {
              return send(res, 400, { error: 'missing required fields' })
            }
            const key = keyOf(body)
            if (seenKeys.has(key)) {
              return send(res, 200, { ok: true, dedup: true })
            }
            seenKeys.add(key)
            queue.push(body)
            lastPushAt = Date.now()
            return send(res, 200, { ok: true, queued: queue.length })
          } catch (e) {
            return send(res, 400, { error: (e as Error).message })
          }
        }

        if (req.method === 'DELETE') {
          const m = url.match(/^\/(0x[0-9a-fA-F]{64})/)
          if (!m) return send(res, 400, { error: 'expected /api/intent/:hash' })
          const hash = m[1].toLowerCase()
          const idx = queue.findIndex((i) => i.intentHash.toLowerCase() === hash)
          if (idx >= 0) queue.splice(idx, 1)
          return send(res, 200, { ok: true, removed: idx >= 0 })
        }

        next()
      })
    },
  }
}

/**
 * In-memory FIFO command queue served at /api/command.
 * Web UI submits user prompts; core polls /next to consume one and
 * passes it to the next agent turn.
 *
 * - POST /api/command       → enqueue { prompt }
 * - GET  /api/command       → list pending commands
 * - GET  /api/command/next  → pop & return one (or null) — called by core
 * - GET  /api/command/meta  → { pending, totalSubmitted, totalConsumed }
 */
function commandQueuePlugin(): Plugin {
  type Command = { id: string; prompt: string; submittedAt: number }
  const queue: Command[] = []
  let totalSubmitted = 0
  let totalConsumed = 0

  return {
    name: 'aye-command-queue',
    configureServer(server) {
      server.middlewares.use('/api/command', async (req, res, next) => {
        if (req.method === 'OPTIONS') return send(res, 204, {})

        const url = req.url || '/'

        if (url.startsWith('/meta') && req.method === 'GET') {
          return send(res, 200, {
            pending: queue.length,
            totalSubmitted,
            totalConsumed,
          })
        }

        if (url.startsWith('/next') && req.method === 'GET') {
          const cmd = queue.shift() ?? null
          if (cmd) totalConsumed += 1
          return send(res, 200, cmd)
        }

        if (req.method === 'GET') {
          return send(res, 200, queue)
        }

        if (req.method === 'POST') {
          try {
            const body = (await readJson(req)) as { prompt?: unknown }
            if (
              !body ||
              typeof body.prompt !== 'string' ||
              !body.prompt.trim()
            ) {
              return send(res, 400, { error: 'prompt (non-empty string) required' })
            }
            const prompt = body.prompt.trim().slice(0, 4000)
            const cmd: Command = {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              prompt,
              submittedAt: Date.now(),
            }
            queue.push(cmd)
            totalSubmitted += 1
            return send(res, 200, { ok: true, id: cmd.id, pending: queue.length })
          } catch (e) {
            return send(res, 400, { error: (e as Error).message })
          }
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), intentQueuePlugin(), commandQueuePlugin()],
  server: {
    port: 5173,
  },
})
