import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
const conn = new Connection("https://rpc.cookiescan.io", "confirmed");
const PROG = new PublicKey("H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA");
const D_DOMAIN  = Buffer.from([35,146,98,112,13,230,231,153]);
const D_PRIMARY = Buffer.from([231,255,61,63,142,184,254,42]);

const census = async (label, disc) => {
  const r = await conn.getProgramAccounts(PROG, { commitment:"confirmed",
    dataSlice:{offset:0,length:0}, filters:[{memcmp:{offset:0,bytes:bs58.encode(disc)}}] });
  console.log(`  ${label}: ${r.length}`); return r;
};
console.log("CookOven domains program census:");
const domains = await census("Domain ", D_DOMAIN);
await census("Primary", D_PRIMARY);

const decodeDomain = (d) => {
  if (!d.subarray(0,8).equals(D_DOMAIN)) return null;
  const len = d.readUInt32LE(8); const end = 12+len;
  if (!len || end+32 > d.length) return null;
  const name = d.subarray(12,end).toString("utf8");
  const owner = new PublicKey(d.subarray(end,end+32)).toBase58();
  if (d.length < 149 || end+105 > d.length) return { name, owner, legacy:true };
  return { name, owner, createdAt:Number(d.readBigInt64LE(end+96)), legacy:false };
};

const sample = domains.slice(0,5).map(a=>a.pubkey);
const infos = await conn.getMultipleAccountsInfo(sample);
console.log("\nsample domains:");
const found = [];
infos.forEach((info,i)=>{
  const dec = decodeDomain(info.data);
  if (!dec) { console.log(`  ${sample[i].toBase58().slice(0,8)}… undecodable len=${info.data.length}`); return; }
  found.push(dec);
  console.log(`  ${dec.name}.cook  owner=${dec.owner.slice(0,12)}…  len=${info.data.length} legacy=${dec.legacy}`);
  // forward derivation check
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("domain"), Buffer.from(dec.name,"utf8")], PROG);
  console.log(`     domainPda("${dec.name}") matches account: ${pda.toBase58()===sample[i].toBase58()}`);
});

// reverse: primary PDA for each owner
console.log("\nreverse resolution (primary domain per owner):");
for (const f of found.slice(0,4)) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("primary"), new PublicKey(f.owner).toBuffer()], PROG);
  const info = await conn.getAccountInfo(pda);
  if (!info) { console.log(`  ${f.owner.slice(0,12)}… -> no primary set`); continue; }
  const d = info.data;
  const ok = d.subarray(0,8).equals(D_PRIMARY);
  const len = ok ? d.readUInt32LE(40) : 0;
  const name = len ? d.subarray(44,44+len).toString("utf8") : null;
  console.log(`  ${f.owner.slice(0,12)}… -> ${name ? name+".cook" : "(cleared)"}  len=${d.length}`);
}
