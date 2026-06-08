import type { IAgentRuntime } from "@elizaos/core";
import { describe, expect, it } from "vitest";
import {
  getActionPlannerModel,
  getResponseHandlerModel,
  getSmallModel,
  normalizeElizaCloudTextModelName,
} from "../../src/utils/config";

function runtime(settings: Record<string, string | undefined>): IAgentRuntime {
  return {
    getSetting: (key: string) => settings[key],
  } as IAgentRuntime;
}

describe("Eliza Cloud text model config", () => {
  it("normalizes app registry aliases for gpt-oss-120b", () => {
    expect(normalizeElizaCloudTextModelName("openai/gpt-oss-120b")).toBe("gpt-oss-120b");
    expect(normalizeElizaCloudTextModelName("openai/gpt-oss-120b:nitro")).toBe("gpt-oss-120b");
    expect(normalizeElizaCloudTextModelName("openai/gpt-oss-120b:free")).toBe("gpt-oss-120b");
    expect(normalizeElizaCloudTextModelName("openrouter:openai/gpt-oss-120b")).toBe("gpt-oss-120b");
    expect(normalizeElizaCloudTextModelName(" openai/gpt-oss-120b:nitro ")).toBe("gpt-oss-120b");
  });

  it("leaves unrelated provider-style model names intact", () => {
    expect(normalizeElizaCloudTextModelName("openai/gpt-5.1")).toBe("openai/gpt-5.1");
    expect(normalizeElizaCloudTextModelName("zai-glm-4.7")).toBe("zai-glm-4.7");
  });

  it("normalizes configured chat model settings before requests are built", () => {
    const configured = runtime({
      ELIZAOS_CLOUD_SMALL_MODEL: "openrouter:openai/gpt-oss-120b:nitro",
      RESPONSE_HANDLER_MODEL: "openai/gpt-oss-120b",
      ACTION_PLANNER_MODEL: "openai/gpt-oss-120b:free",
    });

    expect(getSmallModel(configured)).toBe("gpt-oss-120b");
    expect(getResponseHandlerModel(configured)).toBe("gpt-oss-120b");
    expect(getActionPlannerModel(configured)).toBe("gpt-oss-120b");
  });
});
