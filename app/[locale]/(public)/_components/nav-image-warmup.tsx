"use client";

import { useEffect } from "react";
import { constrained } from "./gallery-prefetch";

/**
 * Warms the photographs at the top of a megamenu destination while the
 * pointer is on its link, so the page opens with its hero already painted.
 *
 * `<Link>` already prefetches a destination's data, but not its images: the
 * hero is fetched only once the new page renders, and a cold variant waits on
 * the image optimizer. Which images a page leads with, and at which `sizes`,
 * is something only that page knows — and it already says so. Every
 * `priority` image is announced as `<link rel="preload" as="image">` in the
 * page's `<head>`, with the exact `imagesrcset` and `imagesizes` its `<Image>`
 * will render. So this reads the destination's head (about 15 KB, then the
 * request is cancelled; the HTML is the CDN's cached copy) and requests those
 * same variants through a detached `<img>`, which picks the candidate the
 * page will at this viewport and density. Nothing here knows about any
 * route, so a new page or a new menu item is covered with no change.
 *
 * What keeps it light:
 *  - a link has to hold the pointer for DWELL_MS (keyboard focus likewise),
 *    so sweeping across a panel to reach the bottom item warms nothing on the
 *    way; a touch warms at once, since a tap is about to navigate anyway;
 *  - one head read at a time — a newer hover replaces the queued one;
 *  - each destination read once per page load, each image requested once,
 *    at most NEW_IMAGES_MAX new ones per destination, at low priority;
 *  - links with a query string are skipped: those are search results,
 *    rendered per request, and their images are listings that change;
 *  - data-saver and 2G connections skip it entirely.
 *
 * Lives beside the nav rather than in it: it listens on the document for
 * links inside the header, the megamenu panel and the mobile drawer, so
 * `components/brand/public-mega-nav*.tsx` stay as they are.
 */
const DWELL_MS = 120;
const NEW_IMAGES_MAX = 3;
/** Give up if the head has not closed by then; something is off with the page. */
const HEAD_CHARS_MAX = 64 * 1024;
const SCOPE =
  'header, [data-slot="navigation-menu-content"], [data-slot="sheet-content"]';

const read = new Set<string>();
const warmed = new Set<string>();
let busy = false;
let queued: string | null = null;

type ImageHint = { srcset: string; sizes: string; href: string };

function destination(a: HTMLAnchorElement): string | null {
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.search) return null;
  if (url.pathname === window.location.pathname) return null;
  return url.pathname;
}

async function readHead(path: string): Promise<string | null> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "text/html" },
    priority: "low",
  } as RequestInit & { priority: "low" });
  if (!res.ok || !res.body) return null;
  if (!res.headers.get("content-type")?.includes("text/html")) {
    await res.body.cancel();
    return null;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let html = "";
  try {
    while (html.length < HEAD_CHARS_MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      html += value;
      const end = html.indexOf("</head>");
      if (end !== -1) return html.slice(0, end);
    }
    return null;
  } finally {
    // The body below the head is the page itself; nothing here needs it.
    reader.cancel().catch(() => {});
  }
}

function hintsIn(root: ParentNode): ImageHint[] {
  return Array.from(
    root.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]'),
  ).map((l) => ({
    srcset: l.getAttribute("imagesrcset") ?? "",
    sizes: l.getAttribute("imagesizes") ?? "",
    href: l.getAttribute("href") ?? "",
  }));
}

/** True when it asked for something new. */
function warm(hint: ImageHint): boolean {
  const key = hint.srcset || hint.href;
  if (!key || warmed.has(key)) return false;
  warmed.add(key);
  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  // `sizes` before `srcset`: the candidate is chosen when srcset lands.
  if (hint.sizes) img.sizes = hint.sizes;
  if (hint.srcset) img.srcset = hint.srcset;
  else img.src = hint.href;
  return true;
}

function request(path: string) {
  if (read.has(path)) return;
  if (busy) {
    queued = path;
    return;
  }
  read.add(path);
  busy = true;
  readHead(path)
    .then((head) => {
      if (!head) return;
      // Parsed inert: a DOMParser document loads nothing it describes.
      const doc = new DOMParser().parseFromString(`${head}</head>`, "text/html");
      let fresh = 0;
      for (const hint of hintsIn(doc)) {
        if (fresh >= NEW_IMAGES_MAX) break;
        if (warm(hint)) fresh++;
      }
    })
    .catch(() => {})
    .finally(() => {
      busy = false;
      const next = queued;
      queued = null;
      if (next) request(next);
    });
}

export function NavImageWarmup() {
  useEffect(() => {
    if (typeof fetch === "undefined" || typeof DOMParser === "undefined")
      return;
    if (constrained()) return;

    // What this page already preloaded — the wordmark, which every page
    // announces — is in the browser's cache, and spends none of the budget.
    for (const hint of hintsIn(document)) {
      const key = hint.srcset || hint.href;
      if (key) warmed.add(key);
    }

    let timer: number | undefined;
    const linkOf = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLAnchorElement>("a[href]")
        : null;
    const schedule = (a: HTMLAnchorElement, delay: number) => {
      if (!a.closest(SCOPE)) return;
      const path = destination(a);
      if (!path || read.has(path)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => request(path), delay);
    };

    const onOver = (e: PointerEvent) => {
      const a = linkOf(e.target);
      if (a) schedule(a, e.pointerType === "mouse" ? DWELL_MS : 0);
    };
    const onOut = (e: PointerEvent) => {
      const a = linkOf(e.target);
      if (a && !(e.relatedTarget instanceof Node && a.contains(e.relatedTarget)))
        window.clearTimeout(timer);
    };
    const onFocus = (e: FocusEvent) => {
      const a = linkOf(e.target);
      if (a) schedule(a, DWELL_MS);
    };

    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return null;
}
