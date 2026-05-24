"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  propertyCreateSchema,
  type PropertyCreateInput,
} from "@/lib/schemas/property";
import { generatePropertyReference, slugify } from "@/lib/slug";
import { requireRole } from "@/lib/auth";

const PROPERTY_ROLES = ["admin", "editor", "agent"] as const;

export type CreateResult =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const MAX_REFERENCE_TRIES = 5;

function normaliseCreateInput(raw: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = { ...raw };
  for (const k of ["price_aed", "beds", "baths"] as const) {
    const v = out[k];
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }
  return out;
}

export async function createProperty(
  raw: Record<string, unknown>,
): Promise<CreateResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  await requireRole(PROPERTY_ROLES);

  const parsed = propertyCreateSchema.safeParse(
    normaliseCreateInput(raw) as PropertyCreateInput,
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const slug = slugify(parsed.data.title);

  // Retry a few times in case the generated reference collides.
  for (let attempt = 0; attempt < MAX_REFERENCE_TRIES; attempt++) {
    const reference = generatePropertyReference("AD");
    const { data, error } = await supabase
      .from("properties")
      .insert({
        ...parsed.data,
        reference,
        slug,
        status: "draft",
        amenities: [],
        flags: {},
        compliance: {},
        seo: { slug },
      })
      .select("id")
      .maybeSingle();

    if (!error && data) {
      revalidatePath("/admin/properties");
      redirect(`/admin/properties/${data.id}`);
    }

    // Duplicate-key violation on reference (or slug). Retry on ref collisions,
    // bail out with a useful message on slug collision.
    if (error?.code === "23505") {
      if (error.message?.toLowerCase().includes("slug")) {
        return {
          status: "error",
          message:
            "A property with that slug already exists. Adjust the title or set the slug manually after create.",
          fieldErrors: { title: "Slug derived from this title is in use" },
        };
      }
      continue;
    }

    if (error) {
      return { status: "error", message: error.message };
    }
  }

  return {
    status: "error",
    message:
      "Could not allocate a unique reference after several attempts. Try again.",
  };
}
