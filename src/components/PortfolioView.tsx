"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { SummaryTiles } from "./SummaryTiles";
import { HoldingsTable } from "./HoldingsTable";
import { LpPositions } from "./LpPositions";
import { NftShelf } from "./NftShelf";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/**
 * The portfolio, for whichever address is in focus.
 *
 * Connecting a wallet is a convenience, not a requirement — every read here
 * is public, so the app works on any address you paste in. That also means
 * it demos without a funded wallet.
 */
export function PortfolioView() {
  const { publicKey, connected } = useWallet();
  const [manual, setManual] = useState("");
  const [subject, setSubject] = useState<string | null>(null);

  // A freshly connected wallet takes focus, unless you are inspecting
  // something else on purpose.
  useEffect(() => {
    if (connected && publicKey) setSubject(publicKey.toBase58());
  }, [connected, publicKey]);

  const { data, loading, error, refresh } = usePortfolio(subject);

  const isOwnWallet = Boolean(
    publicKey && subject && publicKey.toBase58() === subject,
  );

  function inspect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manual.trim();
    if (trimmed) setSubject(trimmed);
  }

  return (
    <>
    <section className="panel">
      <div className="row">
        <h2>Holdings</h2>
        {subject ? (
          <button className="action ghost" onClick={refresh} disabled={loading}>
            {loading ? "Reading…" : "Refresh"}
          </button>
        ) : null}
      </div>

      <form className="row" onSubmit={inspect}>
        <input
          className="note"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Inspect any Cookie Chain address…"
          aria-label="Address to inspect"
          spellCheck={false}
        />
        <button className="action ghost" type="submit" disabled={!manual.trim()}>
          Inspect
        </button>
      </form>

      {!subject ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>
          Connect a wallet, or paste any address above. Everything on this page
          is a public read — no signature, and no COOK required.
        </p>
      ) : (
        <>
          <div className="subject">
            <span className="eyebrow">
              {isOwnWallet ? "Your wallet" : "Inspecting"}
            </span>
            <a href={explorerAddress(subject)} target="_blank" rel="noreferrer">
              {shortAddress(subject, 8, 8)} ↗
            </a>
            {!isOwnWallet && connected && publicKey ? (
              <button
                className="linkish"
                onClick={() => setSubject(publicKey.toBase58())}
              >
                back to my wallet
              </button>
            ) : null}
          </div>

          <SummaryTiles portfolio={data} loading={loading} />

          {error ? (
            <div className="result bad">
              <h3>Could not load this address</h3>
              <p>{error}</p>
            </div>
          ) : null}

          {loading && !data ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>
              Reading token accounts and metadata…
            </p>
          ) : null}

          {data ? <HoldingsTable holdings={data.holdings} /> : null}

          {data && data.unindexedMints.length > 0 ? (
            <p className="footnote">
              {data.unindexedMints.length} mint
              {data.unindexedMints.length === 1 ? " is" : "s are"} not in the
              Cookiescan indexer, so {data.unindexedMints.length === 1 ? "it has" : "they have"}{" "}
              no name or price. The balance is still read straight from the chain.
            </p>
          ) : null}
        </>
      )}
    </section>

    {data && data.lpHoldings.length > 0 ? (
      <LpPositions holdings={data.lpHoldings} onClaimed={refresh} />
    ) : null}

    {data && data.nfts.length > 0 ? <NftShelf nfts={data.nfts} /> : null}
    </>
  );
}
