# Demo video — script

Target **2:30**. The submissions repo calls video *"the single most useful thing for a
reviewer if the app needs setup"*, and a reviewer is watching dozens of these, so the first
fifteen seconds have to show something real rather than introduce you.

**The constraint this script is built around:** you cannot demo a claim. The button only
appears on your own connected wallet, and you do not have a funded wallet holding a DAMM v2
position with fees. Pretending otherwise is the fastest way to lose credibility with someone
who will check. So the claim is proved in a terminal instead — which is *more* convincing to
a technical reviewer than a button press, because they can reproduce it.

---

## Before you record

**Have open, in this order, and pre-loaded so nothing spins during the take:**

1. `https://crumbs-tau-nine.vercel.app/?a=9QqQpr3N8skGNRvJsN3VzgLbgXFu4ipEtYNUz5qnvUvN`
2. A second tab on `https://crumbs-tau-nine.vercel.app` (empty, for the `.cook` demo)
3. A terminal in the repo, cleared, font size up (~16pt), window about 1000px wide

**Settings**

- QuickTime → File → New Screen Recording. Free, already installed.
- Record a **window**, not the full screen — no desktop clutter, no other tabs.
- Hide the bookmarks bar (`⌘⇧B`) and close unrelated tabs.
- 1920×1080 if your display allows; 1280×720 is fine.
- Do a 20-second test take first and listen back. Room echo is the usual killer.

**Voice or captions:** voice is better — a reviewer can look at the screen while listening.
If you would rather not, record silent and add the spoken lines as on-screen text; the
script works either way. Do not use a robot TTS voice, it reads as low effort.

**Tone:** flat and factual. Every claim below is checkable, and that is the whole appeal.
No "revolutionary", no price talk, no emoji.

---

## Shot 1 — the hook (0:00–0:20)

**Screen:** tab 1, already loaded, scrolled to the **Liquidity positions** panel so the
orange "2 with unclaimed fees" badge is the first thing visible. Do not start at the top of
the page.

> "This wallet has fees sitting in two liquidity positions it has already withdrawn from.
> Point eight wrapped COOK, three hundred and ten MON. Nobody has claimed them.
>
> They're not being ignored. Their owner can't see them."

Slowly scroll up through the allocation bars to the token table so the whole page registers.

---

## Shot 2 — why they're invisible (0:20–0:55)

**Screen:** the Liquidity positions panel again, cursor resting on the line of body text
that says positions are bearer NFTs.

> "A Cookiebox DAMM v2 position has no owner field. Not one that's hard to read — the
> account doesn't contain one. Ownership is bearer: whoever holds the position NFT owns
> the position.
>
> So there's nothing for a wallet to look up. It isn't a missing feature. A wallet
> structurally cannot list these.
>
> Same for launchpad buys, for a different reason. Before a pool graduates your stake is a
> program-tracked share, not a token — Cookie Chain's own MCP docs say it doesn't appear in
> a balance query."

**Optional, strong if you're comfortable:** cut to the repo's `src/lib/liquidity.ts` and
scroll the Position field list, pausing on the absence of an owner. Two seconds, no
narration over it.

---

## Shot 3 — how it finds them (0:55–1:20)

**Screen:** stay on the app; hover the position card's pool link so the address is visible.

> "Crumbs doesn't scan the program for these. It takes the token accounts your wallet
> already holds, filters down to the supply-one, zero-decimal mints — those are the
> position NFTs — and derives the position address from each one.
>
> So finding them costs no extra work. Those accounts were already fetched to build your
> token list."

---

## Shot 4 — it works on anyone (1:20–1:50)

**Screen:** switch to tab 2. Type `moon.cook` into the inspect box. Let it resolve on
camera — do not cut. Then scroll down to that wallet's positions.

> "You don't need a wallet to use this. Every read is public, so you can inspect any
> address — or any dot-cook name.
>
> That's moon dot cook. It resolves to a wallet whose display name is actually
> cooker dot cook, because forward and reverse resolution are separate things and the app
> handles both.
>
> Five liquidity positions here. One with fees owed."

---

## Shot 5 — the claim, proved in the terminal (1:50–2:20)

**Screen:** cut to the terminal. Run it live:

```bash
node scripts/simulate-claim.mjs
```

Let the output land, then hold on the log lines for a beat.

> "Claiming builds an instruction against the pool. Cookie Chain is mainnet-only — no
> faucet, no testnet — so a failed transaction costs real money. Everything simulates
> before it asks you to sign.
>
> This is that simulation, against a live position with fees owed. Error: null. And there
> are the two transfers, moving the exact amounts from the first shot.
>
> No private key, no funds — simulation runs with signature verification off, so anyone can
> reproduce this in one command."

**Then say this. Do not skip it:**

> "What I haven't done is broadcast a signed claim. I don't have a funded wallet holding a
> position with fees. The simulation proves the program accepts the instruction; it can't
> prove the network lands it, and I'm not going to claim otherwise."

*If you fund a wallet and land a real claim before submitting, replace that paragraph with
a screen recording of the actual claim and say so. That is strictly better — but only if it
really happened.*

---

## Shot 6 — close (2:20–2:30)

**Screen:** back to the app, top of the page, logo and title visible.

> "Crumbs. Open source, MIT. Live link and repo below.
>
> The layouts came from Cookie Chain's own cookie-mcp — I verified them against mainnet
> rather than trusting them. Position decodes to four hundred and eight bytes, Pool to
> eleven twelve, which is exactly what the chain returns."

**End card, on screen for the last three seconds:**

```
crumbs-tau-nine.vercel.app
github.com/paulandrew12/crumbs
```

---

## Sixty-second cut, for X

The thread wants something shorter. Same footage, this order:

| Time | Shot |
| --- | --- |
| 0:00–0:15 | Shot 1, hook — the unclaimed fees |
| 0:15–0:35 | Shot 2, first paragraph only — no owner field, bearer NFT |
| 0:35–0:50 | Shot 4 — `moon.cook` resolving |
| 0:50–1:00 | Shot 6 — close and links |

Drop the terminal beat from this cut. It needs the full version's setup to land, and X
autoplays muted — the moving `.cook` resolution reads better in silence than a wall of log
output.

---

## Things that will cost you marks

- **Dead air while data loads.** Everything is pre-loaded for a reason. If you must load
  live, cut the wait in the edit.
- **Reading the README aloud.** The reviewer has it. Show the running thing.
- **Claiming the claim works.** Shot 5 is worded carefully. Keep it that way.
- **Stale numbers.** Re-run `node scripts/probe-damm.mjs` the day you record; if the fee
  figures have moved, update your spoken lines to match what is on screen.
- **A tour of the codebase.** Tempting, and it kills pace. One two-second file glimpse in
  Shot 2 is the whole budget.
