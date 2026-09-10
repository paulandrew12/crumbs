import { PublicKey } from "@solana/web3.js";

/**
 * Cookie Chain network constants.
 *
 * Cookie Chain is an SVM L1 with its own genesis — it is NOT Solana mainnet.
 * Verified 10 Sep 2026: solana-core 4.1.2, genesis
 * 9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2.
 */

export const RPC_URL =
  process.env.NEXT_PUBLIC_COOKIE_RPC_URL ?? "https://rpc.cookiescan.io";

/**
 * The docs list the websocket as `https://wss.cookiescan.io`, but web3.js
 * requires a ws:// or wss:// scheme, so we normalise it here.
 */
export const WS_URL = (
  process.env.NEXT_PUBLIC_COOKIE_WS_URL ?? "wss://wss.cookiescan.io"
).replace(/^http/, "ws");

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_COOKIE_EXPLORER ?? "https://cookiescan.io";

/** COOK is the native fee token: 9 decimals, lamports-style precision. */
export const COOK_DECIMALS = 9;
export const LAMPORTS_PER_COOK = 1_000_000_000;

/** Genesis-embedded programs. Addresses match Solana's canonical IDs. */
export const PROGRAMS = {
  memo: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
  splToken: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  token2022: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
  associatedToken: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  tokenMetadata: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
  nameService: new PublicKey("namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX"),
  auctionHouse: new PublicKey("hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk"),
} as const;

export function explorerTx(signature: string): string {
  return `${EXPLORER_URL}/tx/${signature}`;
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
