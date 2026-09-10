# X thread — draft

The brief requires the thread to (a) explain what the app does, (b) show how to use it,
and (c) point at the Cookie Chain Bridge. All three are covered below.

**Re-run the numbers before posting.** The figures in post 1 and 7 were measured on
10 Sep 2026 and the chain moves. One command refreshes them:

```bash
node scripts/probe-damm.mjs
```

Written plain rather than hyped, on purpose: the claim in post 1 is checkable by anyone
in about a minute, and that is the whole appeal. Do not add price predictions or emoji
walls — it undercuts the one thing this thread has going for it.

---

**1/**

Right now on Cookie Chain there are 27 liquidity positions holding fees nobody has
claimed.

Most of them have no liquidity left at all. Their owners withdrew months ago and left the
fees sitting there.

They're not being ignored. They're invisible.

**2/**

A DAMM v2 liquidity position has no owner field.

Not "an owner field that's hard to read" — the account literally does not contain one.
Ownership is bearer: whoever holds the position NFT owns the position.

So there is nothing for a wallet to look up. It cannot list what it cannot query.

**3/**

Same for launchpad buys. Before a pool graduates your stake is a program-tracked share,
not an SPL token — the sponsor's own docs say it plainly:

"program-tracked curve shares, not SPL tokens — they do not appear in get_balance"

Your balance is correct. It's just not the whole picture.

**4/**

So I built Crumbs.

It reads every token account you hold, filters down to the supply-1 zero-decimal mints,
and derives the position PDA from each one. Discovery costs no extra scan, because those
accounts were already fetched for your token list.

Then it shows you what's owed.

**5/**

You don't need a wallet to look.

Every read is public. Paste any address — or any .cook name — and inspect it.

Try: moon.cook

That resolves to a wallet whose *primary* name is cooker.cook, which is a nice
demonstration that forward and reverse resolution are separate things.

**6/**

Claiming simulates before it asks you to sign.

Cookie Chain is mainnet-only — no faucet, no testnet, no devnet — so a transaction that
fails costs real COOK. Simulating first means a doomed claim costs nothing and never
reaches the chain.

The whole path: build → simulate → sign → send → confirm.

**7/**

Some numbers from building it, all checkable:

· DAMM v2 — 176 positions, 15 pools, 27 with unclaimed fees
· MomoSwap launchpad — 2 pools, both test canaries
· CookOven — 108 .cook names, 17 primaries

I planned the launchpad as the headline. Measuring first is why it isn't.

**8/**

Need COOK to try it? Bridge from Solana, 1:1, via the Cookie Chain bridge:

hyperlane.cookiescan.io

A few dollars covers everything — fees are negligible and a program deploy is about $0.05.

**9/**

Live: https://crumbs-tau-nine.vercel.app
Source: https://github.com/paulandrew12/crumbs

Open source, MIT. Position and pool layouts adapted from @TheCookieChain's cookie-mcp,
then verified against mainnet rather than trusted — Position sizes to 408 bytes and Pool
to 1112, which is exactly what the chain returns.

Built for the Superteam bounty.
