import type { VercelRequest, VercelResponse } from '@vercel/node'
import { preflight, jsonError } from './_lib/http.js'
import { enqueueIntent, listIntents, type Intent } from './_lib/store.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (preflight(req, res)) return

  if (req.method === 'GET') {
    const items = await listIntents()
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    const body = req.body as Partial<Intent> | undefined
    if (
      !body ||
      !body.intentHash ||
      !body.target ||
      body.nonce === undefined ||
      body.nonce === null
    ) {
      return jsonError(res, 400, 'missing required fields')
    }
    const result = await enqueueIntent(body as Intent)
    return res.status(200).json(result)
  }

  return jsonError(res, 405, 'method not allowed')
}
