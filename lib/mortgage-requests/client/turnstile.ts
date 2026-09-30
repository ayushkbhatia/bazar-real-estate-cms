"use client";

import { env } from "@/lib/env";

/**
 * An invisible Cloudflare Turnstile token, for draft creation and submit
 * (SPEC §4.2; lib/turnstile.ts verifies it). The script loads only when a
 * token is first asked for, so it never reaches a page outside the flow.
 *
 * With no site key configured this answers `undefined`, and the server skips
 * the check outside production (lib/turnstile.ts) — local and preview work
 * without Cloudflare. Each token is single-use, so each call renders a fresh
 * widget and removes it once it has answered.
 */

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function getTurnstileToken(timeoutMs = 20_000): Promise<string | undefined> {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return undefined;
  const api = await loadScript();
  // Not hidden: with an "Invisible" site key nothing ever shows, but a
  // "Managed" key may need the visitor to tick a box, and a hidden widget
  // would then time out with no way through.
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    insetInlineStart: "50%",
    bottom: "16px",
    transform: "translateX(-50%)",
    zIndex: "60",
  });
  document.body.appendChild(host);
  let widgetId: string | null = null;
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("turnstile timed out")), timeoutMs);
      widgetId = api.render(host, {
        sitekey: siteKey,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => {
          clearTimeout(timer);
          resolve(token);
        },
        "error-callback": () => {
          clearTimeout(timer);
          reject(new Error("turnstile error"));
        },
      });
      api.execute(widgetId);
    });
  } finally {
    if (widgetId) api.remove(widgetId);
    host.remove();
  }
}
