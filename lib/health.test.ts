import { describe, expect, it } from "vitest";
import {
  fmtMs,
  httpStatusFor,
  readDeploy,
  rollupStatus,
  shortSha,
  type HealthCheck,
} from "./health";

const makeCheck = (
  status: HealthCheck["status"],
  name = "x",
): HealthCheck => ({
  name,
  status,
  latency_ms: 12,
  detail: null,
});

describe("rollupStatus", () => {
  it("ok when every check is ok", () => {
    expect(
      rollupStatus([makeCheck("ok", "a"), makeCheck("ok", "b")]),
    ).toBe("ok");
  });

  it("escalates to down on any down", () => {
    expect(
      rollupStatus([makeCheck("ok"), makeCheck("down"), makeCheck("ok")]),
    ).toBe("down");
  });

  it("degraded > unconfigured > ok in severity", () => {
    expect(
      rollupStatus([makeCheck("ok"), makeCheck("unconfigured")]),
    ).toBe("unconfigured");
    expect(
      rollupStatus([makeCheck("unconfigured"), makeCheck("degraded")]),
    ).toBe("degraded");
  });

  it("returns ok for an empty list", () => {
    expect(rollupStatus([])).toBe("ok");
  });
});

describe("httpStatusFor", () => {
  it("ok and unconfigured map to 200", () => {
    expect(httpStatusFor("ok")).toBe(200);
    expect(httpStatusFor("unconfigured")).toBe(200);
  });

  it("degraded still serves 200 — page is up but a dep is slow", () => {
    expect(httpStatusFor("degraded")).toBe(200);
  });

  it("down returns 503 so uptime monitors fire", () => {
    expect(httpStatusFor("down")).toBe(503);
  });
});

describe("shortSha", () => {
  it("returns the first 7 chars", () => {
    expect(shortSha("abcdef0123456789")).toBe("abcdef0");
  });

  it("passes null through", () => {
    expect(shortSha(null)).toBeNull();
  });
});

describe("readDeploy", () => {
  it("populates commit fields from VERCEL_GIT_* envs", () => {
    const result = readDeploy({
      VERCEL_GIT_COMMIT_SHA: "abcdef0123456789",
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    expect(result.commit_sha).toBe("abcdef0123456789");
    expect(result.commit_short).toBe("abcdef0");
    expect(result.commit_ref).toBe("main");
    expect(result.environment).toBe("production");
  });

  it("falls back to NODE_ENV / local for environment", () => {
    expect(
      readDeploy({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv)
        .environment,
    ).toBe("development");
    expect(
      readDeploy({} as unknown as NodeJS.ProcessEnv).environment,
    ).toBe("local");
  });
});

describe("fmtMs", () => {
  it("rounds and adds the unit", () => {
    expect(fmtMs(143.4)).toBe("143ms");
    expect(fmtMs(143.6)).toBe("144ms");
  });

  it("renders an em-dash for null", () => {
    expect(fmtMs(null)).toBe("—");
  });
});
