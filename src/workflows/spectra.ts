import { defineWorkflow, type Context } from '../core/types.js';
import { SPECTRA } from '../config/contracts.js';
import { REPOS, EVENTS } from '../config/github.js';

// ABI fragments for checkers
const safeModuleAbi = [
  {
    name: 'canClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const;

const merkleAbi = [
  {
    name: 'root',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

export const spectraWorkflow = defineWorkflow({
  id: 'spectra-distribution',
  name: 'Spectra Weekly Distribution',
  description: 'Claim, swap, and distribute Spectra bounties on Base',

  schedule: {
    cron: '0 6 * * 4', // Thursday 06:00 UTC
  },

  config: {
    timeout: 4 * 60 * 60 * 1000, // 4 hours max
    notifyOn: ['start', 'success', 'failure'],
  },

  steps: [
    // Step 1: Claim bounties from Safe Module
    {
      id: 'claim',
      name: 'Claim Spectra bounties',
      trigger: {
        type: 'github-dispatch',
        repo: REPOS.WORKFLOWS,
        event: EVENTS.SPECTRA_CLAIM,
      },
      check: {
        type: 'onchain',
        chain: SPECTRA.CHAIN_ID,
        address: SPECTRA.SAFE_MODULE,
        abi: safeModuleAbi,
        functionName: 'canClaim',
        expect: false, // canClaim = false means already claimed
      },
      retry: {
        maxAttempts: 3,
        delayMs: 60_000,
        backoff: 'exponential',
      },
    },

    // Step 2: Generate claims report in bounties-report
    {
      id: 'report-claims',
      name: 'Generate claims report',
      dependsOn: ['claim'],
      trigger: {
        type: 'github-dispatch',
        repo: REPOS.BOUNTIES_REPORT,
        event: EVENTS.UPDATE_SPECTRA_CLAIMS,
      },
      check: {
        type: 'github-file',
        repo: REPOS.BOUNTIES_REPORT,
        path: (ctx: Context) =>
          `weekly-bounties/${ctx.period}/spectra/claimed_bounties.json`,
      },
      retry: {
        maxAttempts: 3,
        delayMs: 60_000,
      },
    },

    // Step 3: Generate merkle tree
    {
      id: 'merkle',
      name: 'Generate merkle tree',
      dependsOn: ['report-claims'],
      trigger: {
        type: 'github-dispatch',
        repo: REPOS.BOUNTIES_REPORT,
        event: EVENTS.GENERATE_SPECTRA_MERKLE,
      },
      check: {
        type: 'github-file',
        repo: REPOS.BOUNTIES_REPORT,
        path: (ctx: Context) =>
          `bounties-reports/${ctx.period}/sdTkns/sdtkns_merkle_8453.json`,
        contentCheck: (content: unknown, ctx: Context) => {
          const data = content as { root?: string };
          if (data.root) {
            ctx.set('merkleRoot', data.root);
            return true;
          }
          return false;
        },
      },
      retry: {
        maxAttempts: 2,
        delayMs: 120_000,
      },
    },

    // Step 4: Swap tokens to sdSPECTRA (runs in batches)
    {
      id: 'swap',
      name: 'Swap to sdSPECTRA',
      dependsOn: ['report-claims'], // Can start after claims, parallel to merkle
      trigger: {
        type: 'github-dispatch',
        repo: REPOS.WORKFLOWS,
        event: EVENTS.SPECTRA_SWAP,
        payload: {
          operation: 'batch',
          batch_number: '0',
        },
      },
      check: {
        type: 'balance',
        chain: SPECTRA.CHAIN_ID,
        token: SPECTRA.SD_SPECTRA,
        address: SPECTRA.MERKLE,
        minBalance: 1n, // At least some sdSPECTRA arrived
      },
      retry: {
        maxAttempts: 6, // Multiple batches
        delayMs: 120_000,
        backoff: 'linear',
      },
      config: {
        continueOnFail: false,
      },
    },

    // Step 5: Set merkle roots on-chain
    {
      id: 'set-roots',
      name: 'Set merkle roots on-chain',
      dependsOn: ['merkle', 'swap'], // Needs both merkle generated and tokens swapped
      trigger: {
        type: 'github-dispatch',
        repo: REPOS.WORKFLOWS,
        event: EVENTS.SPECTRA_SET_ROOTS,
      },
      check: {
        type: 'onchain',
        chain: SPECTRA.CHAIN_ID,
        address: SPECTRA.MERKLE,
        abi: merkleAbi,
        functionName: 'root',
        expect: (result: unknown, ctx: Context) => {
          const expectedRoot = ctx.get<string>('merkleRoot');
          if (!expectedRoot) {
            console.warn('[checker] No merkleRoot in context');
            return false;
          }
          return result === expectedRoot;
        },
      },
      retry: {
        maxAttempts: 2,
        delayMs: 60_000,
      },
    },
  ],
});
