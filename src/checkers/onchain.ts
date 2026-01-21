import { createPublicClient, http, erc20Abi, type Address, type PublicClient } from 'viem';
import { RPC_URLS, CHAINS } from '../config/chains.js';
import type { OnchainChecker, BalanceChecker, Context } from '../core/types.js';

// Client cache
const clients = new Map<number, PublicClient>();

export function getClient(chainId: number): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    const chain = CHAINS[chainId];
    const rpcUrl = RPC_URLS[chainId];
    if (!chain || !rpcUrl) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    clients.set(chainId, client);
  }
  return client;
}

export async function checkOnchain(config: OnchainChecker, ctx: Context): Promise<boolean> {
  const client = getClient(config.chain);

  try {
    const result = await client.readContract({
      address: config.address,
      abi: config.abi,
      functionName: config.functionName,
      args: config.args ?? [],
    });

    if (typeof config.expect === 'function') {
      return config.expect(result, ctx);
    }
    return result === config.expect;
  } catch (error) {
    console.error(`[onchain] Check failed for ${config.functionName}:`, error);
    return false;
  }
}

export async function checkBalance(config: BalanceChecker, ctx: Context): Promise<boolean> {
  const client = getClient(config.chain);
  const address = typeof config.address === 'function' ? config.address(ctx) : config.address;

  try {
    const balance = await client.readContract({
      address: config.token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });

    // Store current balance for future comparisons
    const snapshotKey = `balance:${config.chain}:${config.token}:${address}`;

    // Check minimum balance
    if (config.minBalance !== undefined) {
      if (balance < config.minBalance) {
        return false;
      }
    }

    // Check balance change
    if (config.changed) {
      const previousBalance = ctx.getSnapshotBalance(snapshotKey);
      if (previousBalance === undefined) {
        // First check - snapshot and return false (need to wait for change)
        ctx.snapshotBalance(snapshotKey, balance);
        return false;
      }

      if (config.changed === 'increased' && balance <= previousBalance) {
        return false;
      }
      if (config.changed === 'decreased' && balance >= previousBalance) {
        return false;
      }
    }

    // Update snapshot
    ctx.snapshotBalance(snapshotKey, balance);
    return true;
  } catch (error) {
    console.error(`[balance] Check failed for ${config.token}:`, error);
    return false;
  }
}

export async function getBalance(chainId: number, token: Address, address: Address): Promise<bigint> {
  const client = getClient(chainId);
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });
}

export async function readContract<T>(
  chainId: number,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  const client = getClient(chainId);
  return client.readContract({
    address,
    abi,
    functionName,
    args,
  }) as Promise<T>;
}
