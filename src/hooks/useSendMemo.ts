"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PROGRAMS } from "@/lib/chain";
import { explainError, type FriendlyError } from "@/lib/errors";

/**
 * The full transaction lifecycle, as discrete states.
 *
 * Phase 1 proves this path end-to-end with a Memo write — the cheapest
 * instruction on the chain. Phase 3 reuses it verbatim for claim actions;
 * only the instruction builder changes.
 */
export type TxState =
  | { phase: "idle" }
  | { phase: "building" }
  | { phase: "simulating" }
  | { phase: "signing" }
  | { phase: "sending" }
  | { phase: "confirming"; signature: string }
  | { phase: "confirmed"; signature: string; slot: number; elapsedMs: number }
  | { phase: "failed"; error: FriendlyError; signature?: string; failedAt: number };

export const TX_STEPS = [
  "building",
  "simulating",
  "signing",
  "sending",
  "confirming",
] as const;

export function useSendMemo() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const inFlight = useRef(false);
  // Which pipeline step is in flight, so a failure can point at it.
  const stepRef = useRef(-1);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  const send = useCallback(
    async (note: string) => {
      if (inFlight.current) return;
      if (!connected || !publicKey) {
        setState({
          phase: "failed",
          error: explainError(new Error("Wallet not connected")),
          failedAt: -1,
        });
        return;
      }

      inFlight.current = true;
      stepRef.current = -1;
      const startedAt = performance.now();

      try {
        // 1. Build ------------------------------------------------------
        stepRef.current = 0;
        setState({ phase: "building" });

        const memoIx = new TransactionInstruction({
          keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
          programId: PROGRAMS.memo,
          data: Buffer.from(note, "utf8"),
        });

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        const tx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: blockhash,
            instructions: [memoIx],
          }).compileToV0Message(),
        );

        // 2. Simulate ---------------------------------------------------
        // Never ask someone to sign something we haven't checked. On a
        // mainnet-only chain a failed send costs real COOK; a failed
        // simulation costs nothing.
        stepRef.current = 1;
        setState({ phase: "simulating" });

        const sim = await connection.simulateTransaction(tx, {
          sigVerify: false,
          commitment: "confirmed",
        });

        if (sim.value.err) {
          const err = new Error(
            `Simulation failed: ${JSON.stringify(sim.value.err)}`,
          ) as Error & { logs?: string[] };
          err.logs = sim.value.logs ?? undefined;
          throw err;
        }

        // 3. Sign + send ------------------------------------------------
        stepRef.current = 2;
        setState({ phase: "signing" });
        const signature = await sendTransaction(tx, connection, {
          skipPreflight: false,
          maxRetries: 3,
        });

        // 4. Confirm ----------------------------------------------------
        stepRef.current = 4;
        setState({ phase: "confirming", signature });

        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );

        if (confirmation.value.err) {
          setState({
            phase: "failed",
            error: explainError(
              new Error(
                `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
              ),
            ),
            signature,
            failedAt: 4,
          });
          return;
        }

        setState({
          phase: "confirmed",
          signature,
          slot: confirmation.context.slot,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        setState({
          phase: "failed",
          error: explainError(error),
          failedAt: stepRef.current,
        });
      } finally {
        inFlight.current = false;
      }
    },
    [connected, connection, publicKey, sendTransaction],
  );

  const busy =
    state.phase !== "idle" &&
    state.phase !== "confirmed" &&
    state.phase !== "failed";

  return { state, send, reset, busy };
}
