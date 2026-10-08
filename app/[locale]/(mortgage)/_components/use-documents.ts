"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOCUMENT_RULES, type DocKind } from "@/lib/mortgage-requests/documents";
import { sizeBucket } from "@/lib/mortgage-requests/format";
import {
  createDraft,
  deleteFile,
  fileStatus,
  presignFile,
  putFile,
  completeFile,
  type DraftHandle,
} from "@/lib/mortgage-requests/client/api";
import type { ApplyState, StoredFile } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { isInFlight, UploadQueue, type QueueEvent, type UploadItem } from "@/lib/mortgage-requests/client/upload-queue";

type Update = (fn: (s: ApplyState) => ApplyState) => void;

export type DraftStatus = "loading" | "ready" | "failed";

/** Which draft the queue was built for, once it has been. */
type Built = { draftId: string } | null;

function stored(items: readonly UploadItem[]): Partial<Record<DocKind, StoredFile[]>> {
  const out: Partial<Record<DocKind, StoredFile[]>> = {};
  for (const i of items) {
    if (i.stage !== "ready" || !i.fileId || i.replacedBy) continue;
    (out[i.kind] ??= []).push({ localId: i.localId, fileId: i.fileId, name: i.name, sizeBytes: i.sizeBytes, mime: i.mime });
  }
  return out;
}

function restored(files: ApplyState["files"], kinds: readonly DocKind[]): UploadItem[] {
  return kinds.flatMap((kind) =>
    (files[kind] ?? []).map((f) => ({
      localId: f.localId,
      kind,
      name: f.name,
      sizeBytes: f.sizeBytes,
      mime: f.mime,
      stage: "ready" as const,
      loaded: f.sizeBytes,
      fileId: f.fileId,
    })),
  );
}

type PickMode = "add" | "replace" | "choose_another";

function pickInto(q: UploadQueue, kind: DocKind, files: File[], mode: PickMode) {
  if (mode === "choose_another") {
    const failed = q.items().filter((i) => i.kind === kind && i.stage === "error");
    for (const f of failed) void q.remove(f.localId);
    // Once the failed line is gone the row is as before: a full
    // single-file document (or both ID sides) replaces, anything else adds.
    const max = DOCUMENT_RULES[kind].maxFiles;
    const ready = q.items().filter((i) => i.kind === kind && i.stage === "ready" && !i.replacedBy);
    q.add(kind, files, { replace: max <= 2 && ready.length >= max });
    return;
  }
  q.add(kind, files, { replace: mode === "replace" });
}

/**
 * The documents step's uploads: its draft (made on arrival, restored after a
 * reload, replaced when it expires), the queue that moves the files, and what
 * the tab remembers of them.
 */
export function useDocuments(state: ApplyState | null, update: Update, kinds: readonly DocKind[]) {
  const [failed, setFailed] = useState(false);
  const [built, setBuilt] = useState<Built>(null);
  const [expired, setExpired] = useState(false);
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const [announcement, setAnnouncement] = useState<{ type: QueueEvent["type"]; item?: UploadItem } | null>(null);
  const queue = useRef<UploadQueue | null>(null);
  // Files picked while the draft is still being made: they go in once it is,
  // rather than being dropped (a quick picker, or a slow network).
  const waiting = useRef<{ kind: DocKind; files: File[]; mode: PickMode }[]>([]);
  const draftRef = useRef<DraftHandle | null>(null);
  const starting = useRef(false);
  const kindsKey = kinds.join(",");

  const renewDraft = useCallback(
    async (reason: "new" | "expired") => {
      try {
        const draft = await createDraft();
        update((s) => ({ ...s, draft, files: {} }));
        if (reason === "expired") setExpired(true);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [update],
  );

  // Arrive: use the tab's draft if it's still alive, otherwise make one.
  const draft = state?.draft;
  useEffect(() => {
    if (!state || starting.current) return;
    if (draft && new Date(draft.expiresAt).getTime() > Date.now()) return;
    starting.current = true;
    const expiredDraft = !!draft;
    createDraft()
      .then(
        (fresh) => {
          update((s) => ({ ...s, draft: fresh, files: {} }));
          if (expiredDraft) setExpired(true);
          setFailed(false);
        },
        () => setFailed(true),
      )
      .finally(() => {
        starting.current = false;
      });
  }, [state, draft, update]);

  // A queue per draft, seeded with the files the tab remembers — each checked
  // with the server first, so a file deleted or expired elsewhere doesn't
  // come back as ready.
  const draftId = draft?.draftId;
  useEffect(() => {
    if (!state || !draft || new Date(draft.expiresAt).getTime() <= Date.now()) return;
    draftRef.current = draft;
    let cancelled = false;
    let made: UploadQueue | null = null;

    (async () => {
      const remembered = restored(state.files, kinds);
      const checks = await Promise.all(
        remembered.map(async (i) => {
          try {
            const s = await fileStatus(draft, i.fileId!);
            return s.status === "ready" ? i : null;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      queue.current?.dispose();
      const q = new UploadQueue({
        transport: {
          presign: (f) => presignFile(draft, f),
          put: (p, blob, onProgress, signal) => putFile(p, blob, (loaded) => onProgress(loaded), signal),
          complete: (id) => completeFile(draft, id),
          status: (id) => fileStatus(draft, id),
          remove: (id) => deleteFile(draft, id),
        },
        initial: checks.filter((i): i is UploadItem => !!i),
        onChange: (next) => setItems(next),
        onEvent: (event) => {
          setAnnouncement({ type: event.type, item: "item" in event ? event.item : undefined });
          if (event.type === "added") {
            trackMortgage("mortgage_doc_file_added", {
              kind: event.item.kind,
              mime: event.item.mime,
              size_bucket: sizeBucket(event.item.sizeBytes),
            });
          } else if (event.type === "failed") {
            trackMortgage("mortgage_doc_file_rejected", {
              kind: event.item.kind,
              code: event.item.error?.code ?? "generic",
            });
          } else if (event.type === "draft_expired") {
            void renewDraft("expired");
          }
        },
      });
      made = q;
      queue.current = q;
      for (const p of waiting.current.splice(0)) pickInto(q, p.kind, p.files, p.mode);
      setItems(q.items());
      setBuilt({ draftId: draft.draftId });
    })();

    // A new draft, a new employment type, or leaving the page: this queue is done.
    return () => {
      cancelled = true;
      made?.dispose();
      if (queue.current === made) queue.current = null;
    };
    // `state.files` is read once per draft, on purpose: afterwards the queue owns them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, kindsKey]);

  const draftStatus: DraftStatus = failed
    ? "failed"
    : draft && built?.draftId === draft.draftId
      ? "ready"
      : "loading";

  // What the tab remembers: the ready files, so a reload brings them back.
  useEffect(() => {
    if (draftStatus !== "ready") return;
    const files = stored(items);
    update((s) => (JSON.stringify(s.files) === JSON.stringify(files) ? s : { ...s, files }));
  }, [items, draftStatus, update]);

  // Leaving mid-upload asks first (W5 "Behaviour").
  const moving = items.some(isInFlight);
  useEffect(() => {
    if (!moving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [moving]);

  const actions = useMemo(
    () => ({
      pick(kind: DocKind, files: File[], mode: PickMode) {
        const q = queue.current;
        if (q) pickInto(q, kind, files, mode);
        else waiting.current.push({ kind, files, mode });
      },
      cancel: (localId: string) => queue.current?.cancel(localId),
      remove: (localId: string) => void queue.current?.remove(localId),
      retry: (localId: string) => queue.current?.retry(localId),
      canRetry: (localId: string) => queue.current?.canRetry(localId) ?? false,
      /** Re-check every ready file with the server (after files_not_ready). */
      async recheck() {
        const d = draftRef.current;
        const q = queue.current;
        if (!d || !q) return;
        for (const item of q.items()) {
          if (item.stage !== "ready" || !item.fileId) continue;
          try {
            const s = await fileStatus(d, item.fileId);
            if (s.status !== "ready") await q.remove(item.localId);
          } catch {
            // Leave it; the next submit will say.
          }
        }
      },
      renew: () => {
        setFailed(false);
        return renewDraft("new");
      },
    }),
    [renewDraft],
  );

  return { draftStatus, expired, items, announcement, actions, draft: draft ?? null };
}
