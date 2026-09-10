// Guards against drift between the shipped builder (src/lib/claim.ts) and the
// standalone simulator (scripts/simulate-claim.mjs).
//
// The simulator cannot import the TypeScript module, so it restates the
// account list. Anchor validates accounts positionally, which makes order and
// flags the whole correctness story — so those are what this compares.
import { readFileSync } from "node:fs";

const ROLES = [
  "pool_authority", "pool", "position", "token_a_account", "token_b_account",
  "token_a_vault", "token_b_vault", "token_a_mint", "token_b_mint",
  "position_nft_account", "owner", "token_a_program", "token_b_program",
  "event_authority", "program",
];

function flagsFrom(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const keysAt = source.indexOf("keys: [", start);
  const end = source.indexOf("],", keysAt);
  const block = source.slice(keysAt, end);
  return [...block.matchAll(/isSigner:\s*(true|false),\s*isWritable:\s*(true|false)/g)]
    .map((m) => `${m[1] === "true" ? "S" : "-"}${m[2] === "true" ? "W" : "-"}`);
}

const shipped = flagsFrom(readFileSync("src/lib/claim.ts", "utf8"), "programId: DAMM_PROGRAM");
const sim = flagsFrom(readFileSync("scripts/simulate-claim.mjs", "utf8"), "programId: DAMM,");

let bad = 0;
console.log(`${"#".padEnd(3)}${"role".padEnd(22)}${"claim.ts".padEnd(10)}simulate`);
for (let i = 0; i < Math.max(shipped.length, sim.length); i++) {
  const ok = shipped[i] === sim[i];
  if (!ok) bad++;
  console.log(
    `${String(i).padEnd(3)}${(ROLES[i] ?? "?").padEnd(22)}${(shipped[i] ?? "-").padEnd(10)}${sim[i] ?? "-"}  ${ok ? "" : "<-- MISMATCH"}`,
  );
}

if (shipped.length !== ROLES.length) {
  console.log(`\naccount count is ${shipped.length}, IDL says ${ROLES.length}`);
  bad++;
}
console.log(bad === 0
  ? "\nOK: shipped builder matches the simulated instruction."
  : `\nFAIL: ${bad} difference(s).`);
process.exit(bad === 0 ? 0 : 1);
