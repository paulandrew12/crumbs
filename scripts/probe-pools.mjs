import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection("https://rpc.cookiescan.io", "confirmed");
const pools = ["78e15qHtzRVfqNZmwKZNvcJhP1YfPLpxKvqTaJLiJaVv","GHfzn5A5"].slice(0,1);
// re-fetch a real pool address from a position
const DAMM = new PublicKey("DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY");
const bs58 = (await import("bs58")).default;
const accs = await conn.getProgramAccounts(DAMM, {
  commitment:"confirmed",
  filters:[{ memcmp:{ offset:0, bytes: bs58.encode(Buffer.from([170,188,143,228,122,64,247,208])) } }],
  dataSlice:{offset:8,length:32},
});
const poolAddrs = [...new Set(accs.map(a=>new PublicKey(a.account.data).toBase58()))];
console.log("distinct pools referenced by positions:", poolAddrs.length);
const infos = await conn.getMultipleAccountsInfo(poolAddrs.slice(0,4).map(p=>new PublicKey(p)));
for (let i=0;i<infos.length;i++){
  const d=infos[i].data;
  console.log(`\npool ${poolAddrs[i].slice(0,10)}… len=${d.length} (expect 1112)`);
  const a=new PublicKey(d.subarray(168,200)).toBase58();
  const b=new PublicKey(d.subarray(200,232)).toBase58();
  console.log(`  token_a_mint=${a}`);
  console.log(`  token_b_mint=${b}`);
  console.log(`  token_a_amount=${d.readBigUInt64LE(680)} token_b_amount=${d.readBigUInt64LE(688)}`);
  console.log(`  pool_status=${d[481]} collect_fee_mode=${d[484]}`);
  // sanity: are these real mints?
  const m = await conn.getParsedAccountInfo(new PublicKey(a));
  const info = m.value?.data?.parsed?.info;
  console.log(`  token_a is a mint: ${!!info} decimals=${info?.decimals} supply=${info?.supply?.slice?.(0,14)}`);
}
