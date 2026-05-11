import { preflight, jsonError, withErrors } from '../_lib/http.js'
import { removeIntent } from '../_lib/store.js'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return
  if (req.method !== 'DELETE') return jsonError(res, 405, 'method not allowed')

  const raw = req.query.hash
  const hash = Array.isArray(raw) ? raw[0] : raw
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return jsonError(res, 400, 'expected /api/intent/:hash (32-byte hex)')
  }
  // Scope removal to the caller so one user can't evict another user's
  // pending intents by guessing hashes.
  const rawAddr = req.query.userAddress
  const addr = Array.isArray(rawAddr) ? rawAddr[0] : rawAddr
  const userAddress = typeof addr === 'string' && ADDR_RE.test(addr) ? addr : undefined
  const removed = await removeIntent(hash, userAddress)
  return res.status(200).json({ ok: true, removed })
})
