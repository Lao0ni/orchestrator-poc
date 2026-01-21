import type {
  WorkflowDefinition,
  StepDefinition,
  WorkflowRun,
  StepStatus,
} from './types.js';
import { Context } from './context.js';
import {
  createWorkflowRun,
  getWorkflowRun,
  getActiveWorkflowRun,
  updateWorkflowRun,
  getOrCreateStepRun,
  updateStepRun,
  saveWorkflowContext,
  loadWorkflowContext,
} from './db.js';
import { runCheckers } from '../checkers/index.js';
import { executeTrigger } from '../triggers/index.js';

export interface EngineOptions {
  dryRun?: boolean;
  onStepStart?: (step: StepDefinition, ctx: Context) => void;
  onStepComplete?: (step: StepDefinition, ctx: Context, success: boolean) => void;
  onWorkflowComplete?: (workflow: WorkflowDefinition, ctx: Context, success: boolean) => void;
}

/**
 * Run a workflow for a given period
 */
export async function runWorkflow(
  workflow: WorkflowDefinition,
  period: number,
  options: EngineOptions = {}
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[engine] Starting workflow: ${workflow.name}`);
  console.log(`[engine] Period: ${period} (${new Date(period * 1000).toISOString()})`);
  console.log(`${'='.repeat(60)}\n`);

  // Get or create workflow run
  let run = getActiveWorkflowRun(workflow.id, period);
  if (!run) {
    // Check if already completed
    const existingRun = getWorkflowRun(workflow.id, period);
    if (existingRun?.status === 'completed') {
      console.log(`[engine] Workflow already completed for this period`);
      return { success: true };
    }
    run = createWorkflowRun(workflow.id, period);
  }

  // Create or restore context
  const ctx = new Context({
    workflowId: workflow.id,
    runId: run.id,
    period,
  });

  // Restore context data if resuming
  const savedContext = loadWorkflowContext(run.id);
  if (savedContext) {
    try {
      const data = JSON.parse(savedContext);
      for (const [key, value] of Object.entries(data.store || {})) {
        ctx.set(key, value);
      }
      console.log(`[engine] Restored context from previous run`);
    } catch {
      // Ignore parse errors
    }
  }

  // Sort steps topologically
  const sortedSteps = topologicalSort(workflow.steps);

  try {
    for (const step of sortedSteps) {
      ctx.setStep(step.id);
      const stepRun = getOrCreateStepRun(run.id, step.id);

      // Skip completed steps
      if (stepRun.status === 'completed') {
        console.log(`[engine] Step "${step.name}" already completed, skipping`);
        continue;
      }

      // Check dependencies
      if (!areDependenciesMet(step, run)) {
        console.log(`[engine] Step "${step.name}" waiting for dependencies`);
        updateStepRun(run.id, step.id, { status: 'waiting' });
        continue;
      }

      // Check if already done (idempotency)
      console.log(`[engine] Checking if step "${step.name}" is already satisfied...`);
      if (await runCheckers(step.check, ctx)) {
        console.log(`[engine] Step "${step.name}" already satisfied by checker`);
        updateStepRun(run.id, step.id, {
          status: 'completed',
          completedAt: new Date(),
        });
        // Refresh run state
        run = getWorkflowRun(workflow.id, period)!;
        continue;
      }

      // Execute step
      options.onStepStart?.(step, ctx);
      console.log(`\n[engine] Executing step: ${step.name}`);

      if (options.dryRun) {
        console.log(`[engine] DRY RUN - would trigger: ${JSON.stringify(step.trigger)}`);
        continue;
      }

      updateStepRun(run.id, step.id, {
        status: 'running',
        startedAt: new Date(),
        attempts: stepRun.attempts + 1,
      });

      // Execute trigger
      const triggerResult = await executeTrigger(step.trigger, ctx);

      if (triggerResult.githubRunId) {
        updateStepRun(run.id, step.id, {
          githubRunId: triggerResult.githubRunId,
        });
      }

      // Verify with checker (give it some time to propagate)
      await sleep(5_000);

      let checkPassed = false;
      const maxCheckAttempts = 5;

      for (let i = 0; i < maxCheckAttempts; i++) {
        if (await runCheckers(step.check, ctx)) {
          checkPassed = true;
          break;
        }
        console.log(`[engine] Check attempt ${i + 1}/${maxCheckAttempts} failed, waiting...`);
        await sleep(10_000);
      }

      if (triggerResult.success && checkPassed) {
        console.log(`[engine] Step "${step.name}" completed successfully`);
        updateStepRun(run.id, step.id, {
          status: 'completed',
          completedAt: new Date(),
        });
        options.onStepComplete?.(step, ctx, true);
      } else {
        const error = triggerResult.error || 'Checker failed after trigger';
        console.error(`[engine] Step "${step.name}" failed: ${error}`);
        updateStepRun(run.id, step.id, {
          status: 'failed',
          error,
        });
        options.onStepComplete?.(step, ctx, false);

        // Check retry
        const maxAttempts = step.retry?.maxAttempts ?? 3;
        if (stepRun.attempts + 1 < maxAttempts) {
          console.log(`[engine] Will retry (attempt ${stepRun.attempts + 1}/${maxAttempts})`);

          // Save context for resume
          saveWorkflowContext(run.id, JSON.stringify(ctx.toJSON()));

          // Calculate delay
          const delay = calculateRetryDelay(step, stepRun.attempts + 1);
          console.log(`[engine] Waiting ${delay}ms before retry...`);
          await sleep(delay);

          // Reset step status to pending for retry
          updateStepRun(run.id, step.id, { status: 'pending' });

          // Refresh run and continue (will retry this step)
          run = getWorkflowRun(workflow.id, period)!;
          continue;
        }

        // Max retries exceeded
        if (!step.config?.continueOnFail) {
          throw new Error(`Step "${step.name}" failed after ${maxAttempts} attempts`);
        }
        console.log(`[engine] Step "${step.name}" failed but continueOnFail=true`);
      }

      // Save context periodically
      saveWorkflowContext(run.id, JSON.stringify(ctx.toJSON()));

      // Refresh run state
      run = getWorkflowRun(workflow.id, period)!;
    }

    // All steps completed
    updateWorkflowRun(run.id, {
      status: 'completed',
      completedAt: new Date(),
    });
    console.log(`\n[engine] Workflow "${workflow.name}" completed successfully!`);
    options.onWorkflowComplete?.(workflow, ctx, true);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n[engine] Workflow "${workflow.name}" failed: ${errorMsg}`);

    updateWorkflowRun(run.id, {
      status: 'failed',
      completedAt: new Date(),
      error: errorMsg,
    });
    saveWorkflowContext(run.id, JSON.stringify(ctx.toJSON()));
    options.onWorkflowComplete?.(workflow, ctx, false);

    return { success: false, error: errorMsg };
  }
}

/**
 * Check if all dependencies of a step are completed
 */
function areDependenciesMet(step: StepDefinition, run: WorkflowRun): boolean {
  if (!step.dependsOn || step.dependsOn.length === 0) {
    return true;
  }

  return step.dependsOn.every((depId) => {
    const depRun = run.steps[depId];
    return depRun?.status === 'completed';
  });
}

/**
 * Topological sort of steps based on dependencies
 */
function topologicalSort(steps: StepDefinition[]): StepDefinition[] {
  const sorted: StepDefinition[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const stepMap = new Map(steps.map((s) => [s.id, s]));

  function visit(step: StepDefinition) {
    if (visited.has(step.id)) return;
    if (visiting.has(step.id)) {
      throw new Error(`Circular dependency detected at step: ${step.id}`);
    }

    visiting.add(step.id);

    for (const depId of step.dependsOn ?? []) {
      const dep = stepMap.get(depId);
      if (!dep) {
        throw new Error(`Unknown dependency: ${depId}`);
      }
      visit(dep);
    }

    visiting.delete(step.id);
    visited.add(step.id);
    sorted.push(step);
  }

  for (const step of steps) {
    visit(step);
  }

  return sorted;
}

/**
 * Calculate retry delay with optional backoff
 */
function calculateRetryDelay(step: StepDefinition, attempt: number): number {
  const baseDelay = step.retry?.delayMs ?? 60_000;

  if (step.retry?.backoff === 'exponential') {
    return baseDelay * Math.pow(2, attempt - 1);
  }

  if (step.retry?.backoff === 'linear') {
    return baseDelay * attempt;
  }

  return baseDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
