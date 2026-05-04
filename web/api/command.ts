import { preflight, jsonError, withErrors } from './_lib/http.js'
import { commandMeta, enqueueCommand, listCommands } from './_lib/store.js'

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return

  if (req.method === 'GET') {
    const items = await listCommands()
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    const body = req.body as { prompt?: unknown; userAddress?: unknown } | undefined
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return jsonError(res, 400, 'prompt (non-empty string) required')
    }
    let userAddress: `0x${string}` | undefined
    if (body.userAddress !== undefined && body.userAddress !== null) {
      if (typeof body.userAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(body.userAddress)) {
        return jsonError(res, 400, 'userAddress must be a 0x-prefixed 20-byte address')
      }
      userAddress = body.userAddress as `0x${string}`
    }
    const prompt = body.prompt.trim().slice(0, 4000)
    const cmd = await enqueueCommand(prompt, userAddress)
    const { pending } = await commandMeta()
    return res.status(200).json({ ok: true, id: cmd.id, pending })
  }

  return jsonError(res, 405, 'method not allowed')
})
