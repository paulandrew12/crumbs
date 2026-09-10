/**
 * Client for the Cookiescan DAS API — a Metaplex Digital Asset Standard
 * JSON-RPC endpoint, Helius-compatible.
 *
 * Measured behaviour (10 Sep 2026), because it drives the design:
 *
 *  - `getAssetsByOwner` returns ONE ITEM PER TOKEN ACCOUNT, not per mint.
 *    A wallet with 21 wCOOK accounts gets 21 items sharing the same `id`.
 *  - `token_info.balance` is a decimal-adjusted float, and it matches the
 *    RPC's raw amounts exactly — but it is still a float, so we never do
 *    arithmetic on it. Balances come from the RPC as integers.
 *  - `token_info.associated_token_address` is empty, so a DAS item cannot be
 *    mapped back to a specific token account.
 *  - `displayOptions.showNativeBalance` is accepted but returns null. Native
 *    COOK comes from `connection.getBalance`.
 *  - `searchAssets` with `tokenType: "nonFungible"` returns 0 across the whole
 *    chain, so this indexer covers fungibles only. NFTs need another source.
 *
 * So: DAS is our metadata and price oracle, keyed by mint. It is not our
 * balance source.
 */

const DAS_URL =
  process.env.NEXT_PUBLIC_COOKIE_DAS_URL ?? "https://api.cookiescan.io/";

export interface DasPriceInfo {
  price_per_token: number;
  total_price?: number;
  currency: string;
}

export interface DasTokenInfo {
  symbol?: string;
  balance?: number;
  supply?: number;
  decimals?: number;
  token_program?: string;
  price_info?: DasPriceInfo;
}

export interface DasAsset {
  interface: string;
  id: string;
  burnt: boolean;
  content?: {
    json_uri?: string;
    files?: { uri?: string; mime?: string }[];
    links?: { image?: string };
    metadata?: { name?: string; symbol?: string; description?: string };
  };
  token_info?: DasTokenInfo;
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
}

interface DasResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

async function dasRequest<T>(
  method: string,
  params: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(DAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`DAS ${method} returned HTTP ${res.status}`);
  }

  const body = (await res.json()) as DasResponse<T>;
  if (body.error) {
    throw new Error(`DAS ${method}: ${body.error.message}`);
  }
  if (body.result === undefined) {
    throw new Error(`DAS ${method} returned no result`);
  }
  return body.result;
}

interface AssetPage {
  total: number;
  limit: number;
  page: number;
  items: DasAsset[];
}

/**
 * Every asset the indexer knows about for this owner, following pagination.
 *
 * Capped at `maxPages` so a whale wallet cannot spin forever against a shared
 * community endpoint.
 */
export async function getAssetsByOwner(
  owner: string,
  signal?: AbortSignal,
  maxPages = 5,
): Promise<DasAsset[]> {
  const limit = 1000;
  const all: DasAsset[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await dasRequest<AssetPage>(
      "getAssetsByOwner",
      {
        ownerAddress: owner,
        page,
        limit,
        displayOptions: { showFungible: true },
      },
      signal,
    );

    all.push(...result.items);
    if (all.length >= result.total || result.items.length < limit) break;
  }

  return all;
}

/**
 * Collapse the per-token-account items into one metadata record per mint.
 *
 * Metadata and price are properties of the mint, so the first item for a mint
 * is as good as any; we only discard the duplicated balances, which we do not
 * use anyway.
 */
export function indexByMint(assets: DasAsset[]): Map<string, DasAsset> {
  const byMint = new Map<string, DasAsset>();
  for (const asset of assets) {
    if (!byMint.has(asset.id)) byMint.set(asset.id, asset);
  }
  return byMint;
}
