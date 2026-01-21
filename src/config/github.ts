export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export const REPOS = {
  WORKFLOWS: 'stake-dao/workflows',
  BOUNTIES_REPORT: 'stake-dao/bounties-report',
  AUTOMATION_JOBS: 'stake-dao/automation-jobs',
} as const;

// Event type mappings for repository_dispatch
export const EVENTS = {
  // Spectra
  SPECTRA_CLAIM: 'spectra-claim',
  SPECTRA_SWAP: 'spectra-swap',
  SPECTRA_SET_ROOTS: 'spectra-set-roots',

  // Bounties Report triggers
  UPDATE_SPECTRA_CLAIMS: 'update-spectra-claims',
  GENERATE_SPECTRA_MERKLE: 'generate-spectra-merkle',

  // vlCVX
  VLCVX_CLAIM: 'vlcvx-claim',
  VLCVX_REPARTITION: 'vlcvx-repartition',
  GENERATE_VLCVX_MERKLES: 'generate-vlcvx-merkles',
} as const;

export const POLLING_CONFIG = {
  // How long to wait after dispatch before first poll
  INITIAL_DELAY_MS: 10_000,
  // Interval between polls
  POLL_INTERVAL_MS: 30_000,
  // Max time to wait for workflow completion
  TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
};
