/**
 * Server-only helper to read preferences from the request cookie.
 * Used by `app/layout.tsx` to seed the provider with the user's last choice
 * so SSR matches the first client render.
 */

import { cookies } from "next/headers";
import { PREFS_COOKIE, decodePrefs } from "./cookie";
import { DEFAULT_PREFERENCES, type Preferences } from "./types";

export async function readPreferencesFromCookie(): Promise<Preferences> {
  try {
    const store = await cookies();
    const raw = store.get(PREFS_COOKIE)?.value;
    return decodePrefs(raw);
  } catch {
    // `cookies()` throws outside a request context (e.g. during build for
    // static pages). Fall back to defaults so SSG still works.
    return DEFAULT_PREFERENCES;
  }
}
