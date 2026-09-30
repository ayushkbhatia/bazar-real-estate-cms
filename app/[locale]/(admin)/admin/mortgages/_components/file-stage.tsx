"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { FileCache } from "./file-cache";

/**
 * The viewer's stage (C3/C4): one file, drawn on the page's grey, a page at a
 * time down the column. PDFs render with pdf.js in the browser; images as
 * they are. Zoom and rotation are the toolbar's.
 *
 * Every file is fetched once per visit, through the logged file route — each
 * fetch writes `document.viewed` before a byte is sent (SPEC §8), so nothing
 * here prefetches or refetches (cms/00-foundations §8).
 *
 * Browser only: the viewer loads it with `ssr: false`, which keeps pdf.js and
 * its worker out of the server's graph (next.config lists pdfjs-dist as a
 * server external for the upload checks, and the worker is an ES module).
 */

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

/** At 100%, a page is this wide: the design's paper at 1440px. */
export const PAGE_WIDTH = 520;

export type StageFile = { id: string; mime: string; name: string };

type Loaded = { kind: "pdf"; doc: PDFDocumentProxy } | { kind: "image"; url: string } | { kind: "failed" };

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    });
    return lib;
  });
  return pdfjs;
}

async function load(file: StageFile): Promise<Loaded> {
  const res = await fetch(`/api/admin/mortgages/files/${file.id}`, { cache: "no-store" });
  if (!res.ok) return { kind: "failed" };
  if (file.mime === "application/pdf") {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
    return { kind: "pdf", doc };
  }
  return { kind: "image", url: URL.createObjectURL(await res.blob()) };
}

function PdfPage({
  doc,
  number,
  zoom,
  rotation,
  onVisible,
}: {
  doc: PDFDocumentProxy;
  number: number;
  zoom: number;
  rotation: number;
  onVisible: (page: number, ratio: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [near, setNear] = useState(number <= 2);

  // Render lazily: long statements have dozens of pages.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setNear(true);
          onVisible(number, e.intersectionRatio);
        }
      },
      { rootMargin: "600px 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [number, onVisible]);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(number);
      const scale = (PAGE_WIDTH * zoom) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
      if (cancelled) return;
      setSize({ w: viewport.width, h: viewport.height });
      if (!near || !canvas.current) return;
      const ratio = window.devicePixelRatio || 1;
      const c = canvas.current;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const render = page.render({
        canvas: c,
        canvasContext: ctx,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      task = render;
      await render.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, number, zoom, rotation, near]);

  return (
    <div
      ref={box}
      data-page={number}
      className="mx-auto bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_rgba(0,0,0,.08)]"
      style={size ? { width: size.w, height: size.h } : { width: PAGE_WIDTH * zoom, height: PAGE_WIDTH * zoom * 1.414 }}
    >
      <canvas ref={canvas} style={size ? { width: size.w, height: size.h } : undefined} />
    </div>
  );
}

export function FileStage({
  file,
  cache,
  zoom,
  rotation,
  label,
  onPages,
  onPage,
  onOpened,
}: {
  file: StageFile;
  cache: FileCache;
  zoom: number;
  rotation: number;
  /** The document's name, for the stage's label. */
  label: string;
  onPages: (total: number) => void;
  onPage: (page: number) => void;
  /** The file's bytes arrived: its open is on the log. */
  onOpened: () => void;
}) {
  const [loaded, setLoaded] = useState<{ id: string; value: Loaded } | null>(null);
  const [page, setPage] = useState(1);
  const ratios = useRef(new Map<number, number>());

  useEffect(() => {
    let cancelled = false;
    let promise = cache.get(file.id) as Promise<Loaded> | undefined;
    if (!promise) {
      promise = load(file).catch(() => ({ kind: "failed" }) as Loaded);
      cache.set(file.id, promise);
    }
    promise.then((value) => {
      if (cancelled) return;
      ratios.current.clear();
      setLoaded({ id: file.id, value });
      setPage(1);
      if (value.kind !== "failed") onOpened();
      onPages(value.kind === "pdf" ? value.doc.numPages : 1);
      onPage(1);
    });
    return () => {
      cancelled = true;
    };
  }, [file, cache, onOpened, onPages, onPage]);

  // The page pill follows the page most in view.
  const onVisible = useCallback(
    (n: number, ratio: number) => {
      ratios.current.set(n, ratio);
      let best = 1;
      let bestRatio = -1;
      for (const [p, r] of ratios.current) {
        if (r > bestRatio) {
          best = p;
          bestRatio = r;
        }
      }
      setPage(best);
      onPage(best);
    },
    [onPage],
  );

  const value = loaded?.id === file.id ? loaded.value : null;
  if (!value) {
    return <div className="py-24 text-center text-[12.5px] text-bz-ink-2">{t("c3.openedPending")}</div>;
  }
  if (value.kind === "failed") {
    return <div className="py-24 text-center text-[12.5px] text-bz-ink-2">{t("viewer.loadFailed")}</div>;
  }
  const total = value.kind === "pdf" ? value.doc.numPages : 1;
  return (
    <div role="img" aria-label={t("viewer.stage", { document: label, page, total })} className="flex flex-col gap-6">
      {value.kind === "pdf" ? (
        Array.from({ length: value.doc.numPages }, (_, i) => (
          <PdfPage key={`${file.id}-${i + 1}`} doc={value.doc} number={i + 1} zoom={zoom} rotation={rotation} onVisible={onVisible} />
        ))
      ) : (
        <div className="mx-auto" style={{ width: PAGE_WIDTH * zoom }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a private blob, never optimised or cached */}
          <img
            src={value.url}
            alt=""
            className="w-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_rgba(0,0,0,.08)]"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      )}
    </div>
  );
}
