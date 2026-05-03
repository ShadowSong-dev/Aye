import type { VercelRequest, VercelResponse } from '@vercel/node'
import { preflight, jsonError } from './_lib/http.js'
import { commandMeta, enqueueCommand, listCommands } from './_lib/store.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (preflight(req, res)) return

  if (req.method === 'GET') {
    const items = await listCommands()
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    const body = req.body as { prompt?: unknown } | undefined
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return jsonError(res, 400, 'prompt (non-empty string) required')
    }
    const prompt = body.prompt.trim().slice(0, 4000)
    const cmd = await enqueueCommand(prompt)
    const { pending } = await commandMeta()
    return res.status(200).json({ ok: true, id: cmd.id, pending })
  }

  return jsonError(res, 405, 'method not allowed')
}
