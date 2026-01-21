import type { Context as ContextInterface } from './types.js';

export class Context implements ContextInterface {
  workflowId: string;
  runId: number;
  period: number;
  stepId?: string;

  private store: Map<string, unknown> = new Map();
  private balanceSnapshots: Map<string, bigint> = new Map();

  constructor(params: { workflowId: string; runId: number; period: number }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.period = params.period;
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  snapshotBalance(key: string, balance: bigint): void {
    this.balanceSnapshots.set(key, balance);
  }

  getSnapshotBalance(key: string): bigint | undefined {
    return this.balanceSnapshots.get(key);
  }

  setStep(stepId: string): void {
    this.stepId = stepId;
  }

  toJSON() {
    return {
      workflowId: this.workflowId,
      runId: this.runId,
      period: this.period,
      stepId: this.stepId,
      store: Object.fromEntries(this.store),
    };
  }
}
