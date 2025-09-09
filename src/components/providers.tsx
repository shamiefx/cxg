"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, trustWallet, tokenPocketWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, http, createConfig } from "wagmi";
import { mainnet, sepolia, polygon, base, arbitrum, optimism, bsc } from "wagmi/chains";
import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Props = { children: ReactNode };

export default function Providers({ children }: Props) {
  const appName = "CXG+";
  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const hasRealWc = !!wcProjectId && wcProjectId !== "demo";

  const chains = useMemo(() => [bsc, mainnet, polygon, base, arbitrum, optimism, sepolia] as const, []);

  const connectors = useMemo(() => {
    const wallets = [metaMaskWallet, trustWallet, tokenPocketWallet, ...(hasRealWc ? [walletConnectWallet] as const : [] )];
    const groups = [{ groupName: "Popular", wallets }];
    // Always pass a projectId for types, but exclude WalletConnect wallet when not configured
    const projectId = hasRealWc ? wcProjectId! : "disabled";
    return connectorsForWallets(groups, { appName, projectId });
  }, [appName, hasRealWc, wcProjectId]);

  const config = useMemo(() => createConfig({
    chains,
    transports: {
      [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL),
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [base.id]: http(),
      [arbitrum.id]: http(),
      [optimism.id]: http(),
      [sepolia.id]: http(),
    },
    connectors,
    ssr: true,
  }), [chains, connectors]);

  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} coolMode>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
