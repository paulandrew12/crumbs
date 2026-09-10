import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://rpc.cookiescan.io";
const API = "https://api.momoswap.fun/v1/launchpad";
const FALLBACK = new PublicKey("momoL7wu4TrXjnXMLCLzGsbx8Pm7XGgoYo7FVqDoqcw");
const DISC = Buffer.from([251, 248, 209, 245, 83, 234, 17, 27]);

const conn = new Connection(RPC, "confirmed");

const res = await fetch(`${API}/pools?status=all`);
console.log("GET /pools ->", res.status);
const body = await res.json();
const pools = body.pools ?? [];
console.log("pools returned:", pools.length, "| total:", body.total, "| hasMore:", body.hasMore);

const byStatus = {};
for (const p of pools) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
console.log("by status:", byStatus);

if (!pools.length) process.exit(0);
const sample = pools[0];
console.log("\nsample pool:", sample.pubkey, "|", sample.name, `(${sample.symbol})`,
            "| status:", sample.status, "| mode:", sample.expiryMode, "| creator:", sample.creator);

// 1. the program that owns each pool == ground truth for PDA derivation
const owners = await conn.getMultipleAccountsInfo(
  pools.slice(0, 100).map((p) => new PublicKey(p.pubkey)));
const progCount = {};
owners.forEach((info) => {
  const k = info?.owner?.toBase58() ?? "MISSING";
  progCount[k] = (progCount[k] ?? 0) + 1;
});
console.log("\nowning programs across first 100 pools:");
for (const [k, v] of Object.entries(progCount)) {
  console.log(`   ${k}  x${v}${k === FALLBACK.toBase58() ? "   <- configured fallback" : ""}`);
}

// 2. derive UserPosition PDAs for pool creators and see which exist
const userPositionPda = (pool, owner, programId) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("user"), new PublicKey(pool).toBuffer(), new PublicKey(owner).toBuffer()],
    programId)[0];

const probe = pools.slice(0, 60);
const cands = probe.map((p, i) => ({
  pool: p.pubkey,
  owner: p.creator,
  pda: userPositionPda(p.pubkey, p.creator, owners[i]?.owner ?? FALLBACK),
}));

const infos = await conn.getMultipleAccountsInfo(cands.map((c) => c.pda));
const hits = [];
infos.forEach((info, i) => { if (info?.data) hits.push({ ...cands[i], data: info.data, prog: info.owner.toBase58() }); });
console.log(`\nUserPosition PDAs that exist (creators of first ${probe.length} pools): ${hits.length}`);

const decode = (d) => {
  if (d.length < 100) return { err: `too short: ${d.length}` };
  if (!d.subarray(0, 8).equals(DISC)) return { err: `bad discriminator: ${[...d.subarray(0,8)]}` };
  return {
    pool: new PublicKey(d.subarray(8, 40)).toBase58(),
    owner: new PublicKey(d.subarray(40, 72)).toBase58(),
    shares: d.readBigUInt64LE(72).toString(),
    totalPaymentIn: d.readBigUInt64LE(80).toString(),
    totalPaymentOut: d.readBigUInt64LE(88).toString(),
    claimed: d[96] === 1,
    winnerClaimed: d[97] === 1,
    graduatedTokensClaimed: d[98] === 1,
    len: d.length,
  };
};

for (const h of hits.slice(0, 3)) {
  const dec = decode(h.data);
  console.log(`\n--- pool ${h.pool.slice(0,8)}… owner ${h.owner.slice(0,8)}…`);
  console.log("   decoded:", JSON.stringify(dec));
  console.log("   pool field matches queried pool:", dec.pool === h.pool);
  console.log("   owner field matches queried owner:", dec.owner === h.owner);
  const r = await fetch(`${API}/pools/${h.pool}/position/${h.owner}`);
  if (r.ok) {
    const api = await r.json();
    console.log("   API says:", JSON.stringify(api).slice(0, 300));
  } else console.log("   API position ->", r.status);
}
