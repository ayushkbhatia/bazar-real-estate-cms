"use server";

import { z } from "zod";
import { createTourRequest } from "@/lib/queries/tour-requests";
import { getSessionUser } from "@/lib/supabase/server";

const TourRequestInput = z.object({
  property_id: z.string().min(1, "Property id required"),
  full_name: z.string().min(2, "Name is too short").max(120),
  phone: z.string().min(4, "Phone is too short").max(40),
  preferred_date: z.string().min(1, "Pick a date"),
  preferred_time: z.string().min(1, "Pick a time"),
  message: z.string().max(560).optional().nullable(),
});

export type SubmitTourResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function submitTourRequest(
  raw: unknown,
): Promise<SubmitTourResult> {
  const parsed = TourRequestInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { property_id, full_name, phone, preferred_date, preferred_time, message } =
    parsed.data;

  // Anonymous + signed-in both write. Signed-in fills account_id so the
  // /account/saved Tour requests tab can read it back via listTourRequests.
  const user = await getSessionUser();
  const preferred_window = `${preferred_date} at ${preferred_time}`;
  const id = await createTourRequest({
    property_id,
    account_id: user?.id ?? null,
    full_name,
    phone,
    preferred_window,
    message: message ?? null,
  });
  return { ok: true, id };
}
