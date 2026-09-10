"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSendMemo } from "@/hooks/useSendMemo";
import { TxSteps } from "./TxSteps";
import { explorerTx } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/**
 * Phase 1's proof that the whole write path works: build, simulate, sign,
 * send, confirm, and report — with every failure mode handled.
 *
 * A Memo is the cheapest instruction on the chain, so this costs a fraction
 * of a cent to exercise. Phase 3 swaps the instruction for a claim and keeps
 * everything else.
 */
export function MemoDemo() {
  const { connected } = useWallet();
  const { state, send, reset, busy } = useSendMemo();
  const [note, setNote] = useState("gm from crumbs");

  async function onSend() {
    await send(note.trim() || "gm from crumbs");
  }

  const showRail = state.phase !== "idle";

  return (
    <section className="panel">
      <h2>Write a transaction</h2>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5 }}>
        Writes a short note on-chain through the Memo program. It is simulated
        before you are asked to sign, so a transaction that would fail never
        costs you anything.
      </p>

      <div className="row">
        <input
          className="note"
          value={note}
          maxLength={180}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note to write on-chain"
          placeholder="gm from crumbs"
        />
        <button className="action" onClick={() => void onSend()} disabled={!connected || busy}>
          {busy ? "Working…" : "Send memo"}
        </button>
      </div>

      {!connected ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Connect a wallet to enable this.
        </p>
      ) : null}

      {showRail ? (
        <TxSteps
          state={state}
          failedAt={state.phase === "failed" ? state.failedAt : -1}
        />
      ) : null}

      {state.phase === "confirmed" ? (
        <div className="result ok">
          <h3>Confirmed</h3>
          <p>
            Landed in slot {state.slot.toLocaleString("en-US")} after{" "}
            {(state.elapsedMs / 1000).toFixed(1)}s.
          </p>
          <div className="meta" style={{ marginTop: 10 }}>
            <a href={explorerTx(state.signature)} target="_blank" rel="noreferrer">
              {shortAddress(state.signature, 8, 8)} ↗
            </a>
            <button
              className="action ghost"
              style={{ padding: "2px 10px", fontSize: 12 }}
              onClick={reset}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === "failed" ? (
        <div className="result bad">
          <h3>{state.error.title}</h3>
          <p>{state.error.detail}</p>

          {state.signature ? (
            <div className="meta" style={{ marginTop: 10 }}>
              <a href={explorerTx(state.signature)} target="_blank" rel="noreferrer">
                {shortAddress(state.signature, 8, 8)} ↗
              </a>
            </div>
          ) : null}

          {state.error.logs?.length ? (
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  marginTop: 10,
                  fontSize: 12.5,
                  color: "var(--muted)",
                }}
              >
                Program logs
              </summary>
              <pre className="logs">{state.error.logs.join("\n")}</pre>
            </details>
          ) : null}

          <div className="meta" style={{ marginTop: 12 }}>
            {state.error.retryable ? (
              <button
                className="action"
                style={{ padding: "4px 12px", fontSize: 12.5 }}
                onClick={() => void onSend()}
              >
                Try again
              </button>
            ) : null}
            <button
              className="action ghost"
              style={{ padding: "4px 12px", fontSize: 12.5 }}
              onClick={reset}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
