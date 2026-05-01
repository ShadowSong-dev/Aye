import { createConfig, http } from 'wagmi'
import { sepolia, mainnet } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC || undefined

export const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected(), metaMask()],
  transports: {
    [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
    [mainnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
