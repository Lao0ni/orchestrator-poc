import type { CheckerConfig, Context } from '../core/types.js';
import { checkOnchain, checkBalance } from './onchain.js';
import { checkGitHubFile } from './github-file.js';

export * from './onchain.js';
export * from './github-file.js';

/**
 * Run a single checker and return result
 */
export async function runChecker(config: CheckerConfig, ctx: Context): Promise<boolean> {
  switch (config.type) {
    case 'onchain':
      return checkOnchain(config, ctx);

    case 'github-file':
      return checkGitHubFile(config, ctx);

    case 'balance':
      return checkBalance(config, ctx);

    case 'api':
      return runApiChecker(config, ctx);

    case 'custom':
      return config.fn(ctx);

    default:
      console.error(`[checker] Unknown checker type: ${(config as { type: string }).type}`);
      return false;
  }
}

/**
 * Run multiple checkers - ALL must pass
 */
export async function runCheckers(
  configs: CheckerConfig | CheckerConfig[],
  ctx: Context
): Promise<boolean> {
  const configArray = Array.isArray(configs) ? configs : [configs];

  for (const config of configArray) {
    const result = await runChecker(config, ctx);
    if (!result) {
      console.log(`[checker] Failed: ${config.type}`);
      return false;
    }
    console.log(`[checker] Passed: ${config.type}`);
  }

  return true;
}

async function runApiChecker(
  config: Extract<CheckerConfig, { type: 'api' }>,
  ctx: Context
): Promise<boolean> {
  const url = typeof config.url === 'function' ? config.url(ctx) : config.url;

  try {
    const response = await fetch(url, {
      method: config.method ?? 'GET',
      headers: config.headers,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return config.expect(data, ctx);
  } catch (error) {
    console.error(`[api] Check failed for ${url}:`, error);
    return false;
  }
}
