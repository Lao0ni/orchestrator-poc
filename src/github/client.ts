import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN, POLLING_CONFIG } from '../config/github.js';

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokit) {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN is required');
    }
    octokit = new Octokit({ auth: GITHUB_TOKEN });
  }
  return octokit;
}

export interface DispatchResult {
  dispatchedAt: Date;
  repo: string;
  event: string;
}

/**
 * Dispatch a repository_dispatch event
 */
export async function dispatchWorkflow(
  repo: string,
  eventType: string,
  payload: Record<string, unknown> = {}
): Promise<DispatchResult> {
  const octokit = getOctokit();
  const [owner, repoName] = repo.split('/');

  const dispatchedAt = new Date();

  await octokit.repos.createDispatchEvent({
    owner,
    repo: repoName,
    event_type: eventType,
    client_payload: {
      orchestrator_run_id: `orch_${Date.now()}`,
      triggered_at: dispatchedAt.toISOString(),
      ...payload,
    },
  });

  console.log(`[github] Dispatched ${eventType} to ${repo}`);

  return {
    dispatchedAt,
    repo,
    event: eventType,
  };
}

export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Find the workflow run triggered by our dispatch
 */
export async function findWorkflowRun(
  repo: string,
  dispatchedAt: Date,
  eventType: string,
  maxWaitMs = 60_000
): Promise<WorkflowRun | null> {
  const octokit = getOctokit();
  const [owner, repoName] = repo.split('/');

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo: repoName,
      event: 'repository_dispatch',
      created: `>=${dispatchedAt.toISOString().split('.')[0]}Z`,
      per_page: 10,
    });

    // Find a run created after our dispatch
    const run = data.workflow_runs.find((r) => {
      const createdAt = new Date(r.created_at);
      return createdAt >= dispatchedAt;
    });

    if (run) {
      console.log(`[github] Found workflow run: ${run.id} (${run.status})`);
      return {
        id: run.id,
        status: run.status as WorkflowRun['status'],
        conclusion: run.conclusion as WorkflowRun['conclusion'],
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at,
      };
    }

    // Wait before next poll
    await sleep(5_000);
  }

  console.warn(`[github] Could not find workflow run for ${eventType}`);
  return null;
}

/**
 * Get current status of a workflow run
 */
export async function getWorkflowRunStatus(repo: string, runId: number): Promise<WorkflowRun> {
  const octokit = getOctokit();
  const [owner, repoName] = repo.split('/');

  const { data } = await octokit.actions.getWorkflowRun({
    owner,
    repo: repoName,
    run_id: runId,
  });

  return {
    id: data.id,
    status: data.status as WorkflowRun['status'],
    conclusion: data.conclusion as WorkflowRun['conclusion'],
    html_url: data.html_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Wait for a workflow run to complete
 */
export async function waitForWorkflowCompletion(
  repo: string,
  runId: number,
  timeoutMs = POLLING_CONFIG.TIMEOUT_MS
): Promise<WorkflowRun> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const run = await getWorkflowRunStatus(repo, runId);

    if (run.status === 'completed') {
      console.log(`[github] Workflow ${runId} completed: ${run.conclusion}`);
      return run;
    }

    console.log(`[github] Workflow ${runId} still ${run.status}...`);
    await sleep(POLLING_CONFIG.POLL_INTERVAL_MS);
  }

  throw new Error(`Workflow ${runId} timed out after ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
