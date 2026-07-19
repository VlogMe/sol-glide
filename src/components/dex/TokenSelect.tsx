import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, Loader2, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { TOKEN_LIST, type Token } from "@/lib/tokens";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { resolveTokenByMint } from "@/lib/jupiter.functions";

const BASE58_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function TokenSelect({ value, onChange }: { value: Token; onChange: (t: Token) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resolved, setResolved] = useState<Token | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const resolveFn = useServerFn(resolveTokenByMint);

  const trimmed = q.trim();
  const isMintPaste = BASE58_MINT.test(trimmed);

  const filtered = useMemo(
    () =>
      TOKEN_LIST.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q.toLowerCase()) ||
          t.name.toLowerCase().includes(q.toLowerCase()) ||
          t.mint === trimmed,
      ),
    [q, trimmed],
  );

  useEffect(() => {
    setResolved(null);
    setResolveError(null);
    if (!isMintPaste) return;
    // If already in the built-in list, no need to resolve.
    if (TOKEN_LIST.some((t) => t.mint === trimmed)) return;
    let cancelled = false;
    setResolving(true);
    resolveFn({ data: { mint: trimmed } })
      .then((t) => {
        if (!cancelled) setResolved(t as Token);
      })
      .catch((e) => {
        if (!cancelled) setResolveError(String(e?.message || "Could not resolve token"));
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, isMintPaste, resolveFn]);

  const select = (t: Token) => {
    onChange(t);
    setOpen(false);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-secondary hover:bg-secondary/70 pl-1 pr-3 py-1 border border-border transition-colors max-w-[10rem]">
          <img
            src={value.logoURI}
            alt=""
            className="h-7 w-7 rounded-full bg-muted shrink-0"
            onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
          />
          <span className="font-semibold truncate">{value.symbol}</span>
          {value.warn && <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogTitle>Select a token</DialogTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, symbol, or paste mint address"
            className="w-full rounded-xl bg-input border border-border pl-9 pr-3 py-2.5 outline-none focus:border-primary/60"
          />
        </div>

        {isMintPaste && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
            {resolving && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Looking up mint on-chain…
              </div>
            )}
            {resolveError && <div className="text-destructive">{resolveError}</div>}
            {resolved && (
              <>
                <button
                  onClick={() => select(resolved)}
                  className="w-full flex items-center gap-3 rounded-lg hover:bg-secondary/60 p-2 -m-2 text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[10px] font-semibold">
                    {resolved.logoURI ? (
                      <img
                        src={resolved.logoURI}
                        alt=""
                        className="h-8 w-8 rounded-full"
                        onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                      />
                    ) : (
                      resolved.symbol.slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      {resolved.symbol}
                      {resolved.warn && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 text-[10px] font-medium">
                          <AlertTriangle className="h-3 w-3" /> Unverified
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{resolved.mint}</div>
                  </div>
                </button>
                {resolved.warn && (
                  <div className="mt-2 flex items-start gap-1.5 text-yellow-300">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Low liquidity / bonding-curve token — trade carefully.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto -mx-2">
          {filtered.map((t) => (
            <button
              key={t.mint}
              onClick={() => select(t)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors"
            >
              <img
                src={t.logoURI}
                alt=""
                className="h-8 w-8 rounded-full bg-muted"
                onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
              />
              <div className="text-left flex-1">
                <div className="font-semibold flex items-center gap-2">
                  {t.symbol}
                  {t.symbol === "SPDD" && (
                    <span className="inline-flex items-center rounded-full bg-success/15 text-success border border-success/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      VIP
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{t.name}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && !isMintPaste && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches. Paste a mint address to load any Solana token.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
