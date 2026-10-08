/**
 * The upload engine behind W5 and W6 (docs/mortgage/frontend/00-foundations §7).
 *
 * One queue per page, holding every file of every document row. Each file
 * goes queued → presigning → uploading (with progress) → verifying → ready,
 * or ends in `error` with a code the row turns into copy. Framework-free on
 * purpose: the React hook wraps it, and the unit tests drive it with a fake
 * transport.
 *
 * The rules the rows depend on:
 *   - Up to three files move at once.
 *   - Client checks (type, count, size, the running total) run before a byte
 *     is sent, counting files still uploading. A file that fails them still
 *     gets a line, in error, as W6 shows the oversize licence.
 *   - Replace keeps the old file until the new one is ready; a failed replace
 *     leaves the good file where it was.
 *   - A file the browser gave up on after presigning is deleted on the server
 *     too, so it can't be attached to the application unseen.
 *   - Removing a ready file waits for the server to confirm, for the same
 *     reason: the applicant submits what they see, nothing more.
 */

import { checkFile, DOCUMENT_RULES, mimeFromName, normaliseMime, type DocKind } from "../documents";
import { ApiError, type FileStatus, type Presigned } from "./api";

export type UploadStage =
  | "queued"
  | "presigning"
  | "uploading"
  | "verifying"
  | "ready"
  | "error";

export type UploadErrorCode =
  | "too_large"
  | "total_exceeded"
  | "bad_type"
  | "too_many_files"
  | "encrypted_pdf"
  | "unreadable"
  | "network"
  | "draft_expired"
  | "generic";

export type UploadError = {
  code: UploadErrorCode;
  sizeBytes?: number;
  limitBytes?: number;
  totalBytes?: number;
  limit?: number;
};

export type UploadItem = {
  /** The browser's id for the line; stable across its whole life. */
  localId: string;
  kind: DocKind;
  name: string;
  sizeBytes: number;
  mime: string;
  stage: UploadStage;
  /** Bytes sent so far, while uploading. */
  loaded: number;
  /** The server's id, once presigned. */
  fileId?: string;
  error?: UploadError;
  /** Set on the new files of a replace: the batch that, once ready, retires `replacedBy`. */
  replaceBatch?: string;
  /** Set on the old files a replace will retire. */
  replacedBy?: string;
  /** Server ids of the files a replace retires, sent at presign. */
  replacesFileIds?: string[];
};

export type Transport = {
  presign(file: { kind: DocKind; name: string; size: number; mime: string; replaces?: string[] }): Promise<Presigned>;
  put(presigned: Presigned, file: Blob, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<void>;
  complete(fileId: string): Promise<FileStatus>;
  status(fileId: string): Promise<FileStatus>;
  remove(fileId: string): Promise<void>;
};

export type QueueEvent =
  | { type: "added"; item: UploadItem }
  | { type: "failed"; item: UploadItem }
  | { type: "removed"; item: UploadItem }
  | { type: "draft_expired" };

type Options = {
  transport: Transport;
  onChange: (items: readonly UploadItem[]) => void;
  onEvent?: (event: QueueEvent) => void;
  concurrency?: number;
  /** Delays between status polls (another request still completing the file), in ms; the last repeats. */
  pollDelays?: readonly number[];
  /** Files already on the server (restored after a reload): ready, no bytes held. */
  initial?: readonly UploadItem[];
  newId?: () => string;
  sleep?: (ms: number) => Promise<void>;
};

const IN_FLIGHT: ReadonlySet<UploadStage> = new Set(["queued", "presigning", "uploading", "verifying"]);

export function isInFlight(item: UploadItem): boolean {
  return IN_FLIGHT.has(item.stage);
}

/** The server's and the rules' codes, as the rows know them. */
function errorFrom(e: unknown): UploadError {
  if (e instanceof ApiError) {
    const d = e.details as { sizeBytes?: number; limitBytes?: number; totalBytes?: number; limit?: number };
    switch (e.code) {
      case "too_large":
      case "total_exceeded":
      case "bad_type":
      case "too_many_files":
      case "encrypted_pdf":
      case "unreadable":
      case "network":
      case "draft_expired":
        return { code: e.code, sizeBytes: d.sizeBytes, limitBytes: d.limitBytes, totalBytes: d.totalBytes, limit: d.limit };
      case "upload_missing":
      case "upload_failed":
        return { code: "network" };
      default:
        return { code: "generic" };
    }
  }
  return { code: "generic" };
}

export class UploadQueue {
  private list: UploadItem[];
  private readonly blobs = new Map<string, Blob>();
  private readonly aborts = new Map<string, AbortController>();
  private readonly o: Required<Omit<Options, "initial" | "onEvent">> & Pick<Options, "onEvent">;
  private disposed = false;

  constructor(options: Options) {
    this.o = {
      concurrency: 3,
      pollDelays: [1000, 1500, 2500, 4000, 6000],
      newId: () =>
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `f${Math.random().toString(36).slice(2)}`,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      ...options,
    };
    this.list = [...(options.initial ?? [])];
  }

  items(): readonly UploadItem[] {
    return this.list;
  }

  /** Stop everything (the page is going away); nothing is deleted. */
  dispose(): void {
    this.disposed = true;
    for (const controller of this.aborts.values()) controller.abort();
  }

  /**
   * Add files to a document. `replace` retires the document's current files
   * once every new one is ready (single-file kinds, and the Emirates ID when
   * both sides are in).
   */
  add(kind: DocKind, files: readonly File[], opts: { replace?: boolean } = {}): void {
    const batch = opts.replace ? this.o.newId() : undefined;
    const retiring = batch
      ? this.list.filter((i) => i.kind === kind && i.stage === "ready" && !i.replacedBy)
      : [];
    // What the new files are judged against: the document's live files,
    // minus the ones this replace retires.
    const counted = this.list
      .filter((i) => i.kind === kind && i.stage !== "error" && !retiring.includes(i))
      .map((i) => ({ sizeBytes: i.sizeBytes }));

    const added: UploadItem[] = [];
    for (const file of files) {
      const mime = normaliseMime(file.type) ?? mimeFromName(file.name) ?? file.type ?? "";
      const item: UploadItem = {
        localId: this.o.newId(),
        kind,
        name: file.name,
        sizeBytes: file.size,
        mime,
        stage: "queued",
        loaded: 0,
        replaceBatch: batch,
      };
      const rule = checkFile(kind, { sizeBytes: file.size, mime }, counted);
      if (rule) {
        item.stage = "error";
        item.error =
          rule.code === "too_large"
            ? { code: "too_large", sizeBytes: rule.sizeBytes, limitBytes: rule.limitBytes }
            : rule.code === "total_exceeded"
              ? { code: "total_exceeded", totalBytes: rule.totalBytes, limitBytes: rule.limitBytes }
              : rule.code === "too_many_files"
                ? { code: "too_many_files", limit: rule.limit }
                : { code: "bad_type" };
      } else {
        counted.push({ sizeBytes: file.size });
        this.blobs.set(item.localId, file);
      }
      added.push(item);
    }
    if (batch && added.some((i) => i.stage !== "error")) {
      const ids = retiring.map((i) => i.fileId).filter((id): id is string => !!id);
      for (const item of added) item.replacesFileIds = ids;
      this.list = this.list.map((i) => (retiring.includes(i) ? { ...i, replacedBy: batch } : i));
    }
    this.list = [...this.list, ...added];
    for (const item of added) if (item.stage === "error") this.o.onEvent?.({ type: "failed", item });
    this.changed();
    this.pump();
  }

  /** Stop an upload and forget it, on the server too. */
  cancel(localId: string): void {
    const item = this.find(localId);
    if (!item) return;
    this.aborts.get(localId)?.abort();
    this.drop(item);
    if (item.fileId) void this.o.transport.remove(item.fileId).catch(() => undefined);
  }

  /**
   * The ✕ on a line. A failed line just goes. A ready file goes once the
   * server has deleted it; if that fails the line stays, marked.
   */
  async remove(localId: string): Promise<void> {
    const item = this.find(localId);
    if (!item) return;
    if (isInFlight(item)) return this.cancel(localId);
    if (item.stage === "error" || !item.fileId) {
      this.drop(item);
      return;
    }
    try {
      await this.o.transport.remove(item.fileId);
      this.drop(item);
      this.o.onEvent?.({ type: "removed", item });
    } catch (e) {
      this.patch(localId, { error: errorFrom(e) });
    }
  }

  /** Try a failed file again, when its bytes are still held (network errors). */
  retry(localId: string): void {
    const item = this.find(localId);
    if (!item || item.stage !== "error" || !this.blobs.has(localId)) return;
    this.patch(localId, { stage: "queued", error: undefined, loaded: 0, fileId: undefined });
    this.pump();
  }

  canRetry(localId: string): boolean {
    const item = this.find(localId);
    return !!item && item.stage === "error" && item.error?.code === "network" && this.blobs.has(localId);
  }

  // ── Internals ─────────────────────────────────────────────────

  private find(localId: string): UploadItem | undefined {
    return this.list.find((i) => i.localId === localId);
  }

  private changed(): void {
    if (!this.disposed) this.o.onChange(this.list);
  }

  private patch(localId: string, fields: Partial<UploadItem>): void {
    let hit = false;
    this.list = this.list.map((i) => {
      if (i.localId !== localId) return i;
      hit = true;
      return { ...i, ...fields };
    });
    if (hit) this.changed();
  }

  private drop(item: UploadItem): void {
    this.list = this.list.filter((i) => i.localId !== item.localId);
    this.blobs.delete(item.localId);
    this.aborts.delete(item.localId);
    // A replace whose new files are all gone no longer retires anything.
    if (item.replaceBatch && !this.list.some((i) => i.replaceBatch === item.replaceBatch)) {
      this.list = this.list.map((i) =>
        i.replacedBy === item.replaceBatch ? { ...i, replacedBy: undefined } : i,
      );
    }
    this.settleReplace(item.replaceBatch);
    this.changed();
  }

  private pump(): void {
    const active = this.list.filter((i) => ["presigning", "uploading", "verifying"].includes(i.stage)).length;
    const slots = this.o.concurrency - active;
    if (slots <= 0) return;
    for (const item of this.list.filter((i) => i.stage === "queued").slice(0, slots)) {
      void this.run(item.localId);
    }
  }

  private async run(localId: string): Promise<void> {
    const start = this.find(localId);
    const blob = this.blobs.get(localId);
    if (!start || !blob) return;
    const controller = new AbortController();
    this.aborts.set(localId, controller);
    const gone = () => controller.signal.aborted || !this.find(localId) || this.disposed;

    try {
      this.patch(localId, { stage: "presigning" });
      const presigned = await this.o.transport.presign({
        kind: start.kind,
        name: start.name,
        size: start.sizeBytes,
        mime: start.mime,
        ...(start.replacesFileIds?.length ? { replaces: start.replacesFileIds } : {}),
      });
      if (gone()) {
        void this.o.transport.remove(presigned.fileId).catch(() => undefined);
        return;
      }
      this.patch(localId, { stage: "uploading", fileId: presigned.fileId });

      await this.o.transport.put(
        presigned,
        blob,
        (loaded) => this.patch(localId, { loaded }),
        controller.signal,
      );
      if (gone()) return;
      this.patch(localId, { stage: "verifying", loaded: start.sizeBytes });

      let status = await this.o.transport.complete(presigned.fileId);
      for (let attempt = 0; status.status === "uploading"; attempt++) {
        const delays = this.o.pollDelays;
        await this.o.sleep(delays[Math.min(attempt, delays.length - 1)]!);
        if (gone()) return;
        status = await this.o.transport.status(presigned.fileId);
      }
      if (gone()) return;
      if (status.status === "ready") {
        this.patch(localId, { stage: "ready", sizeBytes: status.sizeBytes, loaded: status.sizeBytes });
        this.blobs.delete(localId);
        const item = this.find(localId);
        if (item) this.o.onEvent?.({ type: "added", item });
        this.settleReplace(item?.replaceBatch);
      } else {
        this.fail(localId, { code: "generic" });
      }
    } catch (e) {
      if (gone()) return;
      const error = errorFrom(e);
      if (error.code === "draft_expired") this.o.onEvent?.({ type: "draft_expired" });
      const item = this.find(localId);
      // Anything the server may still hold as pending goes, so it can't be attached unseen.
      if (item?.fileId) void this.o.transport.remove(item.fileId).catch(() => undefined);
      this.fail(localId, error);
    } finally {
      this.aborts.delete(localId);
      this.pump();
    }
  }

  private fail(localId: string, error: UploadError): void {
    // Keep the bytes only where a retry makes sense.
    if (error.code !== "network") this.blobs.delete(localId);
    this.patch(localId, { stage: "error", error, fileId: undefined });
    const item = this.find(localId);
    if (item) this.o.onEvent?.({ type: "failed", item });
  }

  /** When every remaining file of a replace is ready, retire what it replaces. */
  private settleReplace(batch: string | undefined): void {
    if (!batch) return;
    const members = this.list.filter((i) => i.replaceBatch === batch);
    if (members.length === 0 || members.some((i) => i.stage !== "ready")) return;
    const retiring = this.list.filter((i) => i.replacedBy === batch);
    this.list = this.list
      .filter((i) => i.replacedBy !== batch)
      .map((i) => (i.replaceBatch === batch ? { ...i, replaceBatch: undefined } : i));
    this.changed();
    for (const old of retiring) {
      if (old.fileId) void this.o.transport.remove(old.fileId).catch(() => undefined);
    }
  }
}

// ── What the rows show ───────────────────────────────────────────

export type RowState = "empty" | "uploading" | "added" | "attention";

export type RowView = {
  state: RowState;
  /** Files on the line list, in order; replaced files stay visible until retired. */
  items: readonly UploadItem[];
  readyCount: number;
  /** Bytes counted against a total-limited kind: every live file, uploading included. */
  usedBytes: number;
  /** The first file in error: its message sits under the list. */
  error?: UploadItem;
};

export function rowView(kind: DocKind, all: readonly UploadItem[]): RowView {
  const items = all.filter((i) => i.kind === kind);
  const error = items.find((i) => i.stage === "error");
  const readyCount = items.filter((i) => i.stage === "ready" && !i.replacedBy).length;
  const usedBytes = items
    .filter((i) => i.stage !== "error" && !i.replacedBy)
    .reduce((sum, i) => sum + i.sizeBytes, 0);
  const state: RowState = error
    ? "attention"
    : items.some(isInFlight)
      ? "uploading"
      : readyCount > 0
        ? "added"
        : "empty";
  return { state, items, readyCount, usedBytes, error };
}

/**
 * The row's action once it has files (00-foundations §7.3, with FE-5 settled
 * as: the Emirates ID adds its second side with "Add more files", and offers
 * "Replace" once both are in, as W6 shows).
 */
export function rowAction(kind: DocKind, view: RowView): "upload" | "cancel" | "replace" | "add_more" | "choose_another" {
  if (view.state === "attention") return "choose_another";
  if (view.state === "uploading") return "cancel";
  if (view.state === "empty") return "upload";
  const max = DOCUMENT_RULES[kind].maxFiles;
  if (max === 1) return "replace";
  if (max === 2) return view.readyCount < 2 ? "add_more" : "replace";
  return "add_more";
}

/** Whether a kind takes several files through one picker. */
export function isMultiFile(kind: DocKind): boolean {
  return DOCUMENT_RULES[kind].maxFiles > 1;
}

export type Completion = {
  total: number;
  /** Rows showing "Added": at least one ready file, nothing moving, nothing wrong. */
  ready: number;
  /** Files in error, across rows. */
  attention: number;
  anyFiles: boolean;
  complete: boolean;
};

/** The footer note and the CTA's rule (00-foundations §7.5). Consent is the page's to add. */
export function completion(kinds: readonly DocKind[], all: readonly UploadItem[]): Completion {
  const views = kinds.map((k) => rowView(k, all));
  const ready = views.filter((v) => v.state === "added").length;
  const attention = all.filter((i) => kinds.includes(i.kind) && i.stage === "error").length;
  return {
    total: kinds.length,
    ready,
    attention,
    anyFiles: all.some((i) => kinds.includes(i.kind)),
    complete: ready === kinds.length,
  };
}
