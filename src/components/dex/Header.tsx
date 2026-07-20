import logoAsset from "@/assets/solpitch-logo.png.asset.json";
import { WalletButton } from "./WalletButton";

export function Header({ walletReady = true }: { walletReady?: boolean; loadingWallet?: boolean }) {
  const queueWalletModalOpen = () => {
    console.log("Connect button clicked");
    if (typeof window !== "undefined") {
      (window as typeof window & { __solpitchOpenWalletModalRequested?: boolean }).__solpitchOpenWalletModalRequested = true;
      window.dispatchEvent(new Event("solpitch:open-wallet-modal"));
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2 min-w-0">
          <img
            src={logoAsset.url}
            alt="SOLPITCH SWAP"
            className="h-9 w-9 rounded-full ring-1 ring-border object-cover shrink-0"
          />
          <span className="font-display text-base sm:text-xl font-bold tracking-tight truncate">
            <span className="gradient-text">SOLPITCH</span> SWAP
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#swap" className="hover:text-foreground transition-colors">Swap</a>
          <a href="#pairs" className="hover:text-foreground transition-colors">Markets</a>
          <a href="#stats" className="hover:text-foreground transition-colors">Stats</a>
        </nav>
        <div className="wallet-btn-wrap">
          {walletReady ? (
            <WalletButton />
          ) : (
            <button
              type="button"
              onClick={queueWalletModalOpen}
              className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
