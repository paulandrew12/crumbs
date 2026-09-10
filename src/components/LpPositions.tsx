"use client";

import type { LpHolding } from "@/lib/liquidity";
import { explorerAddress } from "@/lib/chain";
import { formatTokenAmount, shortAddress } from "@/lib/format";

/**
 * Liquidity positions, unclaimed fees first.
 *
 * A DAMM v2 position is a bearer NFT with no owner field, so no wallet on
 * Cookie Chain shows it — and fees keep accruing to positions people have
 * already withdrawn from. This is the part of the portfolio that is genuinely
 * lost otherwise.
 */
export function LpPositions({ holdings }: { holdings: LpHolding[] }) {
  if (holdings.length === 0) return null;

  const owed = holdings.filter((h) => h.hasUnclaimedFees).length;

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
          </article>
        ))}
      </div>
    </section>
  );
}
