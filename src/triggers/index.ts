import type { TriggerConfig, Context } from '../core/types.js';
import {
  dispatchWorkflow,
  findWorkflowRun,
  waitForWorkflowCompletion,
  type WorkflowRun,
} from '../github/client.js';
import { POLLING_CONFIG } from '../config/github.js';

export interface TriggerResult {
  success: boolean;
  githubRunId?: number;
  error?: string;
}

/**
 * Execute a trigger and wait for completion
 */
export async function executeTrigger(
  config: TriggerConfig,
  ctx: Context
): Promise<TriggerResult> {
  switch (config.type) {
    case 'github-dispatch':
      return executeGitHubDispatch(config, ctx);

    case 'webhook':
      return executeWebhook(config, ctx);

    case 'manual':
      // Manual triggers always "succeed" - checker will verify
      console.log(`[trigger] Manual step: ${config.prompt}`);
      return { success: true };

    case 'noop':
      // Noop triggers always succeed
      return { success: true };

    default:
      return {
        success: false,
        error: `Unknown trigger type: ${(config as { type: string }).type}`,
      };
  }
}

async function executeGitHubDispatch(
  config: Extract<TriggerConfig, { type: 'github-dispatch' }>,
  ctx: Context
): Promise<TriggerResult> {
  try {
    // Dispatch the workflow
    const dispatch = await dispatchWorkflow(config.repo, config.event, {
      period: ctx.period,
      ...config.payload,
    });

    // Wait a bit before looking for the run
    await sleep(POLLING_CONFIG.INITIAL_DELAY_MS);

    // Find the triggered workflow run
    const run = await findWorkflowRun(
      config.repo,
      dispatch.dispatchedAt,
      config.event
    );

    if (!run) {
      return {
        success: false,
        error: 'Could not find workflow run after dispatch',
      };
    }

    // Wait for completion
    const completedRun = await waitForWorkflowCompletion(config.repo, run.id);

    if (completedRun.conclusion === 'success') {
      return {
        success: true,
        githubRunId: completedRun.id,
      };
    }

    return {
      success: false,
      githubRunId: completedRun.id,
      error: `Workflow failed with conclusion: ${completedRun.conclusion}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeWebhook(
  config: Extract<TriggerConfig, { type: 'webhook' }>,
  ctx: Context
): Promise<TriggerResult> {
  try {
    const response = await fetch(config.url, {
      method: config.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook failed with status: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
