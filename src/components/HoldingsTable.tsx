"use client";

import { useState } from "react";
import Image from "next/image";
import type { Holding } from "@/lib/portfolio";
import { explorerAddress } from "@/lib/chain";
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
  shortAddress,
} from "@/lib/format";

function TokenIcon({ holding }: { holding: Holding }) {
  const [broken, setBroken] = useState(false);
  const initials = (holding.symbol === "—" ? holding.name : holding.symbol)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();

  if (!holding.image || broken) {
    return <span className="icon fallback">{initials || "?"}</span>;
  }
  // Two problems with token art, both solved here.
  //
  // 1. It lives on arbitrary IPFS gateways that serve a restrictive
  //    Cross-Origin-Resource-Policy, so the browser refuses to paint it.
  //    /api/icon re-serves it from our own origin.
  // 2. It is wildly oversized — one bCOOK logo is 640 KB for a 28px slot, and
  //    a full portfolio would pull ~9 MB of icons. Pointing next/image at our
  //    own route downscales server-side. A same-origin path needs no
  //    remotePatterns allowlist, which an arbitrary metadata URI could never
  //    satisfy anyway.
  return (
    <Image
      className="icon"
      src={`/api/icon?url=${encodeURIComponent(holding.image)}`}
      alt=""
      width={28}
      height={28}
      unoptimized={false}
      onError={() => setBroken(true)}
    />
  );
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>
        No token balances on Cookie Chain for this address. Empty accounts are
        hidden.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="holdings">
        <thead>
          <tr>
            <th>Token</th>
            <th className="num">Balance</th>
            <th className="num">Price</th>
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const change = formatPercent(h.priceChange24h);
            return (
              <tr key={h.mint}>
                <td>
                  <div className="tok">
                    <TokenIcon holding={h} />
                    <div className="tok-text">
                      <span className="tok-name" title={h.name}>
                        {h.name}
                      </span>
                      <span className="tok-sub">
                        <a
                          href={explorerAddress(h.mint)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddress(h.mint)}
                        </a>
                        {h.accounts > 1 ? (
                          <span
                            className="chip"
                            title={`Balance summed across ${h.accounts} token accounts`}
                          >
                            {h.accounts} accounts
                          </span>
                        ) : null}
                        {h.isToken2022 ? <span className="chip">Token-2022</span> : null}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="num">
                  <span className="amt">
                    {formatTokenAmount(h.amount, h.decimals)}
                  </span>
                  <span className="sym">{h.symbol}</span>
                </td>

                <td className="num">
                  {h.pricePerToken !== undefined ? (
                    <>
                      <span className="amt">
                        {h.pricePerToken < 0.01
                          ? `$${h.pricePerToken.toPrecision(3)}`
                          : formatUsd(h.pricePerToken)}
                      </span>
                      {change ? (
                        <span
                          className={
                            (h.priceChange24h ?? 0) >= 0 ? "delta up" : "delta down"
                          }
                        >
                          {change}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="sym">unpriced</span>
                  )}
                </td>

                <td className="num">
                  <span className="amt">{formatUsd(h.valueUsd)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
