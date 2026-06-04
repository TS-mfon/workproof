"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { TxToastProvider } from "@/components/shared/TxToast";
import { WrongNetworkBanner } from "@/components/shared/WrongNetworkBanner";

export function Providers({ children, wagmiCookie }: { children: ReactNode; wagmiCookie?: string | null }) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig, wagmiCookie ?? undefined);
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#3B82F6",
            accentColorForeground: "white",
            borderRadius: "medium",
            overlayBlur: "small"
          })}
        >
          <TxToastProvider>
            <WrongNetworkBanner />
            {children}
          </TxToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
