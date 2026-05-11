import { preflight, jsonError, withErrors } from './_lib/http.js'
import { enqueueIntent, listIntents, type Intent } from './_lib/store.js'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

function parseAddressParam(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string' || !ADDR_RE.test(v)) return undefined
  return v
}

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return

  if (req.method === 'GET') {
    // Scope listing to the connected wallet so users on the same deployment
    // can't see each other's pending intents. Missing/invalid → no results
    // (was: returns every intent — the bug we're fixing).
    const owner = parseAddressParam(req.query.userAddress)
    if (!owner) return res.status(200).json([])
    const items = await listIntents(owner)
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
    if (body.userAddress !== undefined && body.userAddress !== null) {
      if (typeof body.userAddress !== 'string' || !ADDR_RE.test(body.userAddress)) {
        return jsonError(res, 400, 'userAddress must be a 0x-prefixed 20-byte address')
      }
    }
    const result = await enqueueIntent(body as Intent)
    return res.status(200).json(result)
  }

  return jsonError(res, 405, 'method not allowed')
})
