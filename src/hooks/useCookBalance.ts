"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

/**
 * Native COOK balance, refreshed on demand and on websocket account change.
 *
 * Deliberately does not poll: rpc.cookiescan.io is a shared community
 * endpoint, and a portfolio app is read-heavy enough without a timer.
 */
export function useCookBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [lamports, setLamports] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setLamports(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLamports(await connection.getBalance(publicKey, "confirmed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates over the websocket, so a confirmed transaction is
  // reflected without a manual refresh.
  useEffect(() => {
    if (!publicKey) return;
    let id: number | undefined;
    try {
      id = connection.onAccountChange(
        publicKey,
        (account) => setLamports(account.lamports),
        "confirmed",
      );
    } catch {
      // Websocket unavailable — the manual refresh still works.
      return;
    }
    return () => {
      if (id !== undefined) void connection.removeAccountChangeListener(id);
    };
  }, [connection, publicKey]);

  return { lamports, loading, error, refresh };
}
