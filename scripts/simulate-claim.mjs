// Simulates claim_position_fee against a REAL position with pending fees.
// No private key and no funds: simulation runs with sigVerify disabled, so it
// proves the account list and discriminator are right before anyone spends.
//
// The account list here mirrors src/lib/claim.ts exactly; scripts/diff-claim.mjs
// checks the two have not drifted.
import { Connection, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const RPC = "https://rpc.cookiescan.io";
const conn = new Connection(RPC, "confirmed");
const OWNER = new PublicKey(process.argv[2] ?? "9QqQpr3N8skGNRvJsN3VzgLbgXFu4ipEtYNUz5qnvUvN");

const DAMM = new PublicKey("DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY");
const ATA_PROG = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN22 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const POOL_AUTHORITY = new PublicKey("8WYfVSBcP3T1amRNmTnLfzYd44VDjGpw1jZxrEL8638o");
const DISC = Buffer.from([180,38,154,17,133,33,162,211]);
const [EVENT_AUTHORITY] = PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], DAMM);

const ata = (mint, owner, prog) => PublicKey.findProgramAddressSync(
  [owner.toBuffer(), prog.toBuffer(), new PublicKey(mint).toBuffer()], ATA_PROG)[0];
const positionPda = (nftMint) => PublicKey.findProgramAddressSync(
  [Buffer.from("position"), new PublicKey(nftMint).toBuffer()], DAMM)[0];
const u128 = (d,o)=>{let v=0n;for(let i=15;i>=0;i--)v=(v<<8n)|BigInt(d[o+i]);return v;};

// 1. wallet's NFT-like token accounts
const accounts = [];
for (const prog of [TOKEN, TOKEN22]) {
  const r = await conn.getParsedTokenAccountsByOwner(OWNER, { programId: prog }, "confirmed");
  for (const { pubkey, account } of r.value) {
    const i = account.data.parsed.info;
    if (i.tokenAmount.decimals === 0 && i.tokenAmount.amount === "1")
      accounts.push({ address: pubkey, mint: i.mint });
  }
}
console.log("NFT-like token accounts:", accounts.length);

// 2. which are DAMM positions with fees
const pdas = accounts.map(a => ({ ...a, pda: positionPda(a.mint) }));
const infos = await conn.getMultipleAccountsInfo(pdas.map(p => p.pda));
const positions = [];
infos.forEach((info, i) => {
  if (!info?.data || info.data.length < 408) return;
  if (!info.data.subarray(0,8).equals(Buffer.from([170,188,143,228,122,64,247,208]))) return;
  positions.push({
    ...pdas[i],
    positionAddress: pdas[i].pda,
    pool: new PublicKey(info.data.subarray(8,40)),
    feeA: info.data.readBigUInt64LE(136),
    feeB: info.data.readBigUInt64LE(144),
  });
});
const owed = positions.filter(p => p.feeA > 0n || p.feeB > 0n);
console.log("positions:", positions.length, "| with pending fees:", owed.length);
if (!owed.length) { console.log("nothing to claim for this wallet"); process.exit(0); }

const target = owed[0];
const poolInfo = await conn.getAccountInfo(target.pool);
const d = poolInfo.data;
const pool = {
  tokenAMint: new PublicKey(d.subarray(168,200)),
  tokenBMint: new PublicKey(d.subarray(200,232)),
  tokenAVault: new PublicKey(d.subarray(232,264)),
  tokenBVault: new PublicKey(d.subarray(264,296)),
};
const mintInfos = await conn.getMultipleAccountsInfo([pool.tokenAMint, pool.tokenBMint]);
const progA = mintInfos[0].owner, progB = mintInfos[1].owner;

console.log(`\nclaiming position ${target.positionAddress.toBase58().slice(0,10)}…`);
console.log(`  pool      ${target.pool.toBase58()}`);
console.log(`  feeA=${target.feeA} feeB=${target.feeB}`);
console.log(`  tokenA prog ${progA.toBase58().slice(0,8)}…  tokenB prog ${progB.toBase58().slice(0,8)}…`);

const mkAta = (owner, mint, prog) => new TransactionInstruction({
  programId: ATA_PROG,
  keys: [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: ata(mint, owner, prog), isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(mint), isSigner: false, isWritable: false },
    { pubkey: SYSTEM, isSigner: false, isWritable: false },
    { pubkey: prog, isSigner: false, isWritable: false },
  ],
  data: Buffer.from([1]),
});

const claimIx = new TransactionInstruction({
  programId: DAMM,
  keys: [
    { pubkey: POOL_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: target.pool, isSigner: false, isWritable: false },
    { pubkey: target.positionAddress, isSigner: false, isWritable: true },
    { pubkey: ata(pool.tokenAMint, OWNER, progA), isSigner: false, isWritable: true },
    { pubkey: ata(pool.tokenBMint, OWNER, progB), isSigner: false, isWritable: true },
    { pubkey: pool.tokenAVault, isSigner: false, isWritable: true },
    { pubkey: pool.tokenBVault, isSigner: false, isWritable: true },
    { pubkey: pool.tokenAMint, isSigner: false, isWritable: false },
    { pubkey: pool.tokenBMint, isSigner: false, isWritable: false },
    { pubkey: target.address, isSigner: false, isWritable: false },
    { pubkey: OWNER, isSigner: true, isWritable: false },
    { pubkey: progA, isSigner: false, isWritable: false },
    { pubkey: progB, isSigner: false, isWritable: false },
    { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: DAMM, isSigner: false, isWritable: false },
  ],
  data: DISC,
});

const { blockhash } = await conn.getLatestBlockhash("confirmed");
const tx = new VersionedTransaction(new TransactionMessage({
  payerKey: OWNER, recentBlockhash: blockhash,
  instructions: [
    mkAta(OWNER, pool.tokenAMint, progA),
    mkAta(OWNER, pool.tokenBMint, progB),
    claimIx,
  ],
}).compileToV0Message());

const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" });
console.log("\n=== SIMULATION");
console.log("err:", JSON.stringify(sim.value.err));
console.log("units consumed:", sim.value.unitsConsumed);
console.log("logs:");
for (const l of sim.value.logs ?? []) console.log("   ", l);
