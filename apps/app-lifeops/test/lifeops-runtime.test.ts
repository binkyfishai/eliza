import type { IAgentRuntime, UUID } from "@elizaos/core";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lifeops/app-state.js", () => ({
  loadLifeOpsAppState: vi.fn(async () => ({ enabled: true })),
}));

vi.mock("../src/lifeops/service.js", () => ({
  LifeOpsService: class LifeOpsService {},
}));

describe("life-ops runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("retries transient task-table startup failures before creating the scheduler task", async () => {
    vi.useFakeTimers();
    const { ensureLifeOpsSchedulerTask } = await import("../src/lifeops/runtime.js");

    const createdTaskId = "lifeops-scheduler-task" as UUID;
    const agentId = "lifeops-runtime-agent" as UUID;
    let getTasksCallCount = 0;

    const runtime = {
      agentId,
      getService: vi.fn(() => null),
      updateTask: vi.fn(),
      createTask: vi.fn(async () => createdTaskId),
      getTasks: vi.fn(async () => {
        getTasksCallCount += 1;
        if (getTasksCallCount <= 11) {
          throw new Error('relation "tasks" does not exist');
        }
        return [];
      }),
    } as unknown as IAgentRuntime;

    const taskIdPromise = ensureLifeOpsSchedulerTask(runtime);
    await vi.runAllTimersAsync();

    await expect(taskIdPromise).resolves.toBe(createdTaskId);
    expect(runtime.getTasks).toHaveBeenCalledTimes(13);
    expect(runtime.createTask).toHaveBeenCalledTimes(1);
    expect(runtime.updateTask).not.toHaveBeenCalled();
  });

  it("reruns plugin migrations when the tasks table is still missing after init", async () => {
    const { ensureLifeOpsSchedulerTask } = await import("../src/lifeops/runtime.js");

    const createdTaskId = "lifeops-scheduler-task" as UUID;
    const agentId = "lifeops-runtime-agent" as UUID;
    let tasksTableReady = false;

    const runtime = {
      agentId,
      getService: vi.fn(() => null),
      updateTask: vi.fn(),
      createTask: vi.fn(async () => createdTaskId),
      runPluginMigrations: vi.fn(async () => {
        tasksTableReady = true;
      }),
      getTasks: vi.fn(async () => {
        if (!tasksTableReady) {
          const error = new Error('relation "tasks" does not exist');
          Object.assign(error, {
            cause: {
              code: "42P01",
              query: 'select * from "tasks"',
            },
          });
          throw error;
        }
        return [];
      }),
    } as unknown as IAgentRuntime;

    await expect(ensureLifeOpsSchedulerTask(runtime)).resolves.toBe(createdTaskId);
    expect(runtime.runPluginMigrations).toHaveBeenCalledTimes(1);
    expect(runtime.getTasks).toHaveBeenCalledTimes(3);
    expect(runtime.createTask).toHaveBeenCalledTimes(1);
  });
});
