import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { emailSender } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import { emailSiteUrl } from "@/lib/email-templates";
import {
  NEWSLETTER_SEND_ROLES,
  NEWSLETTER_WRITE_ROLES,
  hasArabicEdition,
  renderNewsletter,
  type CampaignRow,
} from "@/lib/newsletter/campaign";
import { deliveryCounts, EMPTY_DELIVERY_COUNTS } from "@/lib/newsletter/send";
import { featureDrawer, newsletterFeatures } from "@/lib/newsletter/features";
import { isAnthropicConfigured } from "@/lib/concierge/env";
import { listFeatureTargets } from "../_feature-targets";
import type { BlogMediaOption } from "../../blog/_image-insert-dialog";
import { subscriberCounts } from "../_data";
import { CampaignStatusPill } from "../_shared";
import { Composer } from "./_composer";
import { CampaignReport } from "./_report";

export const dynamic = "force-dynamic";

async function fetchImages(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"]): Promise<BlogMediaOption[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
    storage_key: m.storage_key,
  }));
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireRole(STAFF_ROLES);
  const { data } = await supabase.from("newsletter_campaigns").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const campaign = data as CampaignRow;
  const [role, counts] = await Promise.all([getStaffRole(), subscriberCounts()]);
  const canWrite = role !== null && (NEWSLETTER_WRITE_ROLES as readonly string[]).includes(role);
  const canSend = role !== null && (NEWSLETTER_SEND_ROLES as readonly string[]).includes(role);
  const sender = emailSender();
  const title = campaign.subject.trim() || "Untitled draft";

  const crumbs = (
    <span className="inline-flex items-center gap-1">
      <Link href="/admin/newsletter" className="hover:text-bz-ink">
        Content · Newsletter
      </Link>
      <ChevronRight size={11} />
      <span className="truncate max-w-[40ch]">{title}</span>
    </span>
  );

  if (campaign.status === "sending" || campaign.status === "sent" || campaign.status === "cancelled") {
    const brand = await readEmailBrand();
    const draft = {
      subject: campaign.subject,
      preheader: campaign.preheader,
      body: campaign.body,
      subject_ar: campaign.subject_ar ?? "",
      preheader_ar: campaign.preheader_ar ?? "",
      body_ar: campaign.body_ar ?? "",
    };
    const unsubscribe = `${emailSiteUrl()}/newsletter/unsubscribe/preview`;
    const admin = createAdminClient();
    // Featured cards as they would draw today — the records are live, so a
    // listing repriced since the send shows its new price here.
    const arabicEdition = hasArabicEdition(draft);
    const [enFeatures, arFeatures] = await Promise.all([
      newsletterFeatures([draft.body], "en"),
      arabicEdition ? newsletterFeatures([draft.body_ar], "ar") : null,
    ]);
    return (
      <CmsShell title={title} breadcrumbs={crumbs} secondary={<CampaignStatusPill status={campaign.status} />}>
        <CampaignReport
          campaign={campaign}
          counts={admin ? await deliveryCounts(id, admin) : EMPTY_DELIVERY_COUNTS}
          english={renderNewsletter(draft, {
            brand,
            locale: "en",
            unsubscribeUrl: unsubscribe,
            features: (l) => featureDrawer(enFeatures, brand, l),
          })}
          arabic={
            arabicEdition && arFeatures
              ? renderNewsletter(draft, {
                  brand,
                  locale: "ar",
                  unsubscribeUrl: unsubscribe,
                  features: (l) => featureDrawer(arFeatures, brand, l),
                })
              : null
          }
          from={sender.from}
          replyTo={sender.replyTo}
          canWrite={canWrite}
        />
      </CmsShell>
    );
  }

  const [media, records] = await Promise.all([fetchImages(supabase), listFeatureTargets()]);
  return (
    <CmsShell title={title} breadcrumbs={crumbs} secondary={<CampaignStatusPill status={campaign.status} />}>
      <Composer
        id={campaign.id}
        status={campaign.status}
        scheduledAt={campaign.scheduled_at}
        updatedAt={campaign.updated_at}
        initial={{
          subject: campaign.subject,
          preheader: campaign.preheader,
          body: campaign.body,
          subject_ar: campaign.subject_ar ?? "",
          preheader_ar: campaign.preheader_ar ?? "",
          body_ar: campaign.body_ar ?? "",
          audience: (["all", "en", "ar"].includes(campaign.audience) ? campaign.audience : "all") as "all" | "en" | "ar",
        }}
        audienceCounts={{ all: counts.confirmed, en: counts.confirmedEn, ar: counts.confirmedAr }}
        media={media}
        records={records}
        canTranslate={isAnthropicConfigured}
        canWrite={canWrite}
        canSend={canSend}
        from={sender.from}
        replyTo={sender.replyTo}
      />
    </CmsShell>
  );
}
