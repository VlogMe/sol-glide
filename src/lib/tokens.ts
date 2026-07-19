export type Token = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
  /** true for tokens loaded ad-hoc by mint address (possibly low liquidity / bonding curve) */
  warn?: boolean;
};

export const TOKENS: Record<string, Token> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  BONK: {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  WIF: {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link",
  },
  JUP: {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  PYTH: {
    symbol: "PYTH",
    name: "Pyth Network",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    logoURI: "https://pyth.network/token.svg",
  },
  JTO: {
    symbol: "JTO",
    name: "Jito",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    logoURI: "https://metadata.jito.network/token/jto/image",
  },
  SPDD: {
    symbol: "SPDD",
    name: "SolPitch (VIP Token)",
    mint: "C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump",
    decimals: 6,
    logoURI: "https://img-v1.raydium.io/icon/C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump.png",
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

export const SPDD_MINT = "C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump";

export const POPULAR_PAIRS: { from: string; to: string; vip?: boolean }[] = [
  { from: "SPDD", to: "SOL", vip: true },
  { from: "SOL", to: "USDC" },
  { from: "BONK", to: "SOL" },
  { from: "WIF", to: "USDC" },
  { from: "JUP", to: "SOL" },
  { from: "PYTH", to: "USDC" },
  { from: "JTO", to: "USDC" },
];
