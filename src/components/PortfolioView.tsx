"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { SummaryTiles } from "./SummaryTiles";
import { HoldingsTable } from "./HoldingsTable";
import { LpPositions } from "./LpPositions";
import { NftShelf } from "./NftShelf";
import { Allocation } from "./Allocation";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { looksLikeName, normalizeLabel, resolveName } from "@/lib/names";
import { useConnection } from "@solana/wallet-adapter-react";

/**
 * The portfolio, for whichever address is in focus.
 *
 * Connecting a wallet is a convenience, not a requirement — every read here
 * is public, so the app works on any address you paste in. That also means
 * it demos without a funded wallet.
 */
export function PortfolioView() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [manual, setManual] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // A freshly connected wallet takes focus, unless you are inspecting
  // something else on purpose.
  useEffect(() => {
    if (connected && publicKey) setSubject(publicKey.toBase58());
  }, [connected, publicKey]);

  const { data, loading, error, refresh } = usePortfolio(subject);

  const isOwnWallet = Boolean(
    publicKey && subject && publicKey.toBase58() === subject,
  );

  async function inspect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manual.trim();
    if (!trimmed) return;
    setLookupError(null);

    // A `.cook` name is one derived read away from its owner, so accept
    // either here rather than making people paste base58.
    if (looksLikeName(trimmed)) {
      setResolving(true);
      try {
        const owner = await resolveName(connection, trimmed);
        if (owner) {
          setSubject(owner);
          return;
        }
        setLookupError(`${normalizeLabel(trimmed)}.cook is not registered.`);
        return;
      } catch {
        setLookupError("Could not reach the name service. Try again.");
        return;
      } finally {
        setResolving(false);
      }
    }
    setSubject(trimmed);
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
          placeholder="alice.cook or any address…"
          aria-label="Address to inspect"
          spellCheck={false}
        />
        <button
          className="action ghost"
          type="submit"
          disabled={!manual.trim() || resolving}
        >
          {resolving ? "Resolving…" : "Inspect"}
        </button>
      </form>

      {lookupError ? (
        <p style={{ margin: 0, color: "var(--danger)", fontSize: 14 }}>
          {lookupError}
        </p>
      ) : null}

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
            {data?.primaryName ? (
              <span className="cook-name">{data.primaryName}.cook</span>
            ) : null}
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

          {data && isEmpty(data) ? (
            <div className="empty">
              <h3>Nothing here yet</h3>
              <p>
                This address holds no tokens, liquidity positions or
                collectibles on Cookie Chain, and no COOK for fees.
              </p>
              <p>
                Cookie Chain is a separate L1 from Solana, so a Solana address
                will look empty here even when it holds plenty over there.
              </p>
            </div>
          ) : null}

          {data && !isEmpty(data) ? (
            <HoldingsTable holdings={data.holdings} />
          ) : null}

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

    {data && !isEmpty(data) ? <Allocation portfolio={data} /> : null}

    {data && data.lpHoldings.length > 0 ? (
      <LpPositions holdings={data.lpHoldings} onClaimed={refresh} />
    ) : null}

    {data && data.nfts.length > 0 ? <NftShelf nfts={data.nfts} /> : null}
    </>
  );
}

/**
 * A wallet with nothing at all. Worth calling out explicitly, because the
 * most likely cause is pasting a Solana address into a different chain.
 */
function isEmpty(data: {
  holdings: unknown[];
  lpHoldings: unknown[];
  nfts: unknown[];
  nativeLamports: number;
}): boolean {
  return (
    data.holdings.length === 0 &&
    data.lpHoldings.length === 0 &&
    data.nfts.length === 0 &&
    data.nativeLamports === 0
  );
}
