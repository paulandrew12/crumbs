import { ConnectBar } from "@/components/ConnectBar";
import { BalancePanel } from "@/components/BalancePanel";
import { MemoDemo } from "@/components/MemoDemo";
import { RPC_URL } from "@/lib/chain";

export default function Home() {
  return (
    <main className="shell">
      <header className="masthead">
        <span className="eyebrow">Cookie Chain · Phase 1</span>
        <h1>Crumbs</h1>
        <p>
          A portfolio view for Cookie Chain that surfaces the positions your
          wallet cannot see — launchpad curve shares, LP positions, staked
          bCOOK, and unclaimed fees. This is the foundation: wallet, balance,
          and a proven write path.
        </p>
        <div style={{ marginTop: 6 }}>
          <ConnectBar />
        </div>
      </header>

      <BalancePanel />
      <MemoDemo />

      <footer className="foot">
        <div className="meta">
          <span>RPC {RPC_URL.replace(/^https?:\/\//, "")}</span>
          <span>COOK · 9 decimals</span>
          <span>Wallet standard · Nightly</span>
        </div>
      </footer>
    </main>
  );
}
