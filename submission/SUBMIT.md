# Shipping checklist

Four TODOs below need real values before anything is submitted. Everything else is done.

## 1. Push the repo — done

<https://github.com/paulandrew12/crumbs> — public, `main`, commits authored as
`paulandrew12` so they link to the account.

## 2. Deploy

```bash
npx vercel --prod
```

No environment variables are required — the defaults in `src/lib/chain.ts` point at the
public Cookie Chain endpoints. The build is clean and the only server-side route is
`/api/icon`.

Confirm the deployed URL loads and that inspecting `moon.cook` returns a portfolio.

## 3. Fill in the four TODOs

In `submission/apps.json.entry.json`:

| Field | Value |
| --- | --- |
| `links.website` | the Vercel URL |

`team[0].github` is already filled in as https://github.com/paulandrew12. Add `links.x`
and `team[0].x` if you want them; `null` is accepted.

## 4. PR to the submissions repo

Fork `cookiechain/superteam-hackathon-submissions`, then:

```bash
cp brand/crumbs.png <fork>/logos/crumbs.png
mkdir -p <fork>/screenshots/crumbs
cp brand/screenshots/*.png <fork>/screenshots/crumbs/
```

Append the entry to `apps.json` and update `media.screenshots` to the raw URLs of the
files you just committed. **External media links are rejected** — every URL must be
`raw.githubusercontent.com/cookiechain/superteam-hackathon-submissions/main/...`.

Their validators, run before opening the PR:

```bash
jq empty apps.json
jq -r '[.[].id] | group_by(.) | map(select(length > 1) | .[0]) | join(", ")' apps.json
PREFIX=https://raw.githubusercontent.com/cookiechain/superteam-hackathon-submissions/main/
jq -r --arg p "$PREFIX" '.[].media | [.logo, .banner] + .screenshots | .[] | select(. != null) | select(startswith($p) | not)' apps.json
jq -r --arg p "$PREFIX" '.[].media | [.logo, .banner] + .screenshots | .[] | select(. != null) | sub($p; "")' apps.json | xargs ls
```

Title the PR **Crumbs**.

Note their README: a PR here does **not** enter you into the bounty. It is the catalogue,
and winners get promoted from it into the permanent ecosystem registry. Do both.

## 5. X thread, then Telegram

Draft in `submission/x-thread.md`. The brief asks the thread to explain the app, show how
to use it, and point at the Cookie Chain Bridge — all three are in the draft.

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
