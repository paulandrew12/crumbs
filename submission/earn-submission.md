# Superteam Earn submission

Submit before **23 Sep 2026, 00:59 EAT** (2026-09-22 21:59 UTC).

The brief asks for: live application URL, GitHub repository, and relevant program /
contract / token / application addresses.

---

## Live application URL

[VERCEL_URL]

## GitHub repository

https://github.com/paulandrew12/crumbs

## Relevant addresses

Crumbs deploys no program of its own — it reads and composes programs already on Cookie
Chain, which the brief explicitly encourages. The addresses it touches:

| Program | Address | Used for |
| --- | --- | --- |
| Cookiebox DAMM v2 (cp-amm) | `DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY` | Position + Pool decoding, `claim_position_fee` |
| MomoSwap launchpad | `momoL7wu4TrXjnXMLCLzGsbx8Pm7XGgoYo7FVqDoqcw` | `UserPosition` curve shares |
| CookOven names | `H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA` | `.cook` forward + reverse resolution |
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Balances |
| Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | Balances |
| Associated Token Account | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | Idempotent claim destinations |
| Memo | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` | Write-path demonstration |

Endpoints: `rpc.cookiescan.io`, `wss.cookiescan.io`, `api.cookiescan.io` (DAS),
`api.momoswap.fun` (launchpad).

## Description

Crumbs is a portfolio view for Cookie Chain that surfaces the positions a wallet
structurally cannot show you.

A Cookiebox DAMM v2 liquidity position has no owner field — ownership is a bearer NFT — so
there is nothing for a wallet to query, and fees keep accruing to positions people have
already withdrawn from. As of 10 Sep 2026 there were 176 such positions across 15 pools,
27 of them carrying unclaimed fees, most with no liquidity remaining. MomoSwap launchpad
buys have the same problem for a different reason: before graduation a stake is a
program-tracked share rather than an SPL token, which the sponsor's own `cookie-mcp`
documents as invisible to a balance query.

Crumbs reads every SPL and Token-2022 account, aggregates per mint in `bigint`, derives
each DAMM v2 position from the position NFTs the wallet already holds, decodes launchpad
`UserPosition` accounts under each pool's actual owning program, resolves `.cook` names in
both directions, and ranks holdings by value. Unclaimed fees carry a claim action that
simulates before requesting a signature — Cookie Chain is mainnet-only, so a failed
transaction costs real COOK and a failed simulation costs nothing.

Every read is public, so any address or `.cook` name can be inspected without connecting a
wallet.

## What was verified, and how

Layouts were adapted from `cookiechain/cookie-mcp` (MIT, credited in the README) and then
checked against mainnet rather than trusted:

- `Position` computes to **408 bytes** and `Pool` to **1112** from the cp-amm IDL, which
  is exactly what the chain returns.
- Launchpad decoding matches the MomoSwap API's own `/position` response field for field,
  including `shares` and both payment totals.
- Balance aggregation matches an independent RPC sum: a wallet holding 21 wCOOK accounts
  totals `13,785,827.014577584`, which is what the app displays.
- The claim instruction simulates clean against a real position with pending fees:
  `err: null`, 45,494 compute units, and both `TransferChecked` calls visible in the logs.
  `scripts/simulate-claim.mjs` reproduces this in one command, with no key and no funds,
  because simulation runs with `sigVerify` disabled.

**Not verified:** a real signature and broadcast of a claim. Simulation proves the program
accepts the instruction; it cannot prove a wallet signs and the network lands it. That
needs a funded wallet holding a position with fees. [DELETE THIS PARAGRAPH ONLY IF YOU
ACTUALLY LAND ONE BEFORE SUBMITTING.]

## Known limits, stated rather than hidden

- The public RPC retains roughly 25 days of history, so there is no portfolio-over-time
  chart. Current state only, by design.
- Holdings the indexer cannot price are excluded from the value breakdown and footnoted,
  rather than counted as zero. wCOOK is one of them.
- Staked bCOOK appears as an ordinary token holding; there is no separate staking view.
