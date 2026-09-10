"use client";

import type { Portfolio } from "@/lib/portfolio";
import { formatCook, formatUsd } from "@/lib/format";

export function SummaryTiles({
  portfolio,
  loading,
}: {
  portfolio: Portfolio | null;
  loading: boolean;
}) {
  const priced = portfolio?.holdings.filter((h) => h.valueUsd !== undefined).length ?? 0;
  const dash = loading ? "…" : "—";

  return (
    <div className="tiles">
      <div className="tile">
        <span className="tile-label">Token value</span>
        <span className="tile-value">
          {portfolio ? formatUsd(portfolio.totalValueUsd) : dash}
        </span>
        <span className="tile-note">
          {portfolio ? `${priced} of ${portfolio.holdings.length} priced` : " "}
        </span>
      </div>

      <div className="tile">
        <span className="tile-label">Native COOK</span>
        <span className="tile-value">
          {portfolio ? formatCook(portfolio.nativeLamports) : dash}
        </span>
        <span className="tile-note">pays network fees</span>
      </div>

      <div className="tile">
        <span className="tile-label">Distinct tokens</span>
        <span className="tile-value">{portfolio ? portfolio.holdings.length : dash}</span>
        <span className="tile-note">
          {portfolio
            ? `across ${portfolio.holdings.reduce((n, h) => n + h.accounts, 0)} accounts`
            : " "}
        </span>
      </div>
    </div>
  );
}
