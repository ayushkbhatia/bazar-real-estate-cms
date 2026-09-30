/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { scannerFromEnv } from "./deps";

const base = {
  MORTGAGE_SCANNER: undefined,
  MORTGAGE_CLAMD_HOST: undefined,
  MORTGAGE_CLAMD_PORT: undefined,
  NODE_ENV: "production" as const,
  VERCEL_ENV: undefined,
};

describe("which scanner runs (decision D6)", () => {
  it("uses a configured ClamAV daemon anywhere, production included", () => {
    const scanner = scannerFromEnv({ ...base, MORTGAGE_SCANNER: "clamd", MORTGAGE_CLAMD_HOST: "clamav.internal", VERCEL_ENV: "production" });
    expect(scanner?.name).toBe("clamd");
  });

  it("fails closed on the production deployment without one, even if dev is asked for", () => {
    expect(scannerFromEnv({ ...base, VERCEL_ENV: "production" })).toBeNull();
    expect(scannerFromEnv({ ...base, VERCEL_ENV: "production", MORTGAGE_SCANNER: "dev" })).toBeNull();
    expect(scannerFromEnv({ ...base })).toBeNull();
  });

  it("allows the dev scanner locally, and off Vercel when asked for", () => {
    expect(scannerFromEnv({ ...base, NODE_ENV: "development" })?.name).toBe("dev");
    expect(scannerFromEnv({ ...base, MORTGAGE_SCANNER: "dev" })?.name).toBe("dev");
  });

  it("refuses it on a Preview deployment, which reads the production database (SR-24)", () => {
    expect(scannerFromEnv({ ...base, VERCEL_ENV: "preview", MORTGAGE_SCANNER: "dev" })).toBeNull();
    expect(scannerFromEnv({ ...base, VERCEL_ENV: "preview" })).toBeNull();
    // A configured daemon still runs there.
    expect(scannerFromEnv({ ...base, VERCEL_ENV: "preview", MORTGAGE_SCANNER: "clamd", MORTGAGE_CLAMD_HOST: "clamav.internal" })?.name).toBe("clamd");
  });
});
