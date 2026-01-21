import { mainnet, base, arbitrum, optimism, polygon, bsc, linea, fraxtal } from 'viem/chains';
import type { Chain } from 'viem';

export const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_MAINNET || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  8453: process.env.RPC_BASE || `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  42161: process.env.RPC_ARBITRUM || `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  10: process.env.RPC_OPTIMISM || 'https://mainnet.optimism.io',
  137: process.env.RPC_POLYGON || `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  56: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org',
  59144: process.env.RPC_LINEA || `https://linea-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  252: process.env.RPC_FRAXTAL || 'https://rpc.frax.com',
};

export const CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  56: bsc,
  59144: linea,
  252: fraxtal,
};

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  56: 'BSC',
  59144: 'Linea',
  252: 'Fraxtal',
};
