import type { VercelRequest, VercelResponse } from '@vercel/node'

export function setCors(res: VercelResponse) {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
}

export function preflight(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export function jsonError(
  res: VercelResponse,
  status: number,
  error: string,
): void {
  res.status(status).json({ error })
}
