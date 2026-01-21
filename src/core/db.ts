import Database from 'better-sqlite3';
import type { WorkflowRun, StepRun, WorkflowRunStatus, StepStatus } from './types.js';

const DB_PATH = process.env.DB_PATH || './data/state.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      period INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      context_data TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      UNIQUE(workflow_id, period)
    );

    CREATE TABLE IF NOT EXISTS step_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_run_id INTEGER NOT NULL,
      step_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      github_run_id INTEGER,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id),
      UNIQUE(workflow_run_id, step_id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_period
      ON workflow_runs(workflow_id, period);

    CREATE INDEX IF NOT EXISTS idx_step_runs_workflow_run
      ON step_runs(workflow_run_id);
  `);
}

// ============ WORKFLOW RUNS ============

export function createWorkflowRun(workflowId: string, period: number): WorkflowRun {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO workflow_runs (workflow_id, period, status, started_at)
    VALUES (?, ?, 'running', ?)
  `).run(workflowId, period, now);

  return {
    id: result.lastInsertRowid as number,
    workflowId,
    period,
    status: 'running',
    steps: {},
    startedAt: new Date(now),
  };
}

export function getWorkflowRun(workflowId: string, period: number): WorkflowRun | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT * FROM workflow_runs WHERE workflow_id = ? AND period = ?
  `).get(workflowId, period) as WorkflowRunRow | undefined;

  if (!row) return null;

  const stepRows = db.prepare(`
    SELECT * FROM step_runs WHERE workflow_run_id = ?
  `).all(row.id) as StepRunRow[];

  const steps: Record<string, StepRun> = {};
  for (const step of stepRows) {
    steps[step.step_id] = {
      stepId: step.step_id,
      status: step.status as StepStatus,
      attempts: step.attempts,
      githubRunId: step.github_run_id ?? undefined,
      startedAt: step.started_at ? new Date(step.started_at) : undefined,
      completedAt: step.completed_at ? new Date(step.completed_at) : undefined,
      error: step.error ?? undefined,
    };
  }

  return {
    id: row.id,
    workflowId: row.workflow_id,
    period: row.period,
    status: row.status as WorkflowRunStatus,
    steps,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    error: row.error ?? undefined,
  };
}

export function getActiveWorkflowRun(workflowId: string, period: number): WorkflowRun | null {
  const run = getWorkflowRun(workflowId, period);
  if (run && (run.status === 'pending' || run.status === 'running')) {
    return run;
  }
  return null;
}

export function updateWorkflowRun(
  runId: number,
  updates: Partial<Pick<WorkflowRun, 'status' | 'completedAt' | 'error'>>
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.completedAt !== undefined) {
    sets.push('completed_at = ?');
    values.push(updates.completedAt.toISOString());
  }
  if (updates.error !== undefined) {
    sets.push('error = ?');
    values.push(updates.error);
  }

  if (sets.length > 0) {
    values.push(runId);
    db.prepare(`UPDATE workflow_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function saveWorkflowContext(runId: number, contextData: string): void {
  const db = getDb();
  db.prepare(`UPDATE workflow_runs SET context_data = ? WHERE id = ?`).run(contextData, runId);
}

export function loadWorkflowContext(runId: number): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT context_data FROM workflow_runs WHERE id = ?`).get(runId) as { context_data: string | null } | undefined;
  return row?.context_data ?? null;
}

// ============ STEP RUNS ============

export function getOrCreateStepRun(workflowRunId: number, stepId: string): StepRun {
  const db = getDb();

  const existing = db.prepare(`
    SELECT * FROM step_runs WHERE workflow_run_id = ? AND step_id = ?
  `).get(workflowRunId, stepId) as StepRunRow | undefined;

  if (existing) {
    return {
      stepId: existing.step_id,
      status: existing.status as StepStatus,
      attempts: existing.attempts,
      githubRunId: existing.github_run_id ?? undefined,
      startedAt: existing.started_at ? new Date(existing.started_at) : undefined,
      completedAt: existing.completed_at ? new Date(existing.completed_at) : undefined,
      error: existing.error ?? undefined,
    };
  }

  db.prepare(`
    INSERT INTO step_runs (workflow_run_id, step_id, status, attempts)
    VALUES (?, ?, 'pending', 0)
  `).run(workflowRunId, stepId);

  return {
    stepId,
    status: 'pending',
    attempts: 0,
  };
}

export function updateStepRun(
  workflowRunId: number,
  stepId: string,
  updates: Partial<StepRun>
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.attempts !== undefined) {
    sets.push('attempts = ?');
    values.push(updates.attempts);
  }
  if (updates.githubRunId !== undefined) {
    sets.push('github_run_id = ?');
    values.push(updates.githubRunId);
  }
  if (updates.startedAt !== undefined) {
    sets.push('started_at = ?');
    values.push(updates.startedAt.toISOString());
  }
  if (updates.completedAt !== undefined) {
    sets.push('completed_at = ?');
    values.push(updates.completedAt.toISOString());
  }
  if (updates.error !== undefined) {
    sets.push('error = ?');
    values.push(updates.error);
  }

  if (sets.length > 0) {
    values.push(workflowRunId, stepId);
    db.prepare(`
      UPDATE step_runs SET ${sets.join(', ')}
      WHERE workflow_run_id = ? AND step_id = ?
    `).run(...values);
  }
}

// ============ TYPES ============

interface WorkflowRunRow {
  id: number;
  workflow_id: string;
  period: number;
  status: string;
  context_data: string | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

interface StepRunRow {
  id: number;
  workflow_run_id: number;
  step_id: string;
  status: string;
  attempts: number;
  github_run_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}
