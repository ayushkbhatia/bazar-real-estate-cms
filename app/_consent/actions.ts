"use server";

import { revalidateLocalised } from "@/lib/i18n/revalidate";
import {
  acceptAll,
  rejectAll,
  savePreferences,
  type ConsentState,
} from "@/lib/consent";
import { writeConsentCookie } from "@/lib/consent-cookie";

export async function acceptAllConsent(): Promise<ConsentState> {
  const next = acceptAll();
  await writeConsentCookie(next);
  // Force re-render so server-rendered analytics scripts can mount.
  revalidateLocalised("/", "layout");
  return next;
}

export async function rejectAllConsent(): Promise<ConsentState> {
  const next = rejectAll();
  await writeConsentCookie(next);
  revalidateLocalised("/", "layout");
  return next;
}

export async function savePreferencesConsent(prefs: {
  analytics?: boolean;
  marketing?: boolean;
}): Promise<ConsentState> {
  const next = savePreferences(prefs);
  await writeConsentCookie(next);
  revalidateLocalised("/", "layout");
  return next;
}
