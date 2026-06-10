import type { AgentRuntime } from "@elizaos/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthChecker } from "./health.ts";
import { DefaultRuntimeOperationManager } from "./manager.ts";
import type {
  OperationPhase,
  RuntimeOperation,
  RuntimeOperationListOptions,
  RuntimeOperationRepository,
} from "./types.ts";

class MemoryOperationRepository implements RuntimeOperationRepository {
  private readonly ops = new Map<string, RuntimeOperation>();

  async create(op: RuntimeOperation): Promise<void> {
    this.ops.set(op.id, structuredClone(op));
  }

  async update(
    id: string,
    patch: Partial<Omit<RuntimeOperation, "id" | "phases" | "intent" | "kind">>,
  ): Promise<void> {
    const op = this.ops.get(id);
    if (!op) return;
    this.ops.set(id, { ...op, ...patch });
  }

  async appendPhase(id: string, phase: OperationPhase): Promise<void> {
    const op = this.ops.get(id);
    if (!op) return;
    this.ops.set(id, { ...op, phases: [...op.phases, phase] });
  }

  async updateLastPhase(
    id: string,
    patch: Partial<OperationPhase>,
  ): Promise<void> {
    const op = this.ops.get(id);
    if (!op || op.phases.length === 0) return;
    const phases = [...op.phases];
    phases[phases.length - 1] = { ...phases[phases.length - 1], ...patch };
    this.ops.set(id, { ...op, phases });
  }

  async get(id: string): Promise<RuntimeOperation | null> {
    return this.ops.get(id) ?? null;
  }

  async list(opts?: RuntimeOperationListOptions): Promise<RuntimeOperation[]> {
    let values = [...this.ops.values()];
    if (opts?.status) {
      values = values.filter((op) => op.status === opts.status);
    }
    return values.slice(0, opts?.limit ?? values.length);
  }

  async findByIdempotencyKey(key: string): Promise<RuntimeOperation | null> {
    return (
      [...this.ops.values()].find((op) => op.idempotencyKey === key) ?? null
    );
  }

  async findActive(): Promise<RuntimeOperation | null> {
    return (
      [...this.ops.values()].find(
        (op) => op.status === "pending" || op.status === "running",
      ) ?? null
    );
  }
}

async function waitForTerminal(
  repo: MemoryOperationRepository,
  id: string,
): Promise<RuntimeOperation> {
  for (let i = 0; i < 20; i += 1) {
    const op = await repo.get(id);
    if (op && op.status !== "pending" && op.status !== "running") return op;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const op = await repo.get(id);
  if (!op) throw new Error("operation was not persisted");
  return op;
}

describe("DefaultRuntimeOperationManager", () => {
  let runtime: AgentRuntime;
  let healthChecker: HealthChecker;

  beforeEach(() => {
    runtime = {} as AgentRuntime;
    healthChecker = new HealthChecker();
    vi.spyOn(healthChecker, "runForRuntime");
  });

  it("upgrades warm operations to cold when no warm strategy is registered", async () => {
    const repo = new MemoryOperationRepository();
    const coldApply = vi.fn(async () => runtime);
    const manager = new DefaultRuntimeOperationManager({
      repository: repo,
      runtime: () => runtime,
      classifyContext: () => ({ currentProvider: "openai" }),
      classifier: () => "warm",
      healthChecker,
      strategies: {
        cold: {
          tier: "cold",
          apply: coldApply,
        },
      },
    });

    const outcome = await manager.start({
      intent: { kind: "provider-switch", provider: "grok-build-subscription" },
    });

    expect(outcome.kind).toBe("accepted");
    if (outcome.kind !== "accepted") {
      throw new Error(`expected accepted outcome, got ${outcome.kind}`);
    }
    const op = await waitForTerminal(repo, outcome.operation.id);

    expect(op.status).toBe("succeeded");
    expect(coldApply).toHaveBeenCalledTimes(1);
    expect(healthChecker.runForRuntime).toHaveBeenCalledWith(runtime);
  });
});
