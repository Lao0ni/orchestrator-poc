import type { Address } from 'viem';

// ============ SPECTRA (Base - 8453) ============

export const SPECTRA = {
  CHAIN_ID: 8453,

  // Tokens
  SPECTRA_TOKEN: '0x64FCC3A02eeEba05Ef701b7eed066c6ebD5d4E51' as Address,
  SD_SPECTRA: '0x8e7801bAC71E92993f6924e7D767D7dbC5fCE0AE' as Address,

  // Contracts
  SAFE_MODULE: '0x0000000000000000000000000000000000000000' as Address, // TODO: fill
  VOTER: '0x0000000000000000000000000000000000000000' as Address, // TODO: fill
  MERKLE: '0x0000000000000000000000000000000000000000' as Address, // TODO: fill
  REWARDS_RECIPIENT: '0x0000000000000000000000000000000000000000' as Address, // TODO: fill

  // Config
  POOL: '0x02D55aF4813a3a6826Ef185935E4FC1dEfA45FB0' as Address,
  DEPOSITOR: '0x9A7B5505c91b1add06188C665B588D4CC5227F27' as Address,
} as const;

// ============ vlCVX (Ethereum - 1) ============

export const VLCVX = {
  CHAIN_ID: 1,

  // Tokens
  CVX: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B' as Address,

  // Contracts
  LOCKER: '0x72a19342e8F1838460eBFCCEf09F6585e32db86E' as Address,
  MERKLE: '0x0000000000000000000000000000000000000000' as Address, // TODO: fill

  // Votemarket
  CURVE_VM: '0x0000000895cB182E6f983eb4D8b4E0Aa0B31Ae4c' as Address,
} as const;

// ============ vlAURA (Ethereum - 1) ============

export const VLAURA = {
  CHAIN_ID: 1,

  // Tokens
  AURA: '0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF' as Address,

  // Contracts
  LOCKER: '0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC' as Address,
} as const;

// ============ Common ============

export const WETH: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  10: '0x4200000000000000000000000000000000000006',
};

export const EXECUTOR = '0x0000000a3Fc396B89e4c11841B39D9dff85a5D05' as Address;
export const ALL_MIGHT = '0x0000000a3Fc396B89e4c11841B39D9dff85a5D05' as Address;
