import { preflight, jsonError, withErrors } from '../_lib/http.js'
import { intentMeta } from '../_lib/store.js'

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return
  if (req.method !== 'GET') return jsonError(res, 405, 'method not allowed')
  const meta = await intentMeta()
  return res.status(200).json(meta)
})
