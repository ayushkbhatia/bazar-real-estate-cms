import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { getStaffRole } from "@/lib/auth";
import { MEDIA_BUCKET, mediaPublicUrl } from "@/lib/media";
import { emailSender } from "@/lib/email";
import {
  DEFAULT_EMAIL_BRAND,
  resolveEmailBrand,
} from "@/lib/content-assets/email-brand";
import {
  PREVIEW_ONLY_EMAILS,
  SYSTEM_ASSETS,
  SYSTEM_ASSET_KEYS,
} from "@/lib/content-assets/system";
import { previewSystemEmail } from "@/lib/content-assets/system-emails";
import type { BlogMediaOption } from "../../blog/_image-insert-dialog";
import { EmailDesignForm } from "./_design-form";

export const dynamic = "force-dynamic";

/** A storage URL from this project's bucket → its key; anything else → null. */
function keyFromUrl(url: string | null): string | null {
  if (!url || !env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const prefix = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

export default async function EmailDesignPage() {
  let stored: unknown = {};
  let siteLogo: string | null = null;
  let media: BlogMediaOption[] = [];

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const [settings, images] = await Promise.all([
      supabase
        .from("site_settings")
        .select("email_branding, logo_url")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("media_assets")
        .select("id, filename, storage_key, mime_type")
        .is("deleted_at", null)
        .like("mime_type", "image/%")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    stored = settings.data?.email_branding ?? {};
    siteLogo = settings.data?.logo_url ?? null;
    media = (images.data ?? []).map((m) => ({
      id: m.id,
      filename: m.filename,
      url: mediaPublicUrl(m.storage_key),
      mime: m.mime_type,
      storage_key: m.storage_key,
    }));
  }

  const brand = resolveEmailBrand(stored);
  const role = await getStaffRole();
  const firstKey = SYSTEM_ASSET_KEYS[0];
  const initialPreview = (await previewSystemEmail(firstKey, { brand })).live;
  const sender = emailSender();

  const emails = [
    ...SYSTEM_ASSET_KEYS.map((k) => ({ key: k as string, label: SYSTEM_ASSETS[k].label })),
    ...PREVIEW_ONLY_EMAILS.map((e) => ({ key: e.key as string, label: e.label })),
  ];

  return (
    <CmsShell
      title="Email design"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/content-assets" className="hover:text-bz-ink">
            Content assets
          </Link>
          <ChevronRight size={11} />
          <span>Email design</span>
        </span>
      }
    >
      <EmailDesignForm
        initial={brand}
        defaults={DEFAULT_EMAIL_BRAND}
        siteLogo={siteLogo ? { url: siteLogo, mediaKey: keyFromUrl(siteLogo) } : null}
        media={media}
        emails={emails}
        initialKey={firstKey}
        initialPreview={initialPreview}
        canWrite={role === "admin"}
        from={sender.from}
        replyTo={sender.replyTo}
      />
    </CmsShell>
  );
}
