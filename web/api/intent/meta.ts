import { preflight, jsonError, withErrors } from '../_lib/http.js'
import { intentMeta } from '../_lib/store.js'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return
  if (req.method !== 'GET') return jsonError(res, 405, 'method not allowed')

  const rawAddr = req.query.userAddress
  const addr = Array.isArray(rawAddr) ? rawAddr[0] : rawAddr
  const userAddress = typeof addr === 'string' && ADDR_RE.test(addr) ? addr : undefined
  const meta = await intentMeta(userAddress)
  return res.status(200).json(meta)
})
