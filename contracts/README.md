# contracts — Aye on-chain layer

Solidity 0.8.28 contracts that give Aye a tamper-evident audit trail and a
per-user transaction whitelist. Built with **Hardhat 3** + the viem toolbox.

## Setup

Requires Node 20+ and pnpm.

```bash
pnpm install
```

### Environment (Hardhat config variables)

`hardhat.config.ts` reads three configuration variables for the `sepolia`
network and Etherscan verify. Set them via Hardhat's keystore:

```bash
pnpm hardhat keystore set SEPOLIA_RPC_URL
pnpm hardhat keystore set SEPOLIA_PRIVATE_KEY
pnpm hardhat keystore set ETHSCAN_API_KEY
```

## Build, test, deploy

```bash
# compile
pnpm hardhat build

# run the test suite
pnpm hardhat test

# deploy AuditLogFactory to Sepolia via Ignition
pnpm hardhat ignition deploy ignition/modules/AuditLogFactory.ts --network sepolia

# verify on Etherscan (optional)
pnpm hardhat verify --network sepolia <DEPLOYED_FACTORY_ADDRESS>
```

After deploying, copy the factory address into `web/.env`:

```
VITE_FACTORY_ADDRESS=0x...
```

The web UI will then let users deploy their personal `AuditLog` from the
Onboarding page.
