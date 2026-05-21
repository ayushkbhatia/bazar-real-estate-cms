"use server";

import { revalidatePath } from "next/cache";
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
  revalidatePath("/", "layout");
  return next;
}

export async function rejectAllConsent(): Promise<ConsentState> {
  const next = rejectAll();
  await writeConsentCookie(next);
  revalidatePath("/", "layout");
  return next;
}

export async function savePreferencesConsent(prefs: {
  analytics?: boolean;
  marketing?: boolean;
}): Promise<ConsentState> {
  const next = savePreferences(prefs);
  await writeConsentCookie(next);
  revalidatePath("/", "layout");
  return next;
}
