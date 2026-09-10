"use client";

import { Buffer } from "buffer";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL, WS_URL } from "@/lib/chain";

import "@solana/wallet-adapter-react-ui/styles.css";

// web3.js reaches for Buffer, which browsers do not provide. Next.js does not
// polyfill it in the App Router, so we install it once here.
if (typeof globalThis !== "undefined" && !("Buffer" in globalThis)) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const config = useMemo(
    () => ({ commitment: "confirmed" as const, wsEndpoint: WS_URL }),
    [],
  );

  // Nightly implements the Wallet Standard, so it registers itself and shows
  // up in the modal without an explicit adapter. Listing adapters here would
  // only be needed for a wallet that predates the standard.
  return (
    <ConnectionProvider endpoint={RPC_URL} config={config}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
