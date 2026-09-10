import { LAMPORTS_PER_COOK } from "./chain";

/** Render lamports as COOK. Trims trailing zeros but keeps at least 2 dp. */
export function formatCook(lamports: number | bigint, maxDp = 6): string {
  const value = Number(lamports) / LAMPORTS_PER_COOK;
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(maxDp);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  const [whole, frac = ""] = trimmed.split(".");
  const grouped = Number(whole).toLocaleString("en-US");
  const padded = frac.length === 0 ? "00" : frac.length === 1 ? frac + "0" : frac;
  return `${grouped}.${padded}`;
}

/** base58 addresses are 44 chars; show enough to be recognisable. */
export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
