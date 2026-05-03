import type { VercelRequest, VercelResponse } from '@vercel/node'
import { preflight, jsonError } from '../_lib/http.js'
import { popCommand } from '../_lib/store.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (preflight(req, res)) return
  if (req.method !== 'GET') return jsonError(res, 405, 'method not allowed')
  const cmd = await popCommand()
  return res.status(200).json(cmd)
}
