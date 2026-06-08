import type { IAgentRuntime } from "@elizaos/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleTextLarge } from "../../src/models/text";

function runtime(settings: Record<string, string | undefined>): IAgentRuntime {
  return {
    character: {
      name: "Eliza",
      bio: [],
    },
    emitEvent: vi.fn(),
    getSetting: (key: string) => settings[key],
  } as unknown as IAgentRuntime;
}

describe("Eliza Cloud text model aliases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes native request model aliases and OpenRouter passthrough models", async () => {
    const capturedBodies: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (typeof init?.body === "string") {
        capturedBodies.push(JSON.parse(init.body) as Record<string, unknown>);
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "four" }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    await handleTextLarge(
      runtime({ ELIZAOS_CLOUD_LARGE_MODEL: "openrouter:openai/gpt-oss-120b" }),
      {
        prompt: "what is two plus two?",
        providerOptions: {
          openrouter: {
            models: ["openai/gpt-oss-120b:nitro", "zai-glm-4.7"],
          },
        },
      } as never
    );

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0].model).toBe("gpt-oss-120b");
    expect(capturedBodies[0].models).toEqual(["gpt-oss-120b", "zai-glm-4.7"]);
    expect(capturedBodies[0].providerOptions).toMatchObject({
      openrouter: {
        models: ["gpt-oss-120b", "zai-glm-4.7"],
      },
    });
  });
});
