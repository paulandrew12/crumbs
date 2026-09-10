"use client";

import Image from "next/image";
import { useState } from "react";
import type { Holding } from "@/lib/portfolio";
import { explorerAddress } from "@/lib/chain";

function Thumb({ nft }: { nft: Holding }) {
  const [broken, setBroken] = useState(false);
  if (!nft.image || broken) {
    return <div className="nft-thumb nft-thumb-empty">no art</div>;
  }
  return (
    <Image
      className="nft-thumb"
      src={`/api/icon?url=${encodeURIComponent(nft.image)}`}
      alt=""
      width={96}
      height={96}
      onError={() => setBroken(true)}
    />
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
