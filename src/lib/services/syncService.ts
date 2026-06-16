import { syncSimpleFin as performSimpleFinSync } from "../simplefin";
import { processAmazonCsv as performAmazonSync } from "../external-orders";
import { randomUUID } from "crypto";
import { isMockMode, getMockSimpleFinSync } from "./mockService";

export interface SyncTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
}

const activeTasks = new Map<string, SyncTask>();

export function getSyncTaskStatus(taskId: string): SyncTask | undefined {
  return activeTasks.get(taskId);
}

export function startSyncSimpleFinTask(): string {
  const taskId = randomUUID();
  const task: SyncTask = {
    id: taskId,
    status: "pending",
    progress: 0,
    createdAt: new Date()
  };
  activeTasks.set(taskId, task);

  // Trigger sync asynchronously in the background
  (async () => {
    task.status = "running";
    task.progress = 15;
    try {
      let result;
      if (isMockMode()) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate latency
        result = getMockSimpleFinSync();
      } else {
        result = await performSimpleFinSync();
      }
      task.status = "completed";
      task.progress = 100;
      task.result = result;
    } catch (error) {
      task.status = "failed";
      task.progress = 100;
      task.error = error instanceof Error ? error.message : String(error);
    }
  })();

  return taskId;
}

export async function syncSimpleFin() {
  return performSimpleFinSync();
}

export async function syncAmazon(csvContent: string) {
  return performAmazonSync(csvContent);
}
