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

/**
 * Render a raw base-unit amount exactly, without ever going through a float.
 *
 * Token supplies on this chain routinely exceed 2^53 base units, so
 * `Number(raw) / 10 ** decimals` silently loses precision. String maths does
 * not.
 */
export function formatTokenAmount(
  raw: bigint,
  decimals: number,
  maxDp = 4,
): string {
  const negative = raw < 0n;
  const digits = (negative ? -raw : raw).toString().padStart(decimals + 1, "0");

  const whole = digits.slice(0, digits.length - decimals) || "0";
  const frac = decimals > 0 ? digits.slice(digits.length - decimals) : "";

  const grouped = BigInt(whole).toLocaleString("en-US");

  let shown = frac.slice(0, maxDp).replace(/0+$/, "");
  // A tiny non-zero balance should not render as a flat zero.
  if (shown === "" && frac.length > 0 && /[1-9]/.test(frac)) {
    const firstSignificant = frac.search(/[1-9]/);
    shown = frac.slice(0, firstSignificant + 1);
  }

  const sign = negative ? "-" : "";
  return shown ? `${sign}${grouped}.${shown}` : `${sign}${grouped}`;
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return "<$0.01";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1000 ? 2 : 0,
  });
}

export function formatPercent(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
