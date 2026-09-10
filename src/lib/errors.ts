/**
 * Turns whatever the wallet, the RPC, or the runtime throws into something a
 * person can act on.
 *
 * Every branch answers two questions: what went wrong, and what to do next.
 * `retryable` drives whether the UI offers the action again.
 */

export interface FriendlyError {
  title: string;
  detail: string;
  retryable: boolean;
  /** Raw program logs, when simulation gave us any. */
  logs?: string[];
  /** The original message, kept for the details disclosure. */
  raw?: string;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function logsOf(error: unknown): string[] | undefined {
  if (error && typeof error === "object" && "logs" in error) {
    const logs = (error as { logs: unknown }).logs;
    if (Array.isArray(logs) && logs.length > 0) return logs as string[];
  }
  return undefined;
}

/** Pull `custom program error: 0x…` out of a message or log line. */
function customErrorCode(haystack: string): number | null {
  const match = haystack.match(/custom program error:\s*(0x[0-9a-fA-F]+|\d+)/);
  if (!match) return null;
  const parsed = match[1].startsWith("0x")
    ? Number.parseInt(match[1], 16)
    : Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function explainError(error: unknown): FriendlyError {
  const raw = messageOf(error);
  const lower = raw.toLowerCase();
  const logs = logsOf(error);
  const haystack = [raw, ...(logs ?? [])].join("\n");

  // The user closed the wallet popup. Not a failure worth alarming them about.
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction rejected") ||
    (error as { code?: number })?.code === 4001
  ) {
    return {
      title: "Transaction declined",
      detail: "You dismissed the request in your wallet. Nothing was sent.",
      retryable: true,
      raw,
    };
  }

  // Cookie Chain runs ~1s blocks, so blockhashes age out fast.
  if (
    lower.includes("block height exceeded") ||
    lower.includes("blockhash not found") ||
    lower.includes("transactionexpired")
  ) {
    return {
      title: "Transaction expired",
      detail:
        "The network moved past this transaction's blockhash before it was confirmed. Cookie Chain produces blocks about once a second, so signing needs to be prompt. Try again.",
      retryable: true,
      raw,
    };
  }

  if (
    lower.includes("insufficient lamports") ||
    lower.includes("insufficient funds") ||
    lower.includes("debit an account but found no record")
  ) {
    return {
      title: "Not enough COOK",
      detail:
        "This wallet cannot cover the network fee. Bridge COOK from Solana at hyperlane.cookiescan.io and try again.",
      retryable: false,
      logs,
      raw,
    };
  }

  if (lower.includes("wallet not connected") || lower.includes("no wallet")) {
    return {
      title: "Wallet not connected",
      detail: "Connect Nightly first, then retry.",
      retryable: false,
      raw,
    };
  }

  // Simulation rejected it before it ever reached the chain.
  if (lower.includes("simulation failed") || lower.includes("simulate")) {
    const code = customErrorCode(haystack);
    return {
      title: "Simulation failed",
      detail: code
        ? `The program rejected this transaction with error ${code} (0x${code.toString(16)}). It was not sent, so nothing was spent.`
        : "The transaction was rejected during simulation and never reached the chain, so nothing was spent. The program logs below say why.",
      retryable: false,
      logs,
      raw,
    };
  }

  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit")
  ) {
    return {
      title: "RPC is rate limiting us",
      detail:
        "rpc.cookiescan.io is a shared community endpoint and it is throttling this client. Wait a few seconds and retry.",
      retryable: true,
      raw,
    };
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("econnrefused") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return {
      title: "Cannot reach Cookie Chain",
      detail:
        "The RPC endpoint did not respond. Check your connection, then retry — the public endpoint occasionally drops requests.",
      retryable: true,
      raw,
    };
  }

  return {
    title: "Transaction failed",
    detail: raw || "The transaction did not go through.",
    retryable: true,
    logs,
    raw,
  };
}
