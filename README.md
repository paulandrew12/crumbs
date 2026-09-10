# Crumbs

A portfolio view for [Cookie Chain](https://www.cookiechain.wtf) that shows the positions
your wallet cannot.

Cookie Chain has 22 live apps — two DEX aggregators, a launchpad, an NFT marketplace,
three liquidity venues, liquid staking, a bridge, a name service — and no way to see what
you hold across them. Worse, some of it is structurally invisible: the sponsor's own
`cookie-mcp` documents that pre-graduation launchpad holdings are *"program-tracked curve
shares, not SPL tokens — they do not appear in `get_balance`."* The same is true of LP
positions, staked bCOOK, and unclaimed creator fees.

Crumbs reads all of it into one page, then adds a single write path: claim what's claimable.

> **Status: Phase 3.** Token holdings, DAMM v2 liquidity positions with unclaimed fees,
> collectibles, and launchpad curve positions — for any address. Claim actions next.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No `.env.local` is needed — the defaults in
[`src/lib/chain.ts`](src/lib/chain.ts) point at the public Cookie Chain endpoints. Copy
`.env.local.example` if you want to override them.

You will need [Nightly](https://nightly.app) with Cookie Chain added as a custom SVM
network (RPC `https://rpc.cookiescan.io`), and a little COOK for fees — bridge it from
Solana at [hyperlane.cookiescan.io](https://hyperlane.cookiescan.io).

## What Phase 1 covers

| Bounty requirement | Where |
| --- | --- |
| Connect a wallet (Nightly) | [`providers.tsx`](src/app/providers.tsx), [`ConnectBar.tsx`](src/components/ConnectBar.tsx) |
| Display connected address | [`BalancePanel.tsx`](src/components/BalancePanel.tsx) |
| Execute transactions | [`useSendMemo.ts`](src/hooks/useSendMemo.ts) |
| Transaction confirmation handling | `useSendMemo.ts` — blockhash-bounded `confirmTransaction` |
| Error handling and user feedback | [`errors.ts`](src/lib/errors.ts), [`MemoDemo.tsx`](src/components/MemoDemo.tsx) |
| View application-specific data | [`portfolio.ts`](src/lib/portfolio.ts), [`HoldingsTable.tsx`](src/components/HoldingsTable.tsx) |
| Interact with on-chain functionality | `getTokenAccountsByOwner` across SPL and Token-2022 |

## Reading a portfolio

Connecting a wallet is a convenience, not a requirement — every read is public, so you can
paste any address in and inspect it. That also means the app demos without a funded wallet.

### Balances come from the chain, metadata from the indexer

The Cookiescan DAS API returns balances *and* prices, so it is tempting to use it for
everything. Measuring it first showed why that would be wrong:

- **`getAssetsByOwner` returns one item per token account, not per mint.** Our test wallet
  has 44 token accounts across 14 mints — 21 of them wCOOK alone — and DAS returns 44
  items, many sharing an `id`. Keying that response by mint silently discards balances.
- **`token_info.balance` is a float.** It matches the RPC exactly, but token supplies here
  routinely exceed 2^53 base units, so summing floats loses precision on exactly the
  wallets that need it most.
- **`token_info.associated_token_address` is empty**, so a DAS item cannot be mapped back
  to the account it came from.
- **`showNativeBalance` is accepted but returns null.** Native COOK comes from
  `connection.getBalance`.

So the RPC is the source of truth for balances — raw integer amounts, aggregated per mint
in `bigint` — and DAS is the metadata and price oracle, keyed by mint. Verified against the
chain: the 21 wCOOK accounts sum to `13,785,827.014577584`, which is what the app displays.

### Two things the indexer gets wrong, and what we do about it

- **Zero prices.** DAS returns `price_per_token: 0` for mints it does not price, wCOOK
  among them. Rendering that as "$0.00" would tell someone holding 13.7M wCOOK that it is
  worthless, so a zero price is treated as *unpriced* and the row reads "—".
- **`searchAssets` lies about NFTs.** `searchAssets` with `tokenType: "nonFungible"`
  returns 0 across the entire chain, which looks like "this indexer has no NFTs". It is a
  quirk of that method: `getAssetsByOwner` returns collectibles perfectly well, as
  `interface: "V1_NFT"`. Crumbs splits those out of the token table on that field. Trusting
  the first result would have meant building a whole redundant Metaplex read path.

## Liquidity positions

This is the part of a Cookie Chain portfolio that is genuinely lost otherwise.

A DAMM v2 position **has no owner field**. Ownership is bearer: whoever holds the position
NFT owns the position. So Crumbs does not scan the program — it filters the wallet's
existing token accounts down to supply-1, zero-decimal mints and derives
`["position", nft_mint]` for each. Discovery costs one batched read over accounts already
fetched for the token table.

Layouts were computed from cookie-mcp's `cp_amm` IDL and then checked against mainnet
rather than trusted: `Position` sizes to **408 bytes** and `Pool` to **1112**, which is
exactly what the chain returns. Decoded fees match too — wallet `9QqQpr3N…` reports
`fee_a_pending: 805530778` and `fee_b_pending: 310799356` on-chain, and the app renders
0.8055 wCOOK and 310.7993 MON.

**Why this matters more than the launchpad.** The original plan made launchpad curve
shares the headline. Measuring first showed the whole MomoSwap launchpad holds **two
pools**, both test pools created by the cookie-mcp maintainer, with zero live and zero
graduated. DAMM v2 has **176 positions across 15 pools, 27 carrying unclaimed fees** — and
most of those have no remaining liquidity, meaning someone withdrew and left the fees
behind. The launchpad decoder ships anyway (it is verified and cheap, and it lights up if
the launchpad ever fills), but it is a section, not the pitch.

### Token artwork

Two problems, both handled in [`/api/icon`](src/app/api/icon/route.ts):

1. Metadata points at arbitrary IPFS gateways that serve
   `Cross-Origin-Resource-Policy: same-origin`, so the browser refuses to paint the image.
   The route re-serves it from our own origin.
2. The art is wildly oversized — the bCOOK logo is **640 KB** for a 28px slot, and a full
   portfolio would pull roughly **9 MB** of icons. Pointing `next/image` at our own route
   downscales server-side: 640 KB becomes **2.7 KB**, and the page's whole icon payload is
   about 8.5 KB.

Because the route fetches a URL supplied by on-chain data, it is an SSRF surface. It
enforces an http/https scheme, blocks loopback, private, link-local and `.internal` hosts,
requires an `image/*` content type, caps the body at 2 MB, and times out at 6s. Gateways
that miss the timeout fall back to a monogram, which is also what unindexed mints get.

## The write path

Every money-moving action in Crumbs runs the same five steps, surfaced in the UI as they
happen:

```
build → simulate → sign → send → confirm
```

Simulation is not optional. Cookie Chain has **no faucet, no testnet, and no devnet** —
it is mainnet-only, so a transaction that fails costs real COOK. Simulating before asking
for a signature means a doomed transaction costs nothing and never reaches the chain.

Phase 3 reuses this pipeline unchanged; only the instruction builder differs.

### Failure modes handled

`explainError()` in [`src/lib/errors.ts`](src/lib/errors.ts) classifies what the wallet,
the RPC, or the runtime throws, and each branch says what to do next:

- **Declined** — the popup was dismissed; nothing was sent
- **Expired** — Cookie Chain produces ~1s blocks, so blockhashes age out quickly
- **Not enough COOK** — with a pointer to the bridge
- **Simulation failed** — decodes `custom program error: 0x…` and shows the program logs
- **Rate limited** — `rpc.cookiescan.io` is a shared community endpoint
- **Unreachable** — network or RPC outage

## Notes on Cookie Chain

- It is an **SVM L1 with its own genesis** (`9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`),
  running `solana-core` 4.1.2 — Solana-compatible tooling, different chain.
- **COOK** is the native fee token, 9 decimals, lamports-style precision.
- Standard programs sit at their canonical Solana addresses; they were embedded at genesis.
  See [`src/lib/chain.ts`](src/lib/chain.ts).
- The docs list the websocket as `https://wss.cookiescan.io`; web3.js needs a `wss://`
  scheme, so `chain.ts` normalises it.
- The public RPC only retains about **25 days** of history (first available block
  22,138,261 against slot 24.3M). Crumbs is built around current state, not history —
  a "portfolio over time" chart is not honestly possible on this endpoint.

## Credits

Account decoding for launchpad and LP positions (Phase 2) adapts
[`cookiechain/cookie-mcp`](https://github.com/cookiechain/cookie-mcp), MIT licensed.

## Licence

MIT
