# web — Aye review UI

The browser side of Aye. A Vite + React + wagmi + RainbowKit app where the
wallet owner reviews proposed intents, signs the EIP-712 approval, broadcasts
the transaction, and writes the audit entry on-chain.

## Setup

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env
```

### Environment

| Variable                          | Notes                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `VITE_FACTORY_ADDRESS`            | `AuditLogFactory` address on Sepolia (deploy from `contracts/` first) |
| `VITE_DEFAULT_AGENT_ID`           | Must match `AGENT_ID` in `core/.env` (default `aye-agent-01`) |
| `VITE_SEPOLIA_RPC`                | Optional Sepolia RPC (Alchemy/Infura). Falls back to public RPC if empty. |
| `VITE_WALLETCONNECT_PROJECT_ID`   | WalletConnect Cloud project id, required by RainbowKit. Get one at <https://cloud.walletconnect.com>. |
