import { Cron } from 'croner';
import type { WorkflowDefinition } from './types.js';
import { getCurrentPeriod } from './types.js';
import { runWorkflow } from './engine.js';
import { listWorkflows } from '../workflows/index.js';

interface ScheduledJob {
  workflow: WorkflowDefinition;
  cron: Cron;
}

const scheduledJobs: Map<string, ScheduledJob> = new Map();

/**
 * Start the scheduler for all workflows with schedules
 */
export function startScheduler(): void {
  console.log('[scheduler] Starting scheduler...');

  for (const workflow of listWorkflows()) {
    if (workflow.schedule) {
      scheduleWorkflow(workflow);
    }
  }

  console.log(`[scheduler] Scheduled ${scheduledJobs.size} workflows`);
}

/**
 * Schedule a single workflow
 */
export function scheduleWorkflow(workflow: WorkflowDefinition): void {
  if (!workflow.schedule) {
    console.warn(`[scheduler] Workflow ${workflow.id} has no schedule`);
    return;
  }

  // Stop existing job if any
  const existing = scheduledJobs.get(workflow.id);
  if (existing) {
    existing.cron.stop();
  }

  const cron = new Cron(
    workflow.schedule.cron,
    {
      timezone: workflow.schedule.timezone ?? 'UTC',
    },
    async () => {
      console.log(`[scheduler] Triggered workflow: ${workflow.name}`);
      const period = getCurrentPeriod();

      try {
        await runWorkflow(workflow, period);
      } catch (error) {
        console.error(`[scheduler] Workflow ${workflow.id} failed:`, error);
        // TODO: Send notification
      }
    }
  );

  scheduledJobs.set(workflow.id, { workflow, cron });

  const nextRun = cron.nextRun();
  console.log(
    `[scheduler] Scheduled "${workflow.name}" with cron "${workflow.schedule.cron}"` +
      (nextRun ? ` (next: ${nextRun.toISOString()})` : '')
  );
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  console.log('[scheduler] Stopping scheduler...');

  for (const [id, job] of scheduledJobs) {
    job.cron.stop();
    console.log(`[scheduler] Stopped: ${id}`);
  }

  scheduledJobs.clear();
}

/**
 * Get next scheduled runs
 */
export function getNextRuns(): Array<{ workflowId: string; nextRun: Date | null }> {
  return Array.from(scheduledJobs.entries()).map(([id, job]) => ({
    workflowId: id,
    nextRun: job.cron.nextRun(),
  }));
}

/**
 * Manually trigger a workflow
 */
export async function triggerWorkflow(
  workflowId: string,
  period?: number
): Promise<{ success: boolean; error?: string }> {
  const job = scheduledJobs.get(workflowId);

  if (!job) {
    // Try to find in all workflows
    const workflow = listWorkflows().find((w) => w.id === workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }
    return runWorkflow(workflow, period ?? getCurrentPeriod());
  }

  return runWorkflow(job.workflow, period ?? getCurrentPeriod());
}
