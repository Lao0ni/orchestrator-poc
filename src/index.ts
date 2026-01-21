import { startScheduler, stopScheduler, triggerWorkflow } from './core/scheduler.js';
import { startServer } from './api/server.js';
import { getCurrentPeriod } from './core/types.js';
import { getDb } from './core/db.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MODE = process.env.MODE || 'scheduler'; // 'scheduler' | 'api' | 'both' | 'run'

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    ORCHESTRATOR POC                           ║
║                                                               ║
║  Mode: ${MODE.padEnd(54)}║
║  Port: ${String(PORT).padEnd(54)}║
║  Period: ${String(getCurrentPeriod()).padEnd(52)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Initialize database
  getDb();

  // Handle different modes
  switch (MODE) {
    case 'scheduler':
      startScheduler();
      break;

    case 'api':
      await startServer(PORT);
      break;

    case 'both':
      startScheduler();
      await startServer(PORT);
      break;

    case 'run': {
      // Run a specific workflow immediately
      const workflowId = process.env.WORKFLOW_ID || 'spectra-distribution';
      const period = process.env.PERIOD ? parseInt(process.env.PERIOD, 10) : getCurrentPeriod();

      console.log(`[main] Running workflow: ${workflowId} for period ${period}`);

      const result = await triggerWorkflow(workflowId, period);
      console.log(`[main] Result:`, result);

      process.exit(result.success ? 0 : 1);
    }

    case 'dry-run': {
      // Dry run a workflow (no actual triggers)
      const workflowId = process.env.WORKFLOW_ID || 'spectra-distribution';
      const period = process.env.PERIOD ? parseInt(process.env.PERIOD, 10) : getCurrentPeriod();

      console.log(`[main] Dry-run workflow: ${workflowId} for period ${period}`);

      const { runWorkflow } = await import('./core/engine.js');
      const { getWorkflow } = await import('./workflows/index.js');

      const workflow = getWorkflow(workflowId);
      if (!workflow) {
        console.error(`Workflow not found: ${workflowId}`);
        process.exit(1);
      }

      const result = await runWorkflow(workflow, period, { dryRun: true });
      console.log(`[main] Result:`, result);

      process.exit(result.success ? 0 : 1);
    }

    default:
      console.error(`Unknown mode: ${MODE}`);
      process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[main] Shutting down...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[main] Shutting down...');
  stopScheduler();
  process.exit(0);
});

main().catch((error) => {
  console.error('[main] Fatal error:', error);
  process.exit(1);
});
