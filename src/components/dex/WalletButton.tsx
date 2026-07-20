import "@/lib/buffer-polyfill";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton({ children }: { children?: React.ReactNode }) {
  return <WalletMultiButton>{children}</WalletMultiButton>;
}