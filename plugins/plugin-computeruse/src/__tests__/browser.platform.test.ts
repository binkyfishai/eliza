import { describe, expect, it } from "vitest";
import { getBrowserLaunchArgs } from "../platform/browser.js";

describe("getBrowserLaunchArgs", () => {
  it("adds CI-safe Chromium flags for Linux headless launches", () => {
    expect(
      getBrowserLaunchArgs({
        platform: "linux",
        headless: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ]),
    );
  });

  it("keeps non-headless desktop launches on default flags", () => {
    expect(
      getBrowserLaunchArgs({
        platform: "darwin",
        headless: false,
      }),
    ).not.toEqual(
      expect.arrayContaining([
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ]),
    );
  });
});
