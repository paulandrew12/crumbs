"use client";

import type { Portfolio } from "@/lib/portfolio";
import { formatUsd } from "@/lib/format";

/**
 * Where the value sits, ranked.
 *
 * Deliberately bars rather than a donut: on a real wallet one token is
 * routinely 90%+ of the total, which makes a pie a single wedge and a stacked
 * bar a solid block. Ranked bars keep both magnitude and the long tail
 * readable.
 *
 * One series, so no legend and one hue — #34A79A, checked against the dark
 * surface for lightness band, chroma, and contrast rather than picked by eye.
 * The holdings table above is the table view of this same data.
 */
export function Allocation({ portfolio }: { portfolio: Portfolio }) {
  const priced = portfolio.holdings.filter(
    (h) => h.valueUsd !== undefined && h.valueUsd > 0,
  );
  if (priced.length === 0) return null;

  const max = Math.max(...priced.map((h) => h.valueUsd ?? 0));
  const total = portfolio.totalValueUsd;
  const unpriced = portfolio.holdings.length - priced.length;

  return (
    <section className="panel">
      <div className="row">
        <h2>Token value</h2>
        <span className="tile-note">{formatUsd(total)} total</span>
      </div>

      <ol className="alloc">
        {priced.map((h) => {
          const value = h.valueUsd ?? 0;
          const share = total > 0 ? (value / total) * 100 : 0;
          return (
            <li key={h.mint} className="alloc-row">
              <span className="alloc-label" title={h.name}>
                {h.symbol === "—" ? h.name : h.symbol}
              </span>

              <span className="alloc-track">
                <span
                  className="alloc-bar"
                  style={{ width: `${Math.max((value / max) * 100, 1.5)}%` }}
                  title={`${h.name}: ${formatUsd(value)} (${share.toFixed(1)}%)`}
                />
              </span>

              <span className="alloc-value">{formatUsd(value)}</span>
              <span className="alloc-share">{share.toFixed(0)}%</span>
            </li>
          );
        })}
      </ol>

      {unpriced > 0 ? (
        <p className="footnote">
          {unpriced} holding{unpriced === 1 ? "" : "s"}{" "}
          {unpriced === 1 ? "has" : "have"} no price from the indexer and{" "}
          {unpriced === 1 ? "is" : "are"} left out rather than counted as zero.
        </p>
      ) : null}
    </section>
  );
}
