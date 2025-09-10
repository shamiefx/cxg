"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, trustWallet, tokenPocketWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, http, createConfig } from "wagmi";
import { mainnet, sepolia, polygon, base, arbitrum, optimism, bsc } from "wagmi/chains";
import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

type Props = { children: ReactNode };

export default function Providers({ children }: Props) {
  // App metadata for WalletConnect deep links (improves mobile UX)
  const appName = (process.env.NEXT_PUBLIC_APP_NAME || "CXGP").trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://coin-of-gold.web.app").trim();
  // Using a public asset path as a lightweight app icon (optional)
  const appIcon = "/vercel.svg";

  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const hasRealWc = !!wcProjectId && wcProjectId !== "demo";

  const chains = useMemo(() => [bsc, mainnet, polygon, base, arbitrum, optimism, sepolia] as const, []);

  const connectors = useMemo(() => {
    // Only include WalletConnect-based wallets if we have a real project ID
    const wallets = hasRealWc
      ? [metaMaskWallet, trustWallet, tokenPocketWallet, walletConnectWallet]
      : [metaMaskWallet];
    const groups = [{ groupName: "Popular", wallets }];
    const projectId = hasRealWc ? wcProjectId! : "demo";
    return connectorsForWallets(groups, {
      appName,
      projectId,
      appDescription: "CXGP — Buy, stake, and burn on BSC.",
      appUrl,
      appIcon,
    });
  }, [appName, appIcon, appUrl, hasRealWc, wcProjectId]);

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
          <Toaster position="top-right" toastOptions={{
            style: { background: "#0a0a0a", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" },
            success: { iconTheme: { primary: "#22c55e", secondary: "#0a0a0a" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0a0a0a" } }
          }} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
