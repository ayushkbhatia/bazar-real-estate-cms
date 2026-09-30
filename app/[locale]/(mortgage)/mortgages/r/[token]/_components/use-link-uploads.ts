"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import { sizeBucket } from "@/lib/mortgage-requests/format";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { linkTransport } from "@/lib/mortgage-requests/client/link-api";
import { isInFlight, UploadQueue, type QueueEvent, type UploadItem } from "@/lib/mortgage-requests/client/upload-queue";
import { docKey } from "../../../../_components/documents";

export type ReadyFile = { fileId: string; name: string; sizeBytes: number; mime: string; kind: DocKind };

/**
 * A secure link's uploads (W8, the invite): the W5/W6 engine, pointed at the
 * link's own endpoints. The session cookie is the authority, so there's no
 * draft to make here — the server makes the link's draft at the first upload —
 * and a reload is restored from what the server already holds.
 */
export function useLinkUploads(token: string, ready: readonly ReadyFile[]) {
  const [items, setItems] = useState<readonly UploadItem[]>(() =>
    ready.map((f) => ({ localId: f.fileId, kind: f.kind, name: f.name, sizeBytes: f.sizeBytes, mime: f.mime, stage: "ready", loaded: f.sizeBytes, fileId: f.fileId })),
  );
  const [announcement, setAnnouncement] = useState<{ type: QueueEvent["type"]; item?: UploadItem } | null>(null);
  const queue = useRef<UploadQueue | null>(null);

  useEffect(() => {
    const q = new UploadQueue({
      transport: linkTransport(token),
      initial: ready.map((f) => ({
        localId: f.fileId,
        kind: f.kind,
        name: f.name,
        sizeBytes: f.sizeBytes,
        mime: f.mime,
        stage: "ready" as const,
        loaded: f.sizeBytes,
        fileId: f.fileId,
      })),
      onChange: (next) => setItems(next),
      onEvent: (event) => {
        setAnnouncement({ type: event.type, item: "item" in event ? event.item : undefined });
        if (event.type === "added") {
          trackMortgage("mortgage_doc_file_added", { kind: event.item.kind, mime: event.item.mime, size_bucket: sizeBucket(event.item.sizeBytes) });
        } else if (event.type === "failed") {
          trackMortgage("mortgage_doc_file_rejected", { kind: event.item.kind, code: event.item.error?.code ?? "generic" });
        }
      },
    });
    queue.current = q;
    return () => {
      q.dispose();
      if (queue.current === q) queue.current = null;
    };
    // The server's list seeds the queue once; afterwards the queue owns the files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Leaving mid-upload asks first, as on W5/W6.
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
      pick(kind: DocKind, files: File[], mode: "add" | "replace" | "choose_another") {
        const q = queue.current;
        if (!q) return;
        if (mode === "choose_another") {
          for (const f of q.items().filter((i) => i.kind === kind && i.stage === "error")) void q.remove(f.localId);
          q.add(kind, files, { replace: false });
          return;
        }
        q.add(kind, files, { replace: mode === "replace" });
      },
      cancel: (localId: string) => queue.current?.cancel(localId),
      remove: (localId: string) => void queue.current?.remove(localId),
      retry: (localId: string) => queue.current?.retry(localId),
      canRetry: (localId: string) => queue.current?.canRetry(localId) ?? false,
    }),
    [],
  );

  return { items, announcement, actions };
}

/** The upload rows' live region: files added, removed and refused (00-foundations §11). */
export function useUploadAnnouncement(announcement: { type: QueueEvent["type"]; item?: UploadItem } | null): string {
  const t = useTranslations("mortgage");
  return useMemo(() => {
    const item = announcement?.item;
    if (!item) return "";
    const document = t(`doc.${docKey(item.kind)}.name`);
    if (announcement.type === "added") return t("upload.announce.added", { name: item.name, document });
    if (announcement.type === "removed") return t("upload.announce.removed", { name: item.name });
    if (announcement.type === "failed") return t("upload.announce.failed", { name: item.name, document });
    return "";
  }, [announcement, t]);
}
