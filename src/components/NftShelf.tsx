"use client";

import Image from "next/image";
import { useState } from "react";
import type { Holding } from "@/lib/portfolio";
import { explorerAddress } from "@/lib/chain";

function Thumb({ nft }: { nft: Holding }) {
  const [broken, setBroken] = useState(false);
  // Same reasoning as the token icons: a placeholder underneath, never a
  // blank square while an IPFS gateway takes its time.
  return (
    <span className="nft-slot">
      <span className="nft-thumb-empty" aria-hidden="true">
        no art
      </span>
      {nft.image && !broken ? (
        <Image
          className="nft-art"
          src={`/api/icon?url=${encodeURIComponent(nft.image)}`}
          alt=""
          width={96}
          height={96}
          onError={() => setBroken(true)}
        />
      ) : null}
    </span>
  );
}

/** Collectibles. Position NFTs are excluded upstream — those are plumbing. */
export function NftShelf({ nfts }: { nfts: Holding[] }) {
  if (nfts.length === 0) return null;

  return (
    <section className="panel">
      <div className="row">
        <h2>Collectibles</h2>
        <span className="tile-note">{nfts.length}</span>
      </div>

      <div className="nft-grid">
        {nfts.map((nft) => (
          <a
            key={nft.mint}
            className="nft"
            href={explorerAddress(nft.mint)}
            target="_blank"
            rel="noreferrer"
          >
            <Thumb nft={nft} />
            <span className="nft-name" title={nft.name}>
              {nft.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
