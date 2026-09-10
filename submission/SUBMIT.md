# Shipping checklist

Four TODOs below need real values before anything is submitted. Everything else is done.

## 1. Push the repo — done

<https://github.com/paulandrew12/crumbs> — public, `main`, commits authored as
`paulandrew12` so they link to the account.

## 2. Deploy — done

<https://crumbs-tau-nine.vercel.app>

Public (SSO protection disabled), verified serving live chain data, and the SSRF guards on
`/api/icon` were re-checked against the deployed instance: loopback 403, cloud metadata
403, `file://` 400, non-image 415.

Redeploy after any change with `vercel deploy --prod --yes` from this directory.

## 3. TODOs — done

Every field in `submission/apps.json.entry.json` is filled. Add `links.x` and
`team[0].x` if you want them; `null` is accepted.

## 4. PR to the submissions repo — done

**<https://github.com/cookiechain/superteam-hackathon-submissions/pull/5>** — open and
mergeable, +39 −0, logo and three screenshots committed to the repo as required.

Registered as **`crumbs-portfolio`**, not `crumbs`. PR #3 (WolfurX, opened ~18h earlier)
claimed that id for a different app, and both entries would otherwise have written to
`logos/crumbs.png` and `screenshots/crumbs/` as well — whoever merged second would have
failed the duplicate-id check and conflicted on both paths. The product is still Crumbs
everywhere else; only the registry id and title differ.

Their four validators pass on this entry: valid JSON, no duplicate id, no externally hosted
media, every referenced file present. Note the shared external-media check fails on the
seed `cookie-mcp` entry, whose banner is an x.com URL — not ours, flagged in the PR.

Remember their README: a PR here does **not** enter you into the bounty. It is the
catalogue, and winners get promoted from it into the permanent ecosystem registry. Do both.

## 5. X thread, then Telegram

Draft in `submission/x-thread.md`. The brief asks the thread to explain the app, show how
to use it, and point at the Cookie Chain Bridge — all three are in the draft.

Shot-by-shot video script in `submission/video-script.md`, including a 60-second cut for
the thread. It is built around the fact that you cannot demo a claim without a funded
wallet, and proves that path in a terminal instead.

Post it, then share the link in the Cookie Chain Telegram (`t.me/TheCookieNetChain`). The
brief lists that as the final step.

## 6. Earn submission

Text in `submission/earn-submission.md`. Submit before **23 Sep 2026, 00:59 EAT**.

## Still unverified

The claim path is simulated against mainnet and passes — `err: null`, with both fee
transfers in the logs. What has never run is a real signature and broadcast. To close
that you need a funded wallet holding a DAMM v2 position with pending fees.

If you cannot get one before the deadline, say so plainly in the submission rather than
implying it is proven. `scripts/simulate-claim.mjs` is the evidence for what *is* proven,
and a reviewer can run it themselves in one command.
