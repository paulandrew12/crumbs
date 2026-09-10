import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAMS } from "./chain";
import { getAssetsByOwner, indexByMint, type DasAsset } from "./das";

/** One SPL / Token-2022 account, exactly as the chain reports it. */
export interface TokenAccount {
  address: string;
  mint: string;
  /** Raw base units. Integer, never a float. */
  amount: bigint;
  decimals: number;
  programId: string;
}

/** All accounts for one mint, joined with what the indexer knows about it. */
export interface Holding {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  decimals: number;
  /** Summed across every token account for this mint. */
  amount: bigint;
  accounts: number;
  pricePerToken?: number;
  valueUsd?: number;
  priceChange24h?: number;
  isToken2022: boolean;
}

export interface Portfolio {
  owner: string;
  nativeLamports: number;
  holdings: Holding[];
  totalValueUsd: number;
  /** True when the indexer had nothing for a mint we hold. */
  unindexedMints: string[];
}

/**
 * Read every token account the wallet owns, across both token programs.
 *
 * The RPC is the source of truth for balances: it returns raw integer amounts
 * as strings, which we keep as bigint. The DAS API's float balances are only
 * ever used for display cross-checks, never arithmetic.
 */
export async function fetchTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  const programs = [PROGRAMS.splToken, PROGRAMS.token2022];

  const responses = await Promise.all(
    programs.map((programId) =>
      connection
        .getParsedTokenAccountsByOwner(owner, { programId }, "confirmed")
        .catch(() => ({ value: [] as never[] })),
    ),
  );

  const accounts: TokenAccount[] = [];

  responses.forEach((response, i) => {
    for (const { pubkey, account } of response.value) {
      const info = account.data.parsed?.info;
      if (!info?.mint || !info?.tokenAmount) continue;

      const amount = BigInt(info.tokenAmount.amount as string);
      // An empty account is rent the user could reclaim, but it is noise in a
      // portfolio view. Drop it.
      if (amount === 0n) continue;

      accounts.push({
        address: pubkey.toBase58(),
        mint: info.mint as string,
        amount,
        decimals: Number(info.tokenAmount.decimals ?? 0),
        programId: programs[i].toBase58(),
      });
    }
  });

  return accounts;
}

function displayName(asset: DasAsset | undefined, mint: string): string {
  const name = asset?.content?.metadata?.name?.trim();
  if (name) return name;
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function displaySymbol(asset: DasAsset | undefined): string {
  return (
    asset?.token_info?.symbol?.trim() ||
    asset?.content?.metadata?.symbol?.trim() ||
    "—"
  );
}

function imageOf(asset: DasAsset | undefined): string | undefined {
  const link = asset?.content?.links?.image;
  if (link) return link;
  return asset?.content?.files?.find((f) => f.mime?.startsWith("image/"))?.uri;
}

/** raw base units → a float, for pricing only. Never for display. */
function toUiAmount(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

/**
 * Join on-chain balances with indexer metadata.
 *
 * Balances are aggregated per mint in bigint — a wallet legitimately holds
 * many accounts for one mint (our test wallet has 21 for wCOOK alone), and
 * summing those as floats would quietly lose precision on large balances.
 */
export async function fetchPortfolio(
  connection: Connection,
  owner: PublicKey,
  signal?: AbortSignal,
): Promise<Portfolio> {
  const ownerKey = owner.toBase58();

  const [nativeLamports, accounts, assets] = await Promise.all([
    connection.getBalance(owner, "confirmed").catch(() => 0),
    fetchTokenAccounts(connection, owner),
    // The indexer is a nice-to-have: if it is down we still show balances.
    getAssetsByOwner(ownerKey, signal).catch(() => [] as DasAsset[]),
  ]);

  const meta = indexByMint(assets);

  const byMint = new Map<string, { amount: bigint; decimals: number; accounts: number; programId: string }>();
  for (const account of accounts) {
    const existing = byMint.get(account.mint);
    if (existing) {
      existing.amount += account.amount;
      existing.accounts += 1;
    } else {
      byMint.set(account.mint, {
        amount: account.amount,
        decimals: account.decimals,
        accounts: 1,
        programId: account.programId,
      });
    }
  }

  const unindexedMints: string[] = [];
  const holdings: Holding[] = [];

  for (const [mint, agg] of byMint) {
    const asset = meta.get(mint);
    if (!asset) unindexedMints.push(mint);

    // The indexer returns price_per_token: 0 for mints it does not price —
    // wCOOK among them. Rendering that as "$0.00" tells someone holding 13.7M
    // wCOOK that it is worthless, which is worse than admitting we don't know.
    const quoted = asset?.token_info?.price_info?.price_per_token;
    const price = quoted !== undefined && quoted > 0 ? quoted : undefined;
    const ui = toUiAmount(agg.amount, agg.decimals);
    const valueUsd = price !== undefined ? ui * price : undefined;

    holdings.push({
      mint,
      name: displayName(asset, mint),
      symbol: displaySymbol(asset),
      image: imageOf(asset),
      decimals: agg.decimals,
      amount: agg.amount,
      accounts: agg.accounts,
      pricePerToken: price,
      valueUsd,
      priceChange24h: asset?.price_change_24h,
      isToken2022: agg.programId === PROGRAMS.token2022.toBase58(),
    });
  }

  // Priced holdings first, by value; then unpriced, by raw size.
  holdings.sort((a, b) => {
    const av = a.valueUsd ?? -1;
    const bv = b.valueUsd ?? -1;
    if (av !== bv) return bv - av;
    return a.name.localeCompare(b.name);
  });

  const totalValueUsd = holdings.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0);

  return { owner: ownerKey, nativeLamports, holdings, totalValueUsd, unindexedMints };
}
