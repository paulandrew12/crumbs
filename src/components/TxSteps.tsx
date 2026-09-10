"use client";

import { TX_STEPS, type TxState } from "@/hooks/useTransaction";

const LABELS: Record<(typeof TX_STEPS)[number], string> = {
  building: "Build transaction",
  simulating: "Simulate against the chain",
  signing: "Awaiting your signature",
  sending: "Broadcast to the network",
  confirming: "Wait for confirmation",
};

/** Where each phase sits in the pipeline; -1 for terminal states. */
function indexOfPhase(state: TxState): number {
  switch (state.phase) {
    case "building": return 0;
    case "simulating": return 1;
    case "signing": return 2;
    case "sending": return 3;
    case "confirming": return 4;
    case "confirmed": return TX_STEPS.length;
    default: return -1;
  }
}

export function TxSteps({ state, failedAt }: { state: TxState; failedAt: number }) {
  const current = indexOfPhase(state);

  return (
    <ol className="steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {TX_STEPS.map((step, i) => {
        let cls = "step";
        if (state.phase === "failed" && i === failedAt) cls += " failed";
        else if (current > i) cls += " done";
        else if (current === i) cls += " active";
        return (
          <li key={step} className={cls}>
            <span className="dot" aria-hidden="true" />
            {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
