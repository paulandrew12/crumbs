import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const conn = new Connection("https://rpc.cookiescan.io", "confirmed");
const DAMM = new PublicKey("DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY");
const POSITION_DISC = Buffer.from([170,188,143,228,122,64,247,208]);
const u128 = (d, o) => { let v=0n; for(let i=15;i>=0;i--) v=(v<<8n)|BigInt(d[o+i]); return v; };

const accs = await conn.getProgramAccounts(DAMM, {
  commitment: "confirmed",
  filters: [{ memcmp: { offset: 0, bytes: bs58.encode(POSITION_DISC) } }],
});
console.log("positions:", accs.length);

const decode = (d) => ({
  pool: new PublicKey(d.subarray(8,40)).toBase58(),
  nftMint: new PublicKey(d.subarray(40,72)).toBase58(),
  feeAPending: d.readBigUInt64LE(136),
  feeBPending: d.readBigUInt64LE(144),
  unlocked: u128(d,152),
  vested: u128(d,168),
  permanentLocked: u128(d,184),
});

const all = accs.map(a => ({ addr: a.pubkey.toBase58(), ...decode(a.account.data) }));
const withLiq = all.filter(p => p.unlocked > 0n || p.permanentLocked > 0n);
const withFees = all.filter(p => p.feeAPending > 0n || p.feeBPending > 0n);
console.log("with liquidity:", withLiq.length, "| with pending fees:", withFees.length);
console.log("distinct pools:", new Set(all.map(p=>p.pool)).size);

console.log("\ntop 5 by unlocked liquidity:");
for (const p of [...all].sort((a,b)=> b.unlocked>a.unlocked?1:-1).slice(0,5)) {
  console.log(`  ${p.addr.slice(0,8)}… pool=${p.pool.slice(0,8)}… unlocked=${p.unlocked} permLocked=${p.permanentLocked} feeA=${p.feeAPending} feeB=${p.feeBPending}`);
}

// resolve owners for the fee-bearing positions -> a test wallet
console.log("\nresolving owners of fee-bearing positions:");
for (const p of withFees.slice(0,5)) {
  const h = await conn.getTokenLargestAccounts(new PublicKey(p.nftMint)).catch(()=>null);
  const top = h?.value?.find(v=>v.uiAmount===1);
  if (!top) { console.log(`  ${p.addr.slice(0,8)}… no holder`); continue; }
  const acc = await conn.getParsedAccountInfo(top.address);
  const owner = acc.value?.data?.parsed?.info?.owner;
  console.log(`  owner=${owner} feeA=${p.feeAPending} feeB=${p.feeBPending} unlocked=${p.unlocked}`);
}
