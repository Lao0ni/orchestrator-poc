import { spectraWorkflow } from './spectra.js';
import type { WorkflowDefinition } from '../core/types.js';

export const workflows: Record<string, WorkflowDefinition> = {
  [spectraWorkflow.id]: spectraWorkflow,
};

export { spectraWorkflow };

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows[id];
}

export function listWorkflows(): WorkflowDefinition[] {
  return Object.values(workflows);
}
