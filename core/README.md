# core — Aye agent service

The reasoning loop of Aye. A small Node/TypeScript service.

## Setup

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env
# edit .env — at minimum set DEEPSEEK_API_KEY
```

### Environment

| Variable               | Default                           | Notes                                           |
| ---------------------- | --------------------------------- | ----------------------------------------------- |
| `DEEPSEEK_API_KEY`     | —                                 | **Required**                                    |
| `AGENT_API_URL`        | `http://localhost:5173/api/intent`| Where to POST proposed intents                  |
| `AGENT_ID`             | `aye-agent-01`                    | Logical id; ends up in the on-chain audit log   |
| `DAILY_CALL_LIMIT`     | `500`                             | Hard cap on LLM calls per UTC day               |
| `INTENT_DEADLINE_SEC`  | `600`                             | EIP-712 deadline on each proposal               |

The service expects `web` to be running on `:5173` (it serves the queue API).
Start `web` first, or set `AGENT_API_URL` to point at
wherever you host the queues.
