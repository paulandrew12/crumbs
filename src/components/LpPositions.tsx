"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { LpHolding } from "@/lib/liquidity";
import { buildClaimFeesInstructions } from "@/lib/claim";
import { useTransaction } from "@/hooks/useTransaction";
import { TxSteps } from "./TxSteps";
import { explorerAddress, explorerTx } from "@/lib/chain";
import { formatTokenAmount, shortAddress } from "@/lib/format";

/**
 * Liquidity positions, unclaimed fees first.
 *
 * A DAMM v2 position is a bearer NFT with no owner field, so no wallet on
 * Cookie Chain shows it — and fees keep accruing to positions people have
 * already withdrawn from. This is the part of the portfolio that is genuinely
 * lost otherwise.
 */
export function LpPositions({
  holdings,
  onClaimed,
}: {
  holdings: LpHolding[];
  onClaimed?: () => void;
}) {
  const { publicKey, connected } = useWallet();
  const { state, send, reset, busy } = useTransaction();
  const [claiming, setClaiming] = useState<string | null>(null);

  if (holdings.length === 0) return null;

  const owed = holdings.filter((h) => h.hasUnclaimedFees).length;

  // Claims only make sense on your own positions: the program requires the
  // position-NFT holder to sign, so offering the button while inspecting
  // someone else's wallet would just produce a rejection.
  const isOwner = Boolean(
    connected && publicKey && holdings.length > 0 && publicKey.toBase58() === inspectedOwner(holdings),
  );

  async function claim(holding: LpHolding) {
    if (!publicKey) return;
    setClaiming(holding.position.address);
    await send(() => buildClaimFeesInstructions(holding, publicKey));
    onClaimed?.();
  }

  return (
    <section className="panel">
      <div className="row">
        <h2>Liquidity positions</h2>
        {owed > 0 ? (
          <span className="badge-owed">
            {owed} with unclaimed fees
          </span>
        ) : null}
      </div>

      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>
        Cookiebox DAMM v2. Positions are bearer NFTs with no owner field, so
        your wallet cannot list them — and fees keep accruing after you
        withdraw.
      </p>

      <div className="lp-list">
        {holdings.map((h) => (
          <article
            key={h.position.address}
            className={h.hasUnclaimedFees ? "lp lp-owed" : "lp"}
          >
            <div className="lp-head">
              <span className="lp-pair">
                {h.tokenA.symbol} / {h.tokenB.symbol}
              </span>
              <a
                href={explorerAddress(h.position.address)}
                target="_blank"
                rel="noreferrer"
                className="lp-link"
              >
                {shortAddress(h.position.address)} ↗
              </a>
            </div>

            <dl className="lp-facts">
              <div>
                <dt>Unclaimed fees</dt>
                <dd className={h.hasUnclaimedFees ? "owed" : ""}>
                  {h.hasUnclaimedFees ? (
                    <>
                      {h.position.feeAPending > 0n ? (
                        <span>
                          {formatTokenAmount(
                            h.position.feeAPending,
                            h.tokenA.decimals,
                          )}{" "}
                          {h.tokenA.symbol}
                        </span>
                      ) : null}
                      {h.position.feeBPending > 0n ? (
                        <span>
                          {formatTokenAmount(
                            h.position.feeBPending,
                            h.tokenB.decimals,
                          )}{" "}
                          {h.tokenB.symbol}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "none"
                  )}
                </dd>
              </div>

              <div>
                <dt>Liquidity</dt>
                <dd>
                  {!h.hasLiquidity
                    ? "withdrawn"
                    : h.position.unlockedLiquidity > 0n
                      ? "active"
                      : "locked permanently"}
                </dd>
              </div>

              <div>
                <dt>Pool</dt>
                <dd>
                  <a
                    href={explorerAddress(h.pool.address)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(h.pool.address)}
                  </a>
                </dd>
              </div>
            </dl>

            {h.hasUnclaimedFees && !h.hasLiquidity ? (
              <p className="lp-note">
                You withdrew this position but left the fees behind.
              </p>
            ) : null}

            {h.hasUnclaimedFees && isOwner ? (
              <div className="lp-actions">
                <button
                  className="action"
                  disabled={busy}
                  onClick={() => void claim(h)}
                >
                  {busy && claiming === h.position.address
                    ? "Claiming\u2026"
                    : "Claim fees"}
                </button>

                {claiming === h.position.address && state.phase !== "idle" ? (
                  <div className="lp-tx">
                    <TxSteps
                      state={state}
                      failedAt={state.phase === "failed" ? state.failedAt : -1}
                    />

                    {state.phase === "confirmed" ? (
                      <div className="result ok">
                        <h3>Fees claimed</h3>
                        <p>
                          Slot {state.slot.toLocaleString("en-US")} in{" "}
                          {(state.elapsedMs / 1000).toFixed(1)}s.
                        </p>
                        <div className="meta" style={{ marginTop: 8 }}>
                          <a
                            href={explorerTx(state.signature)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(state.signature, 8, 8)} \u2197
                          </a>
                          <button
                            className="action ghost"
                            style={{ padding: "2px 10px", fontSize: 12 }}
                            onClick={() => {
                              reset();
                              setClaiming(null);
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {state.phase === "failed" ? (
                      <div className="result bad">
                        <h3>{state.error.title}</h3>
                        <p>{state.error.detail}</p>
                        {state.error.logs?.length ? (
                          <details>
                            <summary
                              style={{
                                cursor: "pointer",
                                marginTop: 8,
                                fontSize: 12.5,
                                color: "var(--muted)",
                              }}
                            >
                              Program logs
                            </summary>
                            <pre className="logs">
                              {state.error.logs.join("\n")}
                            </pre>
                          </details>
                        ) : null}
                        <div className="meta" style={{ marginTop: 10 }}>
                          <button
                            className="action ghost"
                            style={{ padding: "4px 12px", fontSize: 12.5 }}
                            onClick={() => {
                              reset();
                              setClaiming(null);
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Whose positions these are. Every holding in a render comes from one
 * portfolio read, so the first one's NFT account settles it.
 */
function inspectedOwner(holdings: LpHolding[]): string | null {
  return holdings[0]?.ownerAddress ?? null;
}
