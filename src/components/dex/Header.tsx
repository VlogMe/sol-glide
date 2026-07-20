import logoAsset from "@/assets/solpitch-logo.png.asset.json";

export function Header() {
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
      </div>
    </header>
  );
}

