import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { sepolia, mainnet } from 'wagmi/chains'

const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC || undefined
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

export const config = getDefaultConfig({
  appName: 'Aye',
  projectId,
  chains: [sepolia, mainnet],
  transports: {
    [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
    [mainnet.id]: http(),
  },
  ssr: false,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
