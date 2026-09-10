import { ConnectBar } from "@/components/ConnectBar";
import { PortfolioView } from "@/components/PortfolioView";
import { MemoDemo } from "@/components/MemoDemo";
import { RPC_URL } from "@/lib/chain";

export default function Home() {
  return (
    <main className="shell">
      <header className="masthead">
        <span className="eyebrow">Cookie Chain · Phase 3</span>
        <h1>Crumbs</h1>
        <p>
          A portfolio view for Cookie Chain that surfaces the positions your
          wallet cannot see — launchpad curve shares, LP positions, staked
          bCOOK, and unclaimed fees.
        </p>
        <div style={{ marginTop: 6 }}>
          <ConnectBar />
        </div>
      </header>

      <PortfolioView />
      <MemoDemo />

      <footer className="foot">
        <div className="meta">
          <span>RPC {RPC_URL.replace(/^https?:\/\//, "")}</span>
          <span>Metadata &amp; prices · Cookiescan DAS</span>
          <span>Balances read on-chain, summed in bigint</span>
        </div>
      </footer>
    </main>
  );
}
