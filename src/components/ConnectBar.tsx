"use client";

import dynamic from "next/dynamic";

// The wallet button reads `window` on mount, so it must not be server-rendered.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="action" disabled>Connect wallet</button> },
);

export function ConnectBar() {
  return <WalletMultiButton />;
}
