import type { VercelRequest, VercelResponse } from '@vercel/node'
import { preflight, jsonError } from '../_lib/http.js'
import { commandMeta } from '../_lib/store.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (preflight(req, res)) return
  if (req.method !== 'GET') return jsonError(res, 405, 'method not allowed')
  const meta = await commandMeta()
  return res.status(200).json(meta)
}
