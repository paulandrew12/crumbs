import { Connection, PublicKey } from "@solana/web3.js";

/**
 * `.cook` names, from the CookOven name service.
 *
 * Note this is NOT the SPL Name Service at `namesLPne…`, which is a separate
 * genesis program with its own unrelated accounts. CookOven holds 108 domains
 * and 17 primaries (10 Sep 2026).
 *
 * Both directions are a single derived read, so resolution is cheap:
 *   forward  `["domain", label]`  → the owner
 *   reverse  `["primary", owner]` → the name they chose to display
 *
 * Layout adapted from cookiechain/cookie-mcp (MIT) and verified on-chain:
 * domainPda("miggly"), ("heat"), ("book"), ("moon") and ("0") all derive their
 * real accounts, and the primary PDA round-trips to emyr.cook / meme.cook /
 * domains.cook.
 */

export const COOK_DOMAINS_PROGRAM = new PublicKey(
  "H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA",
);

const DOMAIN_DISCRIMINATOR = Buffer.from([35, 146, 98, 112, 13, 230, 231, 153]);
const PRIMARY_DISCRIMINATOR = Buffer.from([231, 255, 61, 63, 142, 184, 254, 42]);

export function domainPda(label: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("domain"), Buffer.from(label, "utf8")],
    COOK_DOMAINS_PROGRAM,
  )[0];
}

export function primaryPda(owner: PublicKey | string): PublicKey {
  const o = typeof owner === "string" ? new PublicKey(owner) : owner;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("primary"), o.toBuffer()],
    COOK_DOMAINS_PROGRAM,
  )[0];
}

/** The label without its suffix, lowercased. `Foo.cook` and `foo` both give `foo`. */
export function normalizeLabel(input: string): string {
  return input.trim().toLowerCase().replace(/\.cook$/, "");
}

/**
 * Whether this input should be treated as a name rather than an address.
 *
 * An explicit `.cook` suffix always counts. Otherwise we only guess for input
 * too short to be base58 — a 44-character string is an address, not a name.
 */
export function looksLikeName(input: string): boolean {
  const trimmed = input.trim();
  if (/\.cook$/i.test(trimmed)) return true;
  return /^[a-z0-9-]{1,32}$/i.test(trimmed) && trimmed.length < 32;
}

export function decodeDomain(
  data: Buffer,
): { name: string; owner: string } | null {
  if (data.length < 12) return null;
  if (!data.subarray(0, 8).equals(DOMAIN_DISCRIMINATOR)) return null;
  const nameLength = data.readUInt32LE(8);
  const end = 12 + nameLength;
  if (nameLength === 0 || end + 32 > data.length) return null;
  return {
    name: data.subarray(12, end).toString("utf8"),
    owner: new PublicKey(data.subarray(end, end + 32)).toBase58(),
  };
}

/**
 * `clear_primary_domain` leaves the account behind with an empty name, so
 * "the account exists" is not the same as "a primary is set".
 */
export function decodePrimary(data: Buffer): string | null {
  if (data.length < 44) return null;
  if (!data.subarray(0, 8).equals(PRIMARY_DISCRIMINATOR)) return null;
  const nameLength = data.readUInt32LE(40);
  if (nameLength === 0 || 44 + nameLength > data.length) return null;
  return data.subarray(44, 44 + nameLength).toString("utf8");
}

/** `alice.cook` → the wallet that owns it, or null if unregistered. */
export async function resolveName(
  connection: Connection,
  input: string,
): Promise<string | null> {
  const label = normalizeLabel(input);
  if (!label) return null;
  const info = await connection.getAccountInfo(domainPda(label), "confirmed");
  if (!info?.data) return null;
  return decodeDomain(info.data)?.owner ?? null;
}

/** A wallet → the name it chose to be known by, or null. */
export async function reverseName(
  connection: Connection,
  owner: PublicKey | string,
): Promise<string | null> {
  const info = await connection.getAccountInfo(primaryPda(owner), "confirmed");
  if (!info?.data) return null;
  return decodePrimary(info.data);
}
