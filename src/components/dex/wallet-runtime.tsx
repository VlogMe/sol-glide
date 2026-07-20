import { createContext, useContext, type ReactNode } from "react";

type SolpitchWalletRuntime = {
  publicKey: { toBase58: () => string } | null;
  connected: boolean;
  connecting: boolean;
  signTransaction?: (transaction: unknown) => Promise<any>;
  connection: {
    sendRawTransaction?: (rawTransaction: Uint8Array | Buffer, options?: unknown) => Promise<string>;
    getLatestBlockhash?: () => Promise<any>;
    confirmTransaction?: (strategy: any, commitment?: string) => Promise<any>;
  } | null;
  walletModal: {
    visible: boolean;
    show: () => void;
  };
};

const fallbackWalletRuntime: SolpitchWalletRuntime = {
  publicKey: null,
  connected: false,
  connecting: false,
  signTransaction: undefined,
  connection: null,
  walletModal: {
    visible: false,
    show: () => {
      console.log("Connect button clicked");
      window.dispatchEvent(new Event("solpitch:open-wallet-modal"));
    },
  },
};

const SolpitchWalletContext = createContext<SolpitchWalletRuntime>(fallbackWalletRuntime);

export function SolpitchWalletRuntimeProvider({
  value,
  children,
}: {
  value: SolpitchWalletRuntime;
  children: ReactNode;
}) {
  return <SolpitchWalletContext.Provider value={value}>{children}</SolpitchWalletContext.Provider>;
}

export function useSolpitchWallet() {
  return useContext(SolpitchWalletContext);
}