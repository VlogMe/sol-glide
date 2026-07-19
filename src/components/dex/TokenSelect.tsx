import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { TOKEN_LIST, type Token } from "@/lib/tokens";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

export function TokenSelect({ value, onChange }: { value: Token; onChange: (t: Token) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = TOKEN_LIST.filter(
    (t) => t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-secondary hover:bg-secondary/70 pl-1 pr-3 py-1 border border-border transition-colors">
          <img src={value.logoURI} alt="" className="h-7 w-7 rounded-full bg-muted" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
          <span className="font-semibold">{value.symbol}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
            placeholder="Search name or symbol"
            className="w-full rounded-xl bg-input border border-border pl-9 pr-3 py-2.5 outline-none focus:border-primary/60"
          />
        </div>
        <div className="max-h-80 overflow-y-auto -mx-2">
          {filtered.map((t) => (
            <button
              key={t.mint}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors"
            >
              <img src={t.logoURI} alt="" className="h-8 w-8 rounded-full bg-muted" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
              <div className="text-left">
                <div className="font-semibold">{t.symbol}</div>
                <div className="text-xs text-muted-foreground">{t.name}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
