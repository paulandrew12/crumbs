"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchPortfolio, type Portfolio } from "@/lib/portfolio";

export interface PortfolioState {
  data: Portfolio | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads a portfolio for any address — the connected wallet, or one someone
 * pasted in. Read-only by design: nothing here needs a signature.
 */
export function usePortfolio(address: string | null): PortfolioState {
  const { connection } = useConnection();
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    abortRef.current?.abort();

    if (!address) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let owner: PublicKey;
    try {
      owner = new PublicKey(address);
    } catch {
      setData(null);
      setError("That is not a valid Solana-format address.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetchPortfolio(connection, owner, controller.signal)
      .then((portfolio) => {
        if (controller.signal.aborted) return;
        setData(portfolio);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [address, connection, nonce]);

  return { data, loading, error, refresh };
}
