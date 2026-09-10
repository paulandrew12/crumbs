import { NextRequest } from "next/server";

/**
 * Proxy for token artwork.
 *
 * Token metadata points at arbitrary hosts — mostly IPFS gateways, which
 * serve `Cross-Origin-Resource-Policy: same-origin`. The browser then refuses
 * to render them in an <img>, and every logo falls back to initials. Fetching
 * server-side and re-serving from our own origin sidesteps that.
 *
 * Because this fetches a URL supplied by on-chain data, it is an SSRF surface.
 * The guards below are the point of the file, not an afterthought.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 6000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

/** Reject anything that resolves to a private range by its literal form. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;

  // IPv4 literals in private / link-local / loopback ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }

  // IPv6 loopback / unique-local / link-local.
  if (host === "::" || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (host.startsWith("fe80:")) return true;

  return false;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("Malformed url", { status: 400 });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return new Response("Unsupported scheme", { status: 400 });
  }
  if (isPrivateHost(url.hostname)) {
    return new Response("Blocked host", { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });

    if (!upstream.ok) {
      return new Response("Upstream error", { status: 502 });
    }

    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return new Response("Not an image", { status: 415 });
    }

    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      return new Response("Too large", { status: 413 });
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return new Response("Too large", { status: 413 });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        // Token art is immutable in practice; cache hard.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "same-origin",
        // No `sandbox` here: it is a document directive, and on an image
        // response it puts the resource in an opaque origin that never paints.
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
