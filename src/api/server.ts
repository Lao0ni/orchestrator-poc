import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { listWorkflows, getWorkflow } from '../workflows/index.js';
import { getWorkflowRun } from '../core/db.js';
import { triggerWorkflow, getNextRuns } from '../core/scheduler.js';
import { getCurrentPeriod } from '../core/types.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List all workflows
app.get('/workflows', (c) => {
  const workflows = listWorkflows().map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    schedule: w.schedule,
    stepsCount: w.steps.length,
  }));

  const nextRuns = getNextRuns();
  const workflowsWithNext = workflows.map((w) => ({
    ...w,
    nextRun: nextRuns.find((n) => n.workflowId === w.id)?.nextRun,
  }));

  return c.json({ workflows: workflowsWithNext });
});

// Get workflow details
app.get('/workflows/:id', (c) => {
  const workflow = getWorkflow(c.req.param('id'));
  if (!workflow) {
    return c.json({ error: 'Workflow not found' }, 404);
  }

  return c.json({
    ...workflow,
    steps: workflow.steps.map((s) => ({
      id: s.id,
      name: s.name,
      dependsOn: s.dependsOn,
      triggerType: s.trigger.type,
      retry: s.retry,
    })),
  });
});

// Get workflow run status
app.get('/workflows/:id/runs/:period', (c) => {
  const workflowId = c.req.param('id');
  const period = parseInt(c.req.param('period'), 10);

  const run = getWorkflowRun(workflowId, period);
  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  return c.json(run);
});

// Get current period run
app.get('/workflows/:id/current', (c) => {
  const workflowId = c.req.param('id');
  const period = getCurrentPeriod();

  const run = getWorkflowRun(workflowId, period);

  return c.json({
    period,
    periodDate: new Date(period * 1000).toISOString(),
    run: run ?? null,
  });
});

// Trigger workflow manually
app.post('/workflows/:id/trigger', async (c) => {
  const workflowId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const period = body.period ?? getCurrentPeriod();

  console.log(`[api] Manual trigger: ${workflowId} for period ${period}`);

  const result = await triggerWorkflow(workflowId, period);

  return c.json(result);
});

// Get current period info
app.get('/period', (c) => {
  const period = getCurrentPeriod();
  return c.json({
    period,
    periodDate: new Date(period * 1000).toISOString(),
    periodEnd: new Date((period + 604800) * 1000).toISOString(),
  });
});

export { app };

export async function startServer(port = 3000): Promise<void> {
  console.log(`[api] Starting server on port ${port}`);

  // Use @hono/node-server for Node.js
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port });

  console.log(`[api] Server running at http://localhost:${port}`);
}
