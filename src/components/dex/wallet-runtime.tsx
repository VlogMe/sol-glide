import { createContext, useContext, type ReactNode } from "react";

export type SolpitchPublicKey = {
  toBase58: () => string;
  toString: () => string;
};

export type SolpitchWalletRuntime = {
  publicKey: SolpitchPublicKey | null;
  connected: boolean;
  connecting: boolean;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  connection: any | null;
  walletError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

type SolpitchWindow = typeof window & {
  __solpitchConnectPhantomRequested?: boolean;
};

function queuePhantomConnect() {
  console.log("Connect button clicked");
  if (typeof window === "undefined") return;
  const w = window as SolpitchWindow;
  w.__solpitchConnectPhantomRequested = true;
  window.dispatchEvent(new Event("solpitch:connect-phantom"));
}

const fallbackWalletRuntime: SolpitchWalletRuntime = {
  publicKey: null,
  connected: false,
  connecting: false,
  signTransaction: undefined,
  connection: null,
  walletError: null,
  connect: async () => queuePhantomConnect(),
  disconnect: async () => {},
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