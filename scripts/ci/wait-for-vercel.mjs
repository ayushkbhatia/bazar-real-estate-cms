#!/usr/bin/env node
/**
 * Hold CI's build until no Vercel build is running.
 *
 * WHY
 *
 * Vercel's production build, an opted-in Vercel preview and this workflow's
 * own build all prerender ~1,030 pages against the ONE Supabase project that
 * production serves from. Alone, each of them is fine: on 2026-09-27 a lone
 * production build made ~2,700 requests in about a minute and a lone CI build
 * ~2,100 in ninety seconds, with no 5xx from either. Together they are not.
 * PostgREST has a small connection pool, and two prerenders at once queue on
 * it for longer than a read's 10-second attempt; the retries join the queue.
 *
 * That is how #553's production deploy died. A pull request's CI run had just
 * put three builds through the database at once, and its E2E server was
 * already waiting ten seconds for answers, when at 11:44Z Vercel began
 * prerendering too. Completed requests at the Supabase edge fell from ~3,100 a
 * minute to 256, then 36; 114 of Vercel's reads went unanswered through every
 * retry, and the build aborted. The same commit, redeployed alone at 11:57Z,
 * went live.
 *
 * So CI waits its turn: a merge's run waits for the production build it
 * started, and a pull request's run waits for whatever `main` is deploying.
 *
 * HOW IT KNOWS
 *
 * About two seconds after a push, `vercel[bot]` posts a commit status —
 * context "Vercel", `pending`, "Vercel is deploying your app" — and replaces
 * it with `success` or `failure` when the build ends. A preview that
 * scripts/vercel-ignore-build.sh skips resolves within seconds ("Canceled by
 * Ignored Build Step"). The GitHub Deployment would be the obvious thing to
 * watch and cannot be used: Vercel creates it only once the build is over.
 *
 * FAILS OPEN
 *
 * Always exits 0. This orders builds; it does not gate them. A status that
 * cannot be read, a build still pending after MAX_WAIT_MS, and a `pending`
 * older than Vercel's own 45-minute build limit (so never going to resolve)
 * all end the wait with a warning, and CI builds exactly as it did before
 * this existed.
 *
 *   node scripts/ci/wait-for-vercel.mjs main <sha>   # needs GITHUB_TOKEN and GITHUB_REPOSITORY
 */
import { pathToFileURL } from "node:url";

/**
 * How long to wait before building anyway. A healthy production build takes
 * about two minutes from push to done; the slowest on record, #551's under the
 * load this exists to remove, took nine and a half.
 */
export const MAX_WAIT_MS = 20 * 60_000;

export const POLL_MS = 15_000;

/**
 * Vercel stops a build at 45 minutes. A `pending` older than that belongs to
 * a build that no longer exists and whose status was never resolved.
 */
export const STALE_MS = 45 * 60_000;

/** Consecutive unreadable polls before giving up on the API. */
const MAX_READ_FAILURES = 3;

const VERCEL_BOT = "vercel[bot]";

/**
 * The newest status per Vercel context, from one commit's status list.
 *
 * Vercel resolves a build by posting a NEW status, so a commit carries its
 * whole history — `pending`, `failure`, then `pending` and `success` again
 * after a redeploy — and only the newest says what is happening now. The API
 * returns newest first; this sorts anyway rather than depend on it. Matching
 * on the bot rather than the context keeps it right if Vercel ever names the
 * context per project ("Vercel – <name>").
 */
export function latestVercelStatuses(statuses) {
  const newestFirst = [...statuses].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
  );
  const latest = new Map();
  for (const status of newestFirst) {
    if (status?.creator?.login !== VERCEL_BOT) continue;
    if (!latest.has(status.context)) latest.set(status.context, status);
  }
  return [...latest.values()];
}

/** Whether a status says Vercel is building right now. */
export function isBuilding(status, now, staleMs = STALE_MS) {
  return (
    status.state === "pending" && now - Date.parse(status.created_at) < staleMs
  );
}

/** A status's `url` ends in the commit it belongs to. */
const shortSha = (status) => (status.url ?? "").split("/").pop().slice(0, 7);

function describe({ ref, status }) {
  const sha = shortSha(status);
  if (!sha || ref.startsWith(sha)) return sha || ref;
  return `${ref} (${sha})`;
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60
    ? `${s}s`
    : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** One pass over every ref: what Vercel is doing about each of them. */
async function readBuilds(refs, fetchStatuses) {
  const byId = new Map();
  for (const ref of refs) {
    for (const status of latestVercelStatuses(await fetchStatuses(ref))) {
      // On a push, `main` and the pushed sha are the same commit. Keep the
      // first name it was asked about, which is the more legible one.
      if (!byId.has(status.id)) byId.set(status.id, { ref, status });
    }
  }
  return [...byId.values()];
}

/**
 * Poll until nothing is building, then return. Never throws for anything the
 * API does; the caller decides nothing from the result except what to log.
 *
 * @param {object} options
 * @param {string[]} options.refs  commits or branches to watch
 * @param {(ref: string) => Promise<any[]>} options.fetchStatuses
 * @param {{ info: (m: string) => void, warn: (m: string) => void, notice: (m: string) => void }} options.log
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {number} [options.maxWaitMs]
 * @param {number} [options.pollMs]
 * @param {number} [options.staleMs]
 * @returns {Promise<{ outcome: "idle" | "finished" | "timeout" | "unreadable", waitedMs: number }>}
 */
export async function waitForVercel({
  refs,
  fetchStatuses,
  log,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxWaitMs = MAX_WAIT_MS,
  pollMs = POLL_MS,
  staleMs = STALE_MS,
}) {
  const started = now();
  const elapsed = () => now() - started;
  const unique = [...new Set(refs.filter(Boolean))];
  const warnedStale = new Set();
  let failures = 0;
  let waited = false;
  let lastReport = -Infinity;

  for (;;) {
    let builds;
    try {
      builds = await readBuilds(unique, fetchStatuses);
      failures = 0;
    } catch (err) {
      failures += 1;
      if (failures >= MAX_READ_FAILURES) {
        log.warn(
          `Could not read Vercel's build status (${err?.message ?? err}). Building without waiting.`,
        );
        return { outcome: "unreadable", waitedMs: elapsed() };
      }
      log.info(
        `Could not read Vercel's build status (${err?.message ?? err}); trying again.`,
      );
      await sleep(pollMs);
      continue;
    }

    const at = now();
    for (const build of builds) {
      const { status } = build;
      if (status.state !== "pending" || isBuilding(status, at, staleMs))
        continue;
      if (warnedStale.has(status.id)) continue;
      warnedStale.add(status.id);
      log.warn(
        `Ignoring Vercel's "pending" on ${describe(build)} from ${status.created_at}: ` +
          `older than Vercel's own build limit, so it will never resolve.`,
      );
    }

    const building = builds.filter(({ status }) =>
      isBuilding(status, at, staleMs),
    );

    if (!building.length) {
      if (!waited) {
        log.info("Vercel is not building anything. Building now.");
        return { outcome: "idle", waitedMs: elapsed() };
      }
      const how = builds
        .map(
          (b) =>
            `${describe(b)}: ${b.status.state} — ${b.status.description ?? ""}`,
        )
        .join("; ");
      log.notice(
        `Waited ${formatDuration(elapsed())} for Vercel before prerendering. ${how}`,
      );
      return { outcome: "finished", waitedMs: elapsed() };
    }

    if (elapsed() >= maxWaitMs) {
      log.warn(
        `Vercel is still building ${building.map(describe).join(", ")} after ` +
          `${formatDuration(elapsed())}. Building anyway, so this run's prerender ` +
          `will overlap it.`,
      );
      return { outcome: "timeout", waitedMs: elapsed() };
    }

    // First sighting, then about once a minute: enough to show the step is
    // alive without a line per poll.
    if (!waited || at - lastReport >= 60_000) {
      const what = building
        .map(
          (b) =>
            `${describe(b)} (pending since ${b.status.created_at}${
              b.status.target_url ? `, ${b.status.target_url}` : ""
            })`,
        )
        .join(", ");
      log.info(
        `${waited ? `Still waiting (${formatDuration(elapsed())})` : "Waiting"}: ` +
          `Vercel is building ${what}.`,
      );
      lastReport = at;
    }
    waited = true;
    await sleep(pollMs);
  }
}

/** The GitHub REST call, with the token the workflow gives every job. */
function githubStatuses({ api, repo, token }) {
  return async (ref) => {
    const res = await fetch(
      `${api}/repos/${repo}/commits/${encodeURIComponent(ref)}/statuses?per_page=100`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
          "user-agent": "bazar-ci-wait-for-vercel",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok)
      throw new Error(`GitHub API answered ${res.status} for ${ref}`);
    return res.json();
  };
}

/** Workflow-command annotations, so a wait shows on the run's summary page. */
const actionsLog = {
  info: (message) => console.log(message),
  warn: (message) => console.log(`::warning title=Vercel wait::${message}`),
  notice: (message) => console.log(`::notice title=Vercel wait::${message}`),
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const refs = process.argv.slice(2);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const api = process.env.GITHUB_API_URL ?? "https://api.github.com";

  if (!token || !repo || !refs.length) {
    actionsLog.warn(
      "Not waiting for Vercel: needs GITHUB_TOKEN, GITHUB_REPOSITORY and at least one ref.",
    );
  } else {
    try {
      await waitForVercel({
        refs,
        fetchStatuses: githubStatuses({ api, repo, token }),
        log: actionsLog,
      });
    } catch (err) {
      // A bug in this file must not be what fails a build.
      actionsLog.warn(`Not waiting for Vercel: ${err?.stack ?? err}`);
    }
  }
  process.exit(0);
}
