import { Connection, PublicKey } from "@solana/web3.js";
import { getAsset } from "./das";
import type { TokenAccount } from "./portfolio";

/**
 * Cookiebox DAMM v2 (Meteora cp-amm) liquidity positions.
 *
 * These are the largest pool of genuinely invisible value on Cookie Chain:
 * 176 positions across 15 pools, 27 of them carrying unclaimed fees — and
 * most of those have zero remaining liquidity, meaning someone withdrew and
 * left the fees behind.
 *
 * A position has NO owner field. Ownership is bearer: whoever holds the
 * position NFT owns the position. So we do not scan the program — we look at
 * the NFTs the wallet already holds and derive `["position", nft_mint]` for
 * each. That turns discovery into one batched read over accounts we fetched
 * anyway.
 *
 * Layouts computed from cookie-mcp's cp_amm IDL (MIT) and checked against the
 * chain: Position sizes to 408 bytes and Pool to 1112, which is exactly what
 * mainnet returns.
 */

export const DAMM_PROGRAM = new PublicKey(
  "DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY",
);

const POSITION_DISCRIMINATOR = Buffer.from([
  170, 188, 143, 228, 122, 64, 247, 208,
]);

// Position: disc(8) pool(32) nft_mint(32) feeACheckpoint(32) feeBCheckpoint(32)
//           fee_a_pending(u64) fee_b_pending(u64) unlocked(u128) vested(u128)
//           permanent_locked(u128) …
const P_POOL = 8;
const P_NFT_MINT = 40;
const P_FEE_A = 136;
const P_FEE_B = 144;
const P_UNLOCKED = 152;
const P_VESTED = 168;
const P_PERMANENT = 184;
const POSITION_LEN = 408;

// Pool: pool_fees(160) then token_a_mint(32) token_b_mint(32) …
const POOL_TOKEN_A_MINT = 168;
const POOL_TOKEN_B_MINT = 200;
const POOL_TOKEN_A_AMOUNT = 680;
const POOL_TOKEN_B_AMOUNT = 688;
const POOL_STATUS = 481;
const POOL_LEN = 1112;

const MAX_ACCOUNTS_PER_CALL = 100;

function readU128LE(data: Buffer, offset: number): bigint {
  let value = 0n;
  for (let i = 15; i >= 0; i--) value = (value << 8n) | BigInt(data[offset + i]);
  return value;
}

export interface LpPosition {
  address: string;
  pool: string;
  nftMint: string;
  feeAPending: bigint;
  feeBPending: bigint;
  unlockedLiquidity: bigint;
  vestedLiquidity: bigint;
  permanentLockedLiquidity: bigint;
}

export interface DammPool {
  address: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenAAmount: bigint;
  tokenBAmount: bigint;
  status: number;
}

export interface PoolToken {
  mint: string;
  symbol: string;
  decimals: number;
}

export interface LpHolding {
  position: LpPosition;
  pool: DammPool;
  tokenA: PoolToken;
  tokenB: PoolToken;
  hasLiquidity: boolean;
  /** Fees earned and never collected — the thing worth surfacing. */
  hasUnclaimedFees: boolean;
}

export function positionPda(nftMint: PublicKey | string): PublicKey {
  const mint = typeof nftMint === "string" ? new PublicKey(nftMint) : nftMint;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), mint.toBuffer()],
    DAMM_PROGRAM,
  )[0];
}

export function decodePosition(
  address: string,
  data: Buffer,
): LpPosition | null {
  if (data.length < POSITION_LEN) return null;
  if (!data.subarray(0, 8).equals(POSITION_DISCRIMINATOR)) return null;
  return {
    address,
    pool: new PublicKey(data.subarray(P_POOL, P_POOL + 32)).toBase58(),
    nftMint: new PublicKey(
      data.subarray(P_NFT_MINT, P_NFT_MINT + 32),
    ).toBase58(),
    feeAPending: data.readBigUInt64LE(P_FEE_A),
    feeBPending: data.readBigUInt64LE(P_FEE_B),
    unlockedLiquidity: readU128LE(data, P_UNLOCKED),
    vestedLiquidity: readU128LE(data, P_VESTED),
    permanentLockedLiquidity: readU128LE(data, P_PERMANENT),
  };
}

export function decodePool(address: string, data: Buffer): DammPool | null {
  if (data.length < POOL_LEN) return null;
  return {
    address,
    tokenAMint: new PublicKey(
      data.subarray(POOL_TOKEN_A_MINT, POOL_TOKEN_A_MINT + 32),
    ).toBase58(),
    tokenBMint: new PublicKey(
      data.subarray(POOL_TOKEN_B_MINT, POOL_TOKEN_B_MINT + 32),
    ).toBase58(),
    tokenAAmount: data.readBigUInt64LE(POOL_TOKEN_A_AMOUNT),
    tokenBAmount: data.readBigUInt64LE(POOL_TOKEN_B_AMOUNT),
    status: data[POOL_STATUS],
  };
}

function chunk<T>(items: T[], size = MAX_ACCOUNTS_PER_CALL): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * A position NFT is a supply-1, zero-decimal token. Filtering the wallet's
 * existing token accounts down to those costs nothing and keeps the number of
 * PDAs we derive small.
 */
function nftCandidates(accounts: TokenAccount[]): TokenAccount[] {
  return accounts.filter((a) => a.decimals === 0 && a.amount === 1n);
}

/** Mint decimals, read on-chain because that is the authority. */
async function fetchMintDecimals(
  connection: Connection,
  mints: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const batch of chunk(mints)) {
    const infos = await connection.getMultipleParsedAccounts(
      batch.map((m) => new PublicKey(m)),
      { commitment: "confirmed" },
    );
    infos.value.forEach((info, i) => {
      const parsed = info?.data;
      if (parsed && "parsed" in parsed) {
        const decimals = parsed.parsed?.info?.decimals;
        if (typeof decimals === "number") out.set(batch[i], decimals);
      }
    });
  }
  return out;
}

/**
 * Every DAMM v2 position this wallet holds, joined with its pool and the
 * symbols of the pair.
 *
 * Takes the token accounts the portfolio already read, so discovery adds no
 * extra `getTokenAccountsByOwner` call.
 */
export async function fetchLpHoldings(
  connection: Connection,
  tokenAccounts: TokenAccount[],
  signal?: AbortSignal,
): Promise<LpHolding[]> {
  const candidates = nftCandidates(tokenAccounts);
  if (candidates.length === 0) return [];

  // 1. Derive and read the position PDAs.
  const derived = candidates.map((a) => ({
    mint: a.mint,
    pda: positionPda(a.mint),
  }));

  const positions: LpPosition[] = [];
  for (const batch of chunk(derived)) {
    const infos = await connection.getMultipleAccountsInfo(
      batch.map((d) => d.pda),
    );
    infos.forEach((info, i) => {
      if (!info?.data) return;
      const decoded = decodePosition(batch[i].pda.toBase58(), info.data);
      if (decoded) positions.push(decoded);
    });
  }
  if (positions.length === 0) return [];

  // 2. Read the pools those positions point at.
  const poolAddresses = [...new Set(positions.map((p) => p.pool))];
  const pools = new Map<string, DammPool>();
  for (const batch of chunk(poolAddresses)) {
    const infos = await connection.getMultipleAccountsInfo(
      batch.map((p) => new PublicKey(p)),
    );
    infos.forEach((info, i) => {
      if (!info?.data) return;
      const decoded = decodePool(batch[i], info.data);
      if (decoded) pools.set(batch[i], decoded);
    });
  }

  // 3. Resolve the pair. Decimals on-chain; symbols from the indexer, which
  //    has no batch method, so this is bounded by distinct mints in play.
  const mints = [
    ...new Set(
      [...pools.values()].flatMap((p) => [p.tokenAMint, p.tokenBMint]),
    ),
  ];
  const [decimals, assets] = await Promise.all([
    fetchMintDecimals(connection, mints),
    Promise.all(mints.map((m) => getAsset(m, signal))),
  ]);
  const symbols = new Map<string, string>();
  mints.forEach((mint, i) => {
    const asset = assets[i];
    const symbol =
      asset?.token_info?.symbol?.trim() ||
      asset?.content?.metadata?.symbol?.trim();
    if (symbol) symbols.set(mint, symbol);
  });

  const token = (mint: string): PoolToken => ({
    mint,
    symbol: symbols.get(mint) ?? `${mint.slice(0, 4)}…`,
    decimals: decimals.get(mint) ?? 0,
  });

  const holdings: LpHolding[] = [];
  for (const position of positions) {
    const pool = pools.get(position.pool);
    if (!pool) continue;
    holdings.push({
      position,
      pool,
      tokenA: token(pool.tokenAMint),
      tokenB: token(pool.tokenBMint),
      hasLiquidity:
        position.unlockedLiquidity > 0n ||
        position.vestedLiquidity > 0n ||
        position.permanentLockedLiquidity > 0n,
      hasUnclaimedFees:
        position.feeAPending > 0n || position.feeBPending > 0n,
    });
  }

  // Unclaimed fees first — that is what someone opens this page to find.
  holdings.sort((a, b) => {
    if (a.hasUnclaimedFees !== b.hasUnclaimedFees) return a.hasUnclaimedFees ? -1 : 1;
    return Number(b.position.unlockedLiquidity - a.position.unlockedLiquidity);
  });

  return holdings;
}
