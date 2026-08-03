export type Token = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
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
  POPCAT: {
    symbol: "POPCAT",
    name: "Popcat",
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    decimals: 9,
    logoURI: "https://arweave.net/A1etRNMKxhlNGTf-gNBtJ75QJJ4NJtbKh_UXQTlLXzI",
  },
  MOODENG: {
    symbol: "MOODENG",
    name: "Moo Deng",
    mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY",
    decimals: 6,
    logoURI: "https://ipfs.io/ipfs/Qmf1g7dJZNDJHRQru7E7ENwDjcvu7swMUB6x9ZqPXr4RV2",
  },
  PNUT: {
    symbol: "PNUT",
    name: "Peanut the Squirrel",
    mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump",
    decimals: 6,
    logoURI: "https://ipfs.io/ipfs/QmNdTtJauw39u4DzGyTaZ35rRx4VgAxqb91wE89zjyHWd2",
  },
  ONYX: {
    symbol: "ONYX",
    name: "Onyx Kitty",
    mint: "5uHh5i8KUHmu6334mcQpc6FejLuoJQSjJZYPgQ8cpump",
    decimals: 6,
    logoURI: "https://ipfs.io/ipfs/bafkreibw4ewc2pi2muwgsnwt3uc6wapmzlsmy24h5if2ta27anysqf4p6i",
  },
  TOEZ: {
    symbol: "$TOEZ",
    name: "TOEZ",
    mint: "3DRCui7ZbEykhrUHMbyXSvn5731fbKchFTFvs1Wjpump",
    decimals: 6,
    logoURI: "https://ipfs.io/ipfs/QmQojwpFsx6GQeFkVxL87fcKVKacchjbEDWqXuPDcg5uJu",
  },
  FARTCOIN: {
    symbol: "FARTCOIN",
    name: "Fartcoin",
    mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
    decimals: 6,
    logoURI: "https://coin-images.coingecko.com/coins/images/50891/small/fart.jpg?1729503972",
  },
  GOAT: {
    symbol: "GOAT",
    name: "Goatseus Maximus",
    mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",
    decimals: 6,
    logoURI: "https://ipfs.io/ipfs/QmapAq9WtNrtyaDtjZPAHHNYmpSZAQU6HywwvfSWq4dQVV",
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

export const POPULAR_PAIRS: { from: string; to: string }[] = [
  { from: "SOL", to: "TOEZ" },
  { from: "SOL", to: "ONYX" },
  { from: "SOL", to: "USDC" },
  { from: "SOL", to: "USDT" },
  { from: "SOL", to: "BONK" },
  { from: "SOL", to: "WIF" },
  { from: "SOL", to: "POPCAT" },
  { from: "SOL", to: "MOODENG" },
  { from: "SOL", to: "PNUT" },
  { from: "SOL", to: "JUP" },
];
