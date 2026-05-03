# Aye

A human-in-the-loop AI agent for Ethereum (Sepolia testnet). Aye turns a
natural-language request like *"swap 50 USDC for ETH"* into a structured,
EIP-712-signed transaction proposal. Nothing hits the chain until **you**
press **Aye** in the web UI — the wallet owner, not the model, is the safety
layer.

## Repository layout

```
Aye/
├── core/         TypeScript agent service (DeepSeek + Vercel AI SDK)
├── contracts/    Solidity contracts (Hardhat 3) — AuditLog + factory + whitelist
└── web/          Vite + React + wagmi review/sign UI (also hosts the dev queue API)
```

## Prerequisites

- **Node.js 20+** and **pnpm**
- A **DeepSeek** API key
- A wallet with **Sepolia ETH** for the reviewer
- Optional: a Sepolia RPC and Etherscan API key for deploys

## Clone and start (full local stack)

```bash
git clone https://github.com/ShadowSong-dev/Aye.git
cd Aye

# 1. install deps in each workspace
pnpm --dir contracts install
pnpm --dir core install
pnpm --dir web install

# 2. configure env
cp core/.env.example core/.env     
cp web/.env.example  web/.env      

# 3. (optional) deploy contracts to Sepolia — see contracts/README.md
#    then paste the factory address into web/.env

# 4. run the web app (also serves the dev queue API on :5173)
pnpm --dir web dev

# 5. in another terminal, start the agent
pnpm --dir core dev
```

Open <http://localhost:5173>, connect your wallet on Sepolia, type a request,
and approve the intent that pops up.

See each subdirectory's README for details:

- [`core/README.md`](./core/README.md)
- [`contracts/README.md`](./contracts/README.md)
- [`web/README.md`](./web/README.md)

## License

MIT — see [LICENSE](./LICENSE).
