import { describe, expect, it, vi } from "vitest";
import { MB } from "../documents";
import { ApiError, type FileStatus, type Presigned } from "./api";
import {
  completion,
  rowAction,
  rowView,
  UploadQueue,
  type Transport,
  type UploadItem,
} from "./upload-queue";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function file(name: string, sizeBytes: number, type = "application/pdf"): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: sizeBytes });
  return f;
}

/** A transport whose every call waits for the test to settle it. */
function fakeTransport() {
  let n = 0;
  const calls: string[] = [];
  const puts = new Map<string, { d: Deferred<void>; progress: (loaded: number) => void; signal: AbortSignal }>();
  const completes = new Map<string, Deferred<FileStatus>>();
  const statuses: FileStatus[] = [];
  const presigns: { replaces?: string[] }[] = [];
  let presignError: unknown = null;
  let removeError: unknown = null;
  const transport: Transport = {
    async presign(f) {
      presigns.push({ replaces: f.replaces });
      if (presignError) throw presignError;
      const fileId = `srv-${++n}`;
      calls.push(`presign ${f.name} → ${fileId}`);
      return { fileId, uploadUrl: `https://storage.test/${fileId}`, headers: {} } satisfies Presigned;
    },
    put(p, _blob, onProgress, signal) {
      calls.push(`put ${p.fileId}`);
      const d = deferred<void>();
      signal.addEventListener("abort", () => d.reject(new ApiError(0, "cancelled")));
      puts.set(p.fileId, { d, progress: onProgress, signal });
      return d.promise;
    },
    complete(fileId) {
      calls.push(`complete ${fileId}`);
      const d = deferred<FileStatus>();
      completes.set(fileId, d);
      return d.promise;
    },
    async status(fileId) {
      calls.push(`status ${fileId}`);
      return statuses.shift() ?? { status: "scanning" };
    },
    async remove(fileId) {
      calls.push(`remove ${fileId}`);
      if (removeError) throw removeError;
    },
  };
  return {
    transport,
    calls,
    puts,
    completes,
    statuses,
    presigns,
    failPresign: (e: unknown) => (presignError = e),
    failRemove: (e: unknown) => (removeError = e),
  };
}

function queue(t: ReturnType<typeof fakeTransport>, extra: Partial<ConstructorParameters<typeof UploadQueue>[0]> = {}) {
  let snapshot: readonly UploadItem[] = [];
  let id = 0;
  const q = new UploadQueue({
    transport: t.transport,
    onChange: (items) => (snapshot = items),
    newId: () => `local-${++id}`,
    sleep: async () => undefined,
    ...extra,
  });
  return { q, items: () => snapshot };
}

async function finish(t: ReturnType<typeof fakeTransport>, fileId: string, sizeBytes: number) {
  t.puts.get(fileId)!.d.resolve();
  await flush();
  t.completes.get(fileId)!.resolve({ status: "ready", sizeBytes, pageCount: 1 });
  await flush();
}

describe("the upload queue", () => {
  it("takes a file through presign, upload with progress, verify, ready", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("passport.pdf", 3 * MB)]);
    expect(items()[0]!.stage).toBe("presigning");
    await flush();
    expect(items()[0]).toMatchObject({ stage: "uploading", fileId: "srv-1" });

    t.puts.get("srv-1")!.progress(2 * MB);
    expect(items()[0]!.loaded).toBe(2 * MB);

    t.puts.get("srv-1")!.d.resolve();
    await flush();
    expect(items()[0]!.stage).toBe("verifying");

    t.completes.get("srv-1")!.resolve({ status: "ready", sizeBytes: 3 * MB, pageCount: 1 });
    await flush();
    expect(items()[0]!.stage).toBe("ready");
    expect(t.calls).toEqual(["presign passport.pdf → srv-1", "put srv-1", "complete srv-1"]);
  });

  it("keeps showing Uploading while the scan finishes, polling until ready", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    t.statuses.push({ status: "scanning" }, { status: "ready", sizeBytes: MB, pageCount: 1 });
    q.add("passport", [file("p.pdf", MB)]);
    await flush();
    t.puts.get("srv-1")!.d.resolve();
    await flush();
    t.completes.get("srv-1")!.resolve({ status: "scanning" });
    await flush();
    await flush();
    expect(items()[0]!.stage).toBe("ready");
    expect(t.calls.filter((c) => c.startsWith("status"))).toHaveLength(2);
  });

  it("moves at most three files at once", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("bank_statements_12m", [1, 2, 3, 4, 5].map((i) => file(`s${i}.pdf`, MB)));
    await flush();
    expect(items().filter((i) => ["presigning", "uploading", "verifying"].includes(i.stage))).toHaveLength(3);
    expect(items().filter((i) => i.stage === "queued")).toHaveLength(2);

    await finish(t, "srv-1", MB);
    await flush();
    expect(items().filter((i) => i.stage === "queued")).toHaveLength(1);
  });

  it("refuses an oversize licence before sending a byte, and keeps its line", () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("trade_license", [file("trade-license-scan.pdf", Math.round(14.8 * MB))]);
    expect(items()[0]).toMatchObject({
      stage: "error",
      error: { code: "too_large", limitBytes: 10 * MB },
    });
    expect(t.calls).toEqual([]);
  });

  it("refuses a salary certificate that isn't a PDF", () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("salary_certificate", [file("cert.jpg", MB, "image/jpeg")]);
    expect(items()[0]!.error?.code).toBe("bad_type");
  });

  it("counts files still uploading against the statements' total", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("bank_statements_12m", [file("a.pdf", 15 * MB), file("b.pdf", 15 * MB)]);
    await flush();
    q.add("bank_statements_12m", [file("c.pdf", 12 * MB)]);
    const c = items().find((i) => i.name === "c.pdf")!;
    expect(c.error).toMatchObject({ code: "total_exceeded", limitBytes: 40 * MB });
  });

  it("counts earlier files of the same pick against the total", () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("bank_statements_12m", [file("a.pdf", 15 * MB), file("b.pdf", 15 * MB), file("c.pdf", 15 * MB)]);
    expect(items().map((i) => [i.name, i.error?.code ?? null])).toEqual([
      ["a.pdf", null],
      ["b.pdf", null],
      ["c.pdf", "total_exceeded"],
    ]);
  });

  it("cancels an upload and deletes its record on the server", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("p.pdf", 3 * MB)]);
    await flush();
    q.cancel(items()[0]!.localId);
    await flush();
    expect(items()).toEqual([]);
    expect(t.puts.get("srv-1")!.signal.aborted).toBe(true);
    expect(t.calls).toContain("remove srv-1");
  });

  it("replaces a file only once the new one is ready", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("old.pdf", MB)]);
    await flush();
    await finish(t, "srv-1", MB);

    q.add("passport", [file("new.pdf", 2 * MB)], { replace: true });
    await flush();
    expect(t.presigns.at(-1)?.replaces).toEqual(["srv-1"]);
    expect(items().map((i) => i.name)).toEqual(["old.pdf", "new.pdf"]);
    expect(rowView("passport", items()).state).toBe("uploading");

    await finish(t, "srv-2", 2 * MB);
    expect(items().map((i) => i.name)).toEqual(["new.pdf"]);
    expect(t.calls).toContain("remove srv-1");
    expect(rowView("passport", items())).toMatchObject({ state: "added", readyCount: 1 });
  });

  it("keeps the good file when a replace fails", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("good.pdf", MB)]);
    await flush();
    await finish(t, "srv-1", MB);

    q.add("passport", [file("locked.pdf", MB)], { replace: true });
    await flush();
    t.puts.get("srv-2")!.d.resolve();
    await flush();
    t.completes.get("srv-2")!.reject(new ApiError(422, "encrypted_pdf"));
    await flush();
    expect(items().map((i) => [i.name, i.stage])).toEqual([
      ["good.pdf", "ready"],
      ["locked.pdf", "error"],
    ]);
    expect(t.calls).not.toContain("remove srv-1");

    await q.remove(items()[1]!.localId);
    expect(rowView("passport", items())).toMatchObject({ state: "added", readyCount: 1 });
  });

  it("refuses a replacement that breaks the rules without touching the old file", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("salary_certificate", [file("cert.pdf", MB)]);
    await flush();
    await finish(t, "srv-1", MB);
    q.add("salary_certificate", [file("cert.png", MB, "image/png")], { replace: true });
    expect(items()[0]!.replacedBy).toBeUndefined();
    expect(rowView("salary_certificate", items()).state).toBe("attention");
  });

  it("offers a retry after a network error, and clears what the server held", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("p.pdf", MB)]);
    await flush();
    t.puts.get("srv-1")!.d.reject(new ApiError(0, "network"));
    await flush();
    const line = items()[0]!;
    expect(line.error?.code).toBe("network");
    expect(t.calls).toContain("remove srv-1");
    expect(q.canRetry(line.localId)).toBe(true);

    q.retry(line.localId);
    await flush();
    await finish(t, "srv-2", MB);
    expect(items()[0]!.stage).toBe("ready");
  });

  it("removes a ready file only once the server has", async () => {
    const t = fakeTransport();
    const { q, items } = queue(t);
    q.add("passport", [file("p.pdf", MB)]);
    await flush();
    await finish(t, "srv-1", MB);

    t.failRemove(new ApiError(0, "network"));
    await q.remove(items()[0]!.localId);
    expect(items()).toHaveLength(1);
    expect(items()[0]!.error?.code).toBe("network");

    t.failRemove(null);
    await q.remove(items()[0]!.localId);
    expect(items()).toEqual([]);
  });

  it("reports an expired draft", async () => {
    const t = fakeTransport();
    const onEvent = vi.fn();
    const { q } = queue(t, { onEvent });
    t.failPresign(new ApiError(410, "draft_expired"));
    q.add("passport", [file("p.pdf", MB)]);
    await flush();
    expect(onEvent).toHaveBeenCalledWith({ type: "draft_expired" });
  });
});

describe("what the rows and footer show", () => {
  const ready = (kind: UploadItem["kind"], name: string, sizeBytes = MB): UploadItem => ({
    localId: name,
    kind,
    name,
    sizeBytes,
    mime: "application/pdf",
    stage: "ready",
    loaded: sizeBytes,
    fileId: `srv-${name}`,
  });

  // W6 as designed: Emirates ID added (two sides), passport uploading, the
  // licence in error, three statements added.
  const w6: UploadItem[] = [
    ready("emirates_id", "emirates-id-front.jpg"),
    ready("emirates_id", "emirates-id-back.jpg"),
    { ...ready("passport", "passport-photo-page.pdf", Math.round(3.1 * MB)), stage: "uploading", loaded: 2 * MB },
    {
      ...ready("trade_license", "trade-license-scan.pdf", Math.round(14.8 * MB)),
      stage: "error",
      error: { code: "too_large", sizeBytes: Math.round(14.8 * MB), limitBytes: 10 * MB },
    },
    ready("bank_statements_12m", "statement-sep-nov-2025.pdf", Math.round(6.4 * MB)),
    ready("bank_statements_12m", "statement-dec-feb-2026.pdf", Math.round(5.9 * MB)),
    ready("bank_statements_12m", "statement-mar-may-2026.pdf", Math.round(6.1 * MB)),
  ];
  const kinds = ["emirates_id", "passport", "trade_license", "bank_statements_12m"] as const;

  it("gives each row its designed state and action", () => {
    expect([rowView("emirates_id", w6).state, rowAction("emirates_id", rowView("emirates_id", w6))]).toEqual(["added", "replace"]);
    expect([rowView("passport", w6).state, rowAction("passport", rowView("passport", w6))]).toEqual(["uploading", "cancel"]);
    expect([rowView("trade_license", w6).state, rowAction("trade_license", rowView("trade_license", w6))]).toEqual(["attention", "choose_another"]);
    expect([rowView("bank_statements_12m", w6).state, rowAction("bank_statements_12m", rowView("bank_statements_12m", w6))]).toEqual(["added", "add_more"]);
  });

  it("totals the statements as designed: 18.4 of 40 MB", () => {
    expect((rowView("bank_statements_12m", w6).usedBytes / MB).toFixed(1)).toBe("18.4");
  });

  it("lets the Emirates ID add its second side before offering Replace (FE-5)", () => {
    const one = [ready("emirates_id", "front.jpg")];
    expect(rowAction("emirates_id", rowView("emirates_id", one))).toBe("add_more");
  });

  it("reads 2 of 4 ready with 1 file needing attention, and blocks the CTA", () => {
    expect(completion(kinds, w6)).toEqual({ total: 4, ready: 2, attention: 1, anyFiles: true, complete: false });
  });

  it("is complete only when every row is added", () => {
    const done = [
      ready("emirates_id", "id.pdf"),
      ready("passport", "p.pdf"),
      ready("trade_license", "t.pdf"),
      ready("bank_statements_12m", "s.pdf"),
    ];
    expect(completion(kinds, done).complete).toBe(true);
    expect(completion(kinds, []).anyFiles).toBe(false);
  });
});
