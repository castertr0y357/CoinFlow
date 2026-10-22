import { syncSimpleFin as performSimpleFinSync } from "../simplefin";
import { processAmazonCsv as performAmazonSync } from "../external-orders";
import { randomUUID } from "crypto";
import { isMockMode, getMockSimpleFinSync } from "./mockService";
import { logger } from "../logger";

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

  logger.info("SyncService", `Enqueued SimpleFIN sync task ${taskId}`, {
    action: "sync.simplefin.enqueue",
    context: { taskId },
  });

  // Trigger sync asynchronously in the background
  (async () => {
    task.status = "running";
    task.progress = 15;
    const startTime = Date.now();
    logger.info("SyncService", `Started SimpleFIN sync task ${taskId}`, {
      action: "sync.simplefin.start",
      context: { taskId, isMock: isMockMode() },
    });

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
      const durationMs = Date.now() - startTime;
      logger.info("SyncService", `Completed SimpleFIN sync task ${taskId} in ${durationMs}ms`, {
        action: "sync.simplefin.complete",
        context: {
          taskId,
          durationMs,
          accountsCount: result.accountCount,
          transactionsCount: result.transactionCount,
        },
      });
    } catch (error) {
      task.status = "failed";
      task.progress = 100;
      task.error = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;
      logger.error("SyncService", `Failed SimpleFIN sync task ${taskId} after ${durationMs}ms`, error, {
        action: "sync.simplefin.error",
        context: { taskId, durationMs },
      });
    }
  })();

  return taskId;
}

export async function syncSimpleFin() {
  const startTime = Date.now();
  logger.info("SyncService", "Direct SimpleFIN sync initiated", { action: "sync.simplefin.direct" });
  try {
    const result = await performSimpleFinSync();
    logger.info("SyncService", `Direct SimpleFIN sync completed in ${Date.now() - startTime}ms`, {
      action: "sync.simplefin.direct",
      context: { durationMs: Date.now() - startTime },
    });
    return result;
  } catch (error) {
    logger.error("SyncService", `Direct SimpleFIN sync failed after ${Date.now() - startTime}ms`, error, {
      action: "sync.simplefin.direct",
      context: { durationMs: Date.now() - startTime },
    });
    throw error;
  }
}

export async function syncAmazon(csvContent: string) {
  const startTime = Date.now();
  logger.info("SyncService", "Amazon CSV import initiated", {
    action: "sync.amazon.direct",
    context: { byteLength: csvContent.length },
  });
  try {
    const result = await performAmazonSync(csvContent);
    logger.info("SyncService", `Amazon CSV import completed in ${Date.now() - startTime}ms`, {
      action: "sync.amazon.direct",
      context: { durationMs: Date.now() - startTime },
    });
    return result;
  } catch (error) {
    logger.error("SyncService", `Amazon CSV import failed after ${Date.now() - startTime}ms`, error, {
      action: "sync.amazon.direct",
      context: { durationMs: Date.now() - startTime },
    });
    throw error;
  }
}
