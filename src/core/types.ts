import type { Abi, Address } from 'viem';

// ============ WORKFLOW DEFINITION ============

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  schedule?: CronSchedule;
  steps: StepDefinition[];
  config?: WorkflowConfig;
}

export interface WorkflowConfig {
  timeout?: number;
  notifyOn?: NotifyEvent[];
}

export type NotifyEvent = 'start' | 'success' | 'failure' | 'retry';

export interface CronSchedule {
  cron: string;
  timezone?: string;
}

export interface StepDefinition {
  id: string;
  name: string;
  dependsOn?: string[];
  trigger: TriggerConfig;
  check: CheckerConfig | CheckerConfig[];
  retry?: RetryConfig;
  config?: StepConfig;
}

export interface StepConfig {
  timeout?: number;
  continueOnFail?: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs?: number;
  backoff?: 'linear' | 'exponential';
}

// ============ TRIGGERS ============

export type TriggerConfig =
  | GitHubDispatchTrigger
  | WebhookTrigger
  | ManualTrigger
  | NoopTrigger;

export interface GitHubDispatchTrigger {
  type: 'github-dispatch';
  repo: string;
  event: string;
  payload?: Record<string, unknown>;
}

export interface WebhookTrigger {
  type: 'webhook';
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface ManualTrigger {
  type: 'manual';
  prompt: string;
}

export interface NoopTrigger {
  type: 'noop'; // For steps that just check state
}

// ============ CHECKERS ============

export type CheckerConfig =
  | OnchainChecker
  | GitHubFileChecker
  | BalanceChecker
  | ApiChecker
  | CustomChecker;

export interface OnchainChecker {
  type: 'onchain';
  chain: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: unknown[];
  expect: unknown | ((result: unknown, ctx: Context) => boolean);
}

export interface GitHubFileChecker {
  type: 'github-file';
  repo: string;
  path: string | ((ctx: Context) => string);
  branch?: string;
  contentCheck?: (content: unknown, ctx: Context) => boolean;
}

export interface BalanceChecker {
  type: 'balance';
  chain: number;
  token: Address;
  address: Address | ((ctx: Context) => Address);
  minBalance?: bigint;
  changed?: 'increased' | 'decreased';
}

export interface ApiChecker {
  type: 'api';
  url: string | ((ctx: Context) => string);
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  expect: (response: unknown, ctx: Context) => boolean;
}

export interface CustomChecker {
  type: 'custom';
  name: string;
  fn: (ctx: Context) => Promise<boolean>;
}

// ============ RUNTIME STATE ============

export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowRun {
  id: number;
  workflowId: string;
  period: number;
  status: WorkflowRunStatus;
  steps: Record<string, StepRun>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface StepRun {
  stepId: string;
  status: StepStatus;
  attempts: number;
  githubRunId?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ============ CONTEXT ============
// Note: Context interface - implementation in context.ts

export interface Context {
  workflowId: string;
  runId: number;
  period: number;
  stepId?: string;

  // Key-value store for passing data between steps
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;

  // Snapshot balances for 'changed' checks
  snapshotBalance(key: string, balance: bigint): void;
  getSnapshotBalance(key: string): bigint | undefined;
}

// ============ HELPERS ============

export function defineWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  return workflow;
}

export function getCurrentPeriod(): number {
  const WEEK = 604800;
  const now = Math.floor(Date.now() / 1000);
  return Math.floor(now / WEEK) * WEEK;
}
