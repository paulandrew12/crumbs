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

> **Status: Phase 1.** Wallet connection, native balance, and a proven end-to-end write
> path. The portfolio reads land in Phase 2 and claims in Phase 3.

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
