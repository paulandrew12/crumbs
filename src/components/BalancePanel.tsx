"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCookBalance } from "@/hooks/useCookBalance";
import { explorerAddress } from "@/lib/chain";
import { formatCook } from "@/lib/format";

export function BalancePanel() {
  const { publicKey, connected } = useWallet();
  const { lamports, loading, error, refresh } = useCookBalance();

  if (!connected || !publicKey) {
    return (
      <section className="panel">
        <h2>Wallet</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Connect Nightly to read this wallet&apos;s balance on Cookie Chain.
          Nothing is sent anywhere until you sign.
        </p>
      </section>
    );
  }

  const address = publicKey.toBase58();

  return (
    <section className="panel">
      <h2>Wallet</h2>

      <div className="row">
        <div className="balance">
          {lamports === null ? (loading ? "…" : "—") : formatCook(lamports)}
          <span>COOK</span>
        </div>
        <button className="action ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Address</div>
        <div className="addr">{address}</div>
      </div>

      {error ? (
        <div className="result bad">
          <h3>Could not read balance</h3>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="meta">
        <a href={explorerAddress(address)} target="_blank" rel="noreferrer">
          View on Cookiescan ↗
        </a>
        <span>Balance updates live over the websocket</span>
      </div>
    </section>
  );
}
