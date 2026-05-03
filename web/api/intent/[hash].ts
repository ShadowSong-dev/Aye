import { preflight, jsonError, withErrors } from '../_lib/http.js'
import { removeIntent } from '../_lib/store.js'

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return
  if (req.method !== 'DELETE') return jsonError(res, 405, 'method not allowed')

  const raw = req.query.hash
  const hash = Array.isArray(raw) ? raw[0] : raw
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return jsonError(res, 400, 'expected /api/intent/:hash (32-byte hex)')
  }
  const removed = await removeIntent(hash)
  return res.status(200).json({ ok: true, removed })
})
