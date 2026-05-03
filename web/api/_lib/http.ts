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

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

// Wrap a handler so an unhandled throw becomes a structured 500 with the
// real message — otherwise Vercel hides it behind FUNCTION_INVOCATION_FAILED.
export function withErrors(handler: Handler): Handler {
  return async (req, res) => {
    try {
      return await handler(req, res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[api]', req.method, req.url, '→', msg)
      if (!res.headersSent) {
        setCors(res)
        res.status(500).json({ error: msg })
      }
    }
  }
}
