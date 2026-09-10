import { Connection, PublicKey } from "@solana/web3.js";

/**
 * MomoSwap launchpad positions, read straight from the chain.
 *
 * These are the holdings the whole app exists for: before a pool graduates, a
 * buyer's stake is a program-tracked `UserPosition` account, NOT an SPL token.
 * It does not appear in `getTokenAccountsByOwner`, so no wallet on this chain
 * can show it.
 *
 * Account layout and PDA seeds adapted from cookiechain/cookie-mcp (MIT),
 * then verified against mainnet: our decode of pool FvrW6Wkn… matches the
 * launchpad API's own `/position` response field for field.
 */

const API_BASE = "https://api.momoswap.fun/v1/launchpad";

/**
 * The launchpad has been redeployed before, and a redeploy strands old pools
 * on the old program id forever. PDA seeds are program-scoped, so deriving
 * under a hardcoded id would fail silently — the PDAs simply would not exist
 * and a wallet would look empty. We read each pool account's `owner`, which
 * *is* the program that owns it, and only fall back to this constant when
 * there is nothing to read.
 */
export const LAUNCHPAD_FALLBACK_PROGRAM = new PublicKey(
  "momoL7wu4TrXjnXMLCLzGsbx8Pm7XGgoYo7FVqDoqcw",
);

/** Anchor discriminator for `UserPosition`. */
const USER_POSITION_DISCRIMINATOR = Buffer.from([
  251, 248, 209, 245, 83, 234, 17, 27,
]);

// disc(8) · pool(32) · owner(32) · shares(u64) · total_payment_in(u64) ·
// total_payment_out(u64) · claimed(u8) · winner_claimed(u8) ·
// graduated_tokens_claimed(u8) · bump(u8)
const OFF_POOL = 8;
const OFF_OWNER = 40;
const OFF_SHARES = 72;
const OFF_PAYMENT_IN = 80;
const OFF_PAYMENT_OUT = 88;
const OFF_CLAIMED = 96;
const OFF_WINNER_CLAIMED = 97;
const OFF_GRADUATED_CLAIMED = 98;
const USER_POSITION_MIN_LEN = 100;

const MAX_ACCOUNTS_PER_CALL = 100;

export type PoolStatus =
  | "upcoming"
  | "live"
  | "ended"
  | "graduated"
  | "expired";

export interface LaunchpadPool {
  pubkey: string;
  creator: string;
  name: string;
  symbol: string;
  tokenMint: string;
  status: PoolStatus;
  expiryMode: "dead" | "fair" | "jackpot" | "survivor";
  paymentRaisedGross: string;
  participantCount: string;
}

export interface UserPosition {
  pool: string;
  owner: string;
  shares: bigint;
  totalPaymentIn: bigint;
  totalPaymentOut: bigint;
  claimed: boolean;
  winnerClaimed: boolean;
  graduatedTokensClaimed: boolean;
}

/** A position joined with the pool it belongs to. */
export interface LaunchpadHolding {
  pool: LaunchpadPool;
  position: UserPosition;
  /** What, if anything, this wallet can still claim here. */
  claimable: ClaimKind | null;
}

export type ClaimKind =
  | "graduated_tokens"
  | "fair_refund"
  | "winner_payout";

export function userPositionPda(
  pool: PublicKey | string,
  owner: PublicKey | string,
  programId: PublicKey = LAUNCHPAD_FALLBACK_PROGRAM,
): PublicKey {
  const p = typeof pool === "string" ? new PublicKey(pool) : pool;
  const o = typeof owner === "string" ? new PublicKey(owner) : owner;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user"), p.toBuffer(), o.toBuffer()],
    programId,
  )[0];
}

export function creatorFeeVaultPda(
  pool: PublicKey | string,
  programId: PublicKey = LAUNCHPAD_FALLBACK_PROGRAM,
): PublicKey {
  const p = typeof pool === "string" ? new PublicKey(pool) : pool;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_fee_vault"), p.toBuffer()],
    programId,
  )[0];
}

/**
 * Decode a raw account, or null when it is not a `UserPosition`.
 * Never throws — one odd account must not sink a whole portfolio read.
 */
export function decodeUserPosition(data: Buffer): UserPosition | null {
  if (data.length < USER_POSITION_MIN_LEN) return null;
  if (!data.subarray(0, 8).equals(USER_POSITION_DISCRIMINATOR)) return null;
  return {
    pool: new PublicKey(data.subarray(OFF_POOL, OFF_POOL + 32)).toBase58(),
    owner: new PublicKey(data.subarray(OFF_OWNER, OFF_OWNER + 32)).toBase58(),
    shares: data.readBigUInt64LE(OFF_SHARES),
    totalPaymentIn: data.readBigUInt64LE(OFF_PAYMENT_IN),
    totalPaymentOut: data.readBigUInt64LE(OFF_PAYMENT_OUT),
    claimed: data[OFF_CLAIMED] === 1,
    winnerClaimed: data[OFF_WINNER_CLAIMED] === 1,
    graduatedTokensClaimed: data[OFF_GRADUATED_CLAIMED] === 1,
  };
}

function chunk<T>(items: T[], size = MAX_ACCOUNTS_PER_CALL): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Every pool the launchpad knows about. */
export async function fetchPools(signal?: AbortSignal): Promise<LaunchpadPool[]> {
  const res = await fetch(`${API_BASE}/pools?status=all`, { signal });
  if (!res.ok) throw new Error(`Launchpad API returned HTTP ${res.status}`);
  const body = (await res.json()) as { pools?: LaunchpadPool[] };
  return body.pools ?? [];
}

/**
 * What this wallet can still claim on a pool, given its position.
 *
 * Deliberately conservative: it only reports a claim when the pool has
 * actually settled into a state that pays out, so the UI never offers a
 * button that the program would reject with "nothing to claim" (6025).
 */
export function claimableKind(
  pool: LaunchpadPool,
  position: UserPosition,
): ClaimKind | null {
  if (position.shares === 0n && position.claimed) return null;

  if (pool.status === "graduated" && !position.graduatedTokensClaimed) {
    return "graduated_tokens";
  }
  if (pool.status === "expired" && !position.claimed) {
    return pool.expiryMode === "fair" ? "fair_refund" : "winner_payout";
  }
  return null;
}

/**
 * Every launchpad position this wallet holds.
 *
 * Two batched round trips regardless of pool count: one to learn which
 * program owns each pool, one to read the derived PDAs. Pools the wallet
 * never touched have no PDA and are simply absent.
 */
export async function fetchLaunchpadHoldings(
  connection: Connection,
  owner: string,
  signal?: AbortSignal,
): Promise<LaunchpadHolding[]> {
  const pools = await fetchPools(signal);
  if (pools.length === 0) return [];

  // A pool account's owner is immutable, so this is the ground truth for
  // deriving PDAs and stays correct across a program-id change.
  const programs = new Map<string, PublicKey>();
  for (const batch of chunk(pools)) {
    const infos = await connection.getMultipleAccountsInfo(
      batch.map((p) => new PublicKey(p.pubkey)),
    );
    infos.forEach((info, i) => {
      if (info?.owner) programs.set(batch[i].pubkey, info.owner);
    });
  }

  const derived = pools.map((pool) => ({
    pool,
    pda: userPositionPda(
      pool.pubkey,
      owner,
      programs.get(pool.pubkey) ?? LAUNCHPAD_FALLBACK_PROGRAM,
    ),
  }));

  const holdings: LaunchpadHolding[] = [];
  for (const batch of chunk(derived)) {
    const infos = await connection.getMultipleAccountsInfo(
      batch.map((d) => d.pda),
    );
    infos.forEach((info, i) => {
      if (!info?.data) return;
      const position = decodeUserPosition(info.data);
      if (!position) return;
      const pool = batch[i].pool;
      holdings.push({ pool, position, claimable: claimableKind(pool, position) });
    });
  }

  return holdings;
}
