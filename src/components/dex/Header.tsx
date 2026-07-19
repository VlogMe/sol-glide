import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Zap } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/60">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-[image:var(--grad-primary)] glow">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            sol<span className="gradient-text">pitch</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#swap" className="hover:text-foreground transition-colors">Swap</a>
          <a href="#pairs" className="hover:text-foreground transition-colors">Markets</a>
          <a href="#stats" className="hover:text-foreground transition-colors">Stats</a>
        </nav>
        <div className="wallet-btn-wrap">
          <WalletMultiButton />
        </div>
      </div>
      <style>{`
        .wallet-btn-wrap .wallet-adapter-button {
          background: var(--grad-primary) !important;
          color: var(--primary-foreground) !important;
          border-radius: 0.75rem !important;
          height: 40px !important;
          font-family: var(--font-sans) !important;
          font-weight: 600 !important;
          padding: 0 1rem !important;
        }
        .wallet-adapter-modal-wrapper { background: var(--card) !important; }
      `}</style>
    </header>
  );
}
