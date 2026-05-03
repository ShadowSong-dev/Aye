import { preflight, jsonError, withErrors } from '../_lib/http.js'
import { popCommand } from '../_lib/store.js'

export default withErrors(async (req, res) => {
  if (preflight(req, res)) return
  if (req.method !== 'GET') return jsonError(res, 405, 'method not allowed')
  const cmd = await popCommand()
  return res.status(200).json(cmd)
})
