import { createContext, useContext, type ReactNode } from "react";

type SolpitchWalletRuntime = {
  publicKey: { toBase58: () => string } | null;
  connected: boolean;
  connecting: boolean;
  signTransaction?: any;
  connection: any | null;
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