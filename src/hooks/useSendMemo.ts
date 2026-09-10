"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TransactionInstruction } from "@solana/web3.js";
import { PROGRAMS } from "@/lib/chain";
import { useTransaction } from "./useTransaction";

export { TX_STEPS, type TxState } from "./useTransaction";

/** The cheapest possible write, used to prove the pipeline end to end. */
export function useSendMemo() {
  const { publicKey } = useWallet();
  const { state, send, reset, busy } = useTransaction();

  const sendMemo = useCallback(
    (note: string) =>
      send(() => {
        if (!publicKey) throw new Error("Wallet not connected");
        return [
          new TransactionInstruction({
            keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
            programId: PROGRAMS.memo,
            data: Buffer.from(note, "utf8"),
          }),
        ];
      }),
    [publicKey, send],
  );

  return { state, send: sendMemo, reset, busy };
}
