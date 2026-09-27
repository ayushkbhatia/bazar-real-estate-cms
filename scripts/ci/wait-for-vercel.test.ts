// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  MAX_WAIT_MS,
  POLL_MS,
  STALE_MS,
  isBuilding,
  latestVercelStatuses,
  waitForVercel,
} from "./wait-for-vercel.mjs";

/**
 * The fixtures are the real status history of 50d32a8b (#553's merge), as the
 * GitHub API returned it: Vercel's build went `pending` at push, `failure` at
 * 11:45:27 when the database stalled, then `pending` and `success` again for
 * the lone redeploy that got it live.
 */
const SHA = "50d32a8bccb126a85b79005ea12099a87493ac9f";

let nextId = 55_024_000_000;
function status(
  state: "pending" | "success" | "failure" | "error",
  createdAt: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: nextId++,
    url: `https://api.github.com/repos/ayushkbhatia/bazar-real-estate-cms/statuses/${SHA}`,
    state,
    description: {
      pending: "Vercel is deploying your app",
      success: "Deployment has completed",
      failure: "Deployment has failed",
      error: "Deployment has errored",
    }[state],
    target_url:
      "https://vercel.com/ayushkbhatia-7383s-projects/bazar-real-estate-cms/x",
    context: "Vercel",
    created_at: createdAt,
    creator: { login: "vercel[bot]" },
    ...extra,
  };
}

const PUSHED = status("pending", "2026-09-27T11:43:06Z");
const FAILED = status("failure", "2026-09-27T11:45:27Z");
const REDEPLOYING = status("pending", "2026-09-27T11:56:00Z");
const REDEPLOYED = status("success", "2026-09-27T11:58:19Z");

/** Newest first, as the API lists them, up to a moment in the history. */
function historyAt(t: number) {
  return [REDEPLOYED, REDEPLOYING, FAILED, PUSHED].filter(
    (s) => Date.parse(s.created_at) <= t,
  );
}

const at = (iso: string) => Date.parse(iso);

/**
 * Drives `waitForVercel` on a fake clock: sleeping advances it, and the
 * statuses a poll sees are whatever `timeline` says was true at that moment.
 */
function harness(
  timeline: (t: number, ref: string) => unknown[] | Error,
  start: number,
) {
  let t = start;
  const calls: string[] = [];
  const logs = {
    info: [] as string[],
    warn: [] as string[],
    notice: [] as string[],
  };
  const run = (
    refs: string[] = ["main"],
    opts: { maxWaitMs?: number; staleMs?: number } = {},
  ) =>
    waitForVercel({
      refs,
      fetchStatuses: async (ref: string) => {
        calls.push(ref);
        const result = timeline(t, ref);
        if (result instanceof Error) throw result;
        return result;
      },
      log: {
        info: (m: string) => logs.info.push(m),
        warn: (m: string) => logs.warn.push(m),
        notice: (m: string) => logs.notice.push(m),
      },
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
      ...opts,
    });
  return { run, calls, logs, elapsed: () => t - start };
}

describe("latestVercelStatuses", () => {
  it("reads the newest status, however the list is ordered", () => {
    const shuffled = [FAILED, PUSHED, REDEPLOYED, REDEPLOYING];
    expect(latestVercelStatuses(shuffled)).toEqual([REDEPLOYED]);
  });

  it("sees a redeploy's pending over the failure before it", () => {
    const latest = latestVercelStatuses(historyAt(at("2026-09-27T11:57:00Z")));
    expect(latest).toEqual([REDEPLOYING]);
    expect(isBuilding(latest[0], at("2026-09-27T11:57:00Z"))).toBe(true);
  });

  it("ignores statuses nobody but vercel[bot] posted", () => {
    const impostor = status("pending", "2026-09-27T12:00:00Z", {
      creator: { login: "someone-else" },
    });
    expect(latestVercelStatuses([impostor, REDEPLOYED])).toEqual([REDEPLOYED]);
  });

  it("keeps one status per Vercel context", () => {
    const other = status("pending", "2026-09-27T12:00:00Z", {
      context: "Vercel – another-project",
    });
    expect(latestVercelStatuses([other, REDEPLOYED])).toEqual([
      other,
      REDEPLOYED,
    ]);
  });
});

describe("isBuilding", () => {
  it("is true only for a pending younger than Vercel's build limit", () => {
    const created = at(PUSHED.created_at);
    expect(isBuilding(PUSHED, created + STALE_MS - 1)).toBe(true);
    expect(isBuilding(PUSHED, created + STALE_MS)).toBe(false);
    expect(isBuilding(FAILED, at(FAILED.created_at))).toBe(false);
    expect(isBuilding(REDEPLOYED, at(REDEPLOYED.created_at))).toBe(false);
  });
});

describe("waitForVercel", () => {
  it("builds at once when Vercel has nothing in flight", async () => {
    const h = harness((t) => historyAt(t), at("2026-09-27T12:05:00Z"));
    await expect(h.run()).resolves.toEqual({ outcome: "idle", waitedMs: 0 });
    expect(h.calls).toEqual(["main"]);
  });

  it("holds the build while Vercel is building, and releases it when the build ends", async () => {
    // CI reaches this step ~35s after the push; Vercel is mid-build.
    const h = harness((t) => historyAt(t), at("2026-09-27T11:43:40Z"));
    const result = await h.run();

    expect(result.outcome).toBe("finished");
    // Released on the first poll after 11:45:27, not before it.
    const released = at("2026-09-27T11:43:40Z") + result.waitedMs;
    expect(released).toBeGreaterThanOrEqual(at(FAILED.created_at));
    expect(released).toBeLessThan(at(FAILED.created_at) + POLL_MS);
    // A failed deploy still ends the wait — and says so.
    expect(h.logs.notice).toHaveLength(1);
    expect(h.logs.notice[0]).toMatch(/failure/);
    expect(h.logs.warn).toEqual([]);
  });

  it("holds a pull request's build while its opted-in preview builds", async () => {
    const head = "4ec78191f171f0bbf97868c44fe1c15b2e91dcac";
    const preview = status("pending", "2026-09-27T11:39:23Z", {
      url: `https://api.github.com/repos/o/r/statuses/${head}`,
    });
    const built = status("success", "2026-09-27T11:41:30Z", {
      url: `https://api.github.com/repos/o/r/statuses/${head}`,
    });
    const h = harness(
      (t, ref) =>
        ref === "main"
          ? [REDEPLOYED]
          : [built, preview].filter((s) => Date.parse(s.created_at) <= t),
      at("2026-09-27T11:40:00Z"),
    );
    const result = await h.run(["main", head]);
    expect(result.outcome).toBe("finished");
    expect(h.elapsed()).toBeGreaterThanOrEqual(90_000);
    // Both refs are read on every poll.
    expect(h.calls.filter((r) => r === "main").length).toBe(
      h.calls.filter((r) => r === head).length,
    );
  });

  it("does not hold a pull request for a preview the ignore step skipped", async () => {
    const head = "4ec78191f171f0bbf97868c44fe1c15b2e91dcac";
    const skipped = [
      status("success", "2026-09-27T11:39:28Z", {
        description: "Canceled by Ignored Build Step",
      }),
      status("pending", "2026-09-27T11:39:23Z"),
    ];
    const h = harness(
      (_t, ref) => (ref === "main" ? [REDEPLOYED] : skipped),
      at("2026-09-27T11:40:10Z"),
    );
    await expect(h.run(["main", head])).resolves.toEqual({
      outcome: "idle",
      waitedMs: 0,
    });
  });

  it("reads each ref once per poll, and names a push's commit once", async () => {
    // On a push, `main` and the pushed sha are the same commit.
    const h = harness((t) => historyAt(t), at("2026-09-27T11:43:40Z"));
    await h.run(["main", SHA, SHA, ""]);
    const polls = h.calls.filter((r) => r === "main").length;
    expect(h.calls.length).toBe(polls * 2);
    expect(h.logs.info[0]).toContain("main (50d32a8)");
    expect(h.logs.info[0].match(/50d32a8/g)).toHaveLength(1);
  });

  it("builds anyway once MAX_WAIT_MS is spent", async () => {
    const stuck = status("pending", "2026-09-27T12:00:00Z");
    const h = harness(() => [stuck], at("2026-09-27T12:00:30Z"));
    const result = await h.run();
    expect(result.outcome).toBe("timeout");
    expect(result.waitedMs).toBeGreaterThanOrEqual(MAX_WAIT_MS);
    expect(result.waitedMs).toBeLessThan(MAX_WAIT_MS + POLL_MS);
    expect(h.logs.warn).toHaveLength(1);
  });

  it("does not wait on a pending older than Vercel's build limit", async () => {
    const orphan = status("pending", "2026-09-27T09:00:00Z");
    const h = harness(() => [orphan], at("2026-09-27T12:00:00Z"));
    await expect(h.run()).resolves.toEqual({ outcome: "idle", waitedMs: 0 });
    expect(h.logs.warn).toHaveLength(1);
    expect(h.logs.warn[0]).toMatch(/never resolve/);
  });

  it("rides out one unreadable poll", async () => {
    let first = true;
    const h = harness((t) => {
      if (first) {
        first = false;
        return new Error("GitHub API answered 502 for main");
      }
      return historyAt(t);
    }, at("2026-09-27T12:05:00Z"));
    const result = await h.run();
    expect(result.outcome).toBe("idle");
    expect(h.elapsed()).toBe(POLL_MS);
  });

  it("gives up on an API it cannot read, and builds", async () => {
    const h = harness(
      () => new Error("GitHub API answered 403 for main"),
      at("2026-09-27T12:05:00Z"),
    );
    const result = await h.run();
    expect(result.outcome).toBe("unreadable");
    expect(h.calls.length).toBe(3);
    expect(h.logs.warn).toHaveLength(1);
    expect(h.logs.warn[0]).toMatch(/403/);
  });
});
