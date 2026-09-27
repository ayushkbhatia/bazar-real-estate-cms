import { notFound } from "next/navigation";
import Link from "next/link";
import { reportError } from "@/lib/observability";
import {
  Archive,
  ChevronRight,
  ExternalLink,
  Languages,
  Mail,
  Phone,
} from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  getEnquiryById,
  listEnquirySubmissions,
  listRelatedEnquiries,
} from "@/lib/queries/enquiries";
import { getFormForAdmin } from "@/lib/queries/forms";
import { formatPriceAED, propertyUrl } from "@/lib/queries/property-utils";
import { currentStaffRow } from "@/lib/queries/staff";
import { getStaffRole } from "@/lib/auth";
import { env, isSalesforceConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveDot } from "@/lib/realtime/live-dot";
import { PresencePile } from "@/lib/realtime/presence-pile";
import { EscalationBanner } from "./_escalation-banner";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { describeSourcePage, enquiryOrigin, humanise } from "@/lib/enquiries/origin";
import { readAnswers } from "@/lib/enquiries/answers";
import { leadFacts } from "@/lib/enquiries/profile";
import { markConversationRead, sendEnquiryTouch } from "../_actions";
import { StatusPipeline, TemperatureToggle } from "./_pipeline";
import { AssignToMeButton } from "./_assign-button";
import { NotesEditor } from "./_notes";
import { EnquiryComposer, type ComposerAsset } from "./_composer";
import { SubmissionCard } from "./_submission";
import { RelatedEnquiries } from "./_history";
import { FollowThrough, type CrmSync } from "./_follow-through";
import { ArchiveEnquiryButton } from "../_archive-button";
import { listPublishedAssets } from "@/lib/queries/content-assets";
import { getAdvisorByUserId } from "@/lib/queries/property-advisor";
import type { TokenContext } from "@/lib/content-assets/tokens";

export const dynamic = "force-dynamic";

/** The Forms Manager's own gate — see `FORM_ROLES` in admin/forms/page.tsx. */
const FORM_EDIT_ROLES = new Set(["admin", "editor", "marketing"]);

/** How many of the same person's other enquiries the history card lists. */
const HISTORY_SHOWN = 8;

const LISTING_STATUS: Record<string, string> = {
  draft: "a draft",
  in_review: "in review",
  off_market: "off market",
  archived: "archived",
};

const LISTING_MODE: Record<string, string> = {
  buy: "For sale",
  rent: "For rent",
  off_plan: "Off-plan",
  commercial: "Commercial",
};

const PROJECT_STATUS: Record<string, string> = {
  pre_launch: "Pre-launch",
  on_sale: "On sale",
  sold_out: "Sold out",
  handed_over: "Handed over",
};

type PageProps = { params: Promise<{ id: string }> };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Server-side helper — keeps Date.now() outside the JSX render body so
// the React Compiler doesn't flag it as impure.
function serverNow(): number {
  return Date.now();
}

/** "For sale · AED 2.4M · 3 bed · 4 bath" — what the advisor would quote. */
function listingSummary(p: {
  mode: string;
  price_aed: number;
  beds: number;
  baths: number;
  type: string;
}): string {
  const parts = [
    LISTING_MODE[p.mode] ?? humanise(p.mode),
    p.price_aed > 0 ? formatPriceAED(p.price_aed) : null,
    p.beds > 0
      ? `${p.beds} bed`
      : p.type === "apartment" || p.type === "hotel_apartment"
        ? "Studio"
        : humanise(p.type),
    p.baths > 0 ? `${p.baths} bath` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * How the touch actually went out. Until now every staff reply was logged
 * 'web' even when it was emailed, so the timeline described the wrong channel.
 * Unknown values fall through to the raw enum rather than being hidden.
 */
function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    web: "web",
    email: "email",
    whatsapp: "WhatsApp",
    sms: "SMS",
    call: "call",
  };
  return labels[channel] ?? channel;
}

export default async function EnquiryDetailPage({ params }: PageProps) {
  const { id } = await params;

  // The enquiry decides whether this page 404s, so it is awaited first. The
  // other three reads depend on nothing but the request, so they start in
  // parallel with it rather than in three further waves behind it.
  //
  // `Promise.all` and not `allSettled`: `listPublishedAssets` already returns
  // `[]` on failure and `currentStaffRow` returns null, so neither rejects. A
  // rejection here would turn a missing enquiry into a 500 instead of the
  // 404 below.
  //
  // The submission log is keyed on the enquiry id, which the URL already
  // carries, so it joins the first wave too. It resolves to `[]` on any
  // failure — losing the answers must not cost the page.
  const [enquiry, me, role, emailAssets, whatsappAssets, submissions] =
    await Promise.all([
      getEnquiryById(id),
      currentStaffRow(),
      getStaffRole(),
      listPublishedAssets("email"),
      listPublishedAssets("whatsapp"),
      listEnquirySubmissions(id),
    ]);
  if (!enquiry) notFound();
  const isArchived = enquiry.archived_at !== null;
  const canArchive = role === "admin";
  const now = serverNow();

  // The row's own key where it has one; the log's for rows older than 0128 and
  // for the valuation gate, which files its lead without one.
  const submission = submissions[0] ?? null;
  const formKey = enquiry.form_key ?? submission?.form_key ?? null;
  const origin = enquiryOrigin(formKey, enquiry.source);

  // Best-effort mark-read on each staff view. Failures shouldn't block
  // page render — but they shouldn't disappear silently either.
  if (enquiry.unread_count > 0 && !isArchived) {
    await markConversationRead(id).catch(async (err: unknown) => {
      await reportError(err, {
        source: "enquiry/mark-read",
        context: { enquiry: { id } },
      });
    });
  }

  // `me` is for presence — null when the viewer isn't staff (the proxy
  // already gated the route, but the row may briefly be missing). The asset
  // lists are the outreach library for the composer; empty is fine, the
  // advisor writes from scratch. Both resolved above.
  const assetName = new Map(
    [...emailAssets, ...whatsappAssets].map((a) => [a.id, a.name]),
  );
  const toComposerAsset = (a: (typeof emailAssets)[number]): ComposerAsset => ({
    id: a.id,
    name: a.name,
    subject: a.subject,
    body: a.body,
    notes: a.notes,
    followUpAfterDays: a.follow_up_after_days,
    nextName: a.next_asset_id ? (assetName.get(a.next_asset_id) ?? null) : null,
  });

  // `staff` carries no phone number, so the advisor's direct line still comes
  // from the seeded profile, matched on slug — same join the public advisor
  // cards use.
  // Only the assigned advisor resolves to a slug — `currentStaffRow` doesn't
  // select one — so an unassigned lead falls back to the token's generic
  // wording rather than quoting the viewer's number.
  const advisor = enquiry.staff ?? me;
  // `staff.public_phone`, not a seed matched on slug — that put a fictional
  // advisor's number into `{advisor_phone}` in every outreach message an
  // advisor composed from this screen.
  //
  // Second wave, all three independent of each other: they need the enquiry
  // (the advisor, the contact details, the form key) and nothing else. The
  // form is read as it stands today for its option labels and its order; the
  // registry copy stands in if the read fails.
  const [advisorPhone, related, liveForm] = await Promise.all([
    enquiry.assigned_agent_id
      ? getAdvisorByUserId(enquiry.assigned_agent_id).then(
          (a) => a?.phone ?? null,
        )
      : Promise.resolve(null),
    listRelatedEnquiries({
      excludeId: enquiry.id,
      email: enquiry.email,
      phone: enquiry.phone,
      // The archive is admin-only to read; it must not leak in through here.
      includeArchived: canArchive,
      // One past what the card shows, so "8+" is only said when it's true.
      limit: HISTORY_SHOWN + 1,
    }),
    origin.def && submission
      ? createSupabaseServerClient()
          .then((supabase) => getFormForAdmin(supabase, origin.def!.key))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const answers = submission
    ? readAnswers({
        data: submission.data,
        labels: submission.labels,
        def: origin.def,
        fields: liveForm?.form.fields ?? null,
        records: {
          development:
            enquiry.development_id && enquiry.developments
              ? { id: enquiry.development_id, name: enquiry.developments.name }
              : null,
          property:
            enquiry.property_id && enquiry.properties
              ? {
                  id: enquiry.property_id,
                  label: `${enquiry.properties.reference} · ${enquiry.properties.title}`,
                }
              : null,
        },
      })
    : null;

  const sourcePage = describeSourcePage(submission?.source_path, {
    property:
      enquiry.property_id && enquiry.properties
        ? {
            id: enquiry.property_id,
            reference: enquiry.properties.reference,
            title: enquiry.properties.title,
          }
        : null,
    development: enquiry.developments,
  });

  const facts = leadFacts({
    source: enquiry.source,
    formKey,
    def: origin.def,
    inferred: enquiry.inferred_constraints,
    budgetMin: enquiry.budget_min,
    budgetMax: enquiry.budget_max,
    timeline: enquiry.timeline,
    preApproved: enquiry.pre_approved,
    locale: enquiry.locale,
    propertyMode: enquiry.properties?.mode ?? null,
  });

  // Only meaningful once the integration is connected: until then every lead
  // reads "queued" for a sync that isn't running.
  const crm: CrmSync | null = isSalesforceConfigured
    ? {
        state: enquiry.crm_sync_state,
        syncedAt: enquiry.crm_synced_at,
        error: enquiry.crm_last_error,
        url:
          enquiry.crm_external_id && env.SALESFORCE_INSTANCE_URL
            ? `${env.SALESFORCE_INSTANCE_URL.replace(/\/+$/, "")}/${enquiry.crm_external_id}`
            : null,
      }
    : null;

  const tokenContext: TokenContext = {
    lead_first_name: enquiry.name.split(" ")[0] ?? null,
    lead_name: enquiry.name,
    property_reference: enquiry.properties?.reference ?? null,
    property_title: enquiry.properties?.title ?? null,
    advisor_name: advisor?.display_name ?? null,
    advisor_phone: advisorPhone,
    site_url: "bazar.ae",
  };

  return (
    <CmsShell
      title={enquiry.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/enquiries" className="hover:text-bz-ink">
            Enquiries
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{enquiry.id.slice(0, 8)}</span>
        </span>
      }
      live={
        <>
          {enquiry.conversation_id ? (
            <LiveDot
              channel={`public:messages:${enquiry.conversation_id}`}
              table="messages"
              filter={`conversation_id=eq.${enquiry.conversation_id}`}
              event="INSERT"
            />
          ) : null}
          {me ? (
            <PresencePile
              channel={`presence:enquiry:${enquiry.id}`}
              self={{
                user_id: me.user_id,
                display_name: me.display_name,
                joined_at: new Date().toISOString(),
                photo_url: me.photo_url ?? null,
              }}
            />
          ) : null}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {isArchived ? (
            <div className="flex items-start gap-3 rounded-lg border border-bz-border bg-bz-surface-2 px-4 py-3">
              <Archive
                size={15}
                strokeWidth={1.8}
                className="text-bz-muted mt-0.5 flex-shrink-0"
              />
              <div className="text-[13px] leading-relaxed">
                <span className="font-medium">This enquiry is archived.</span>{" "}
                <span className="text-bz-ink-2">
                  Filed {formatDateTime(enquiry.archived_at!)}. It stays out of
                  the inbox, the pipeline and the dashboard counts, and it
                  can&apos;t be replied to or reassigned until an admin restores
                  it.
                </span>
              </div>
            </div>
          ) : (
            // An archived lead has no SLA left to breach — the escalation
            // cron skips it, so the banner would be claiming a countdown
            // that nothing is running.
            <EscalationBanner
              createdAt={enquiry.created_at}
              firstResponseAt={enquiry.first_response_at}
              assignedAgentId={enquiry.assigned_agent_id}
              status={enquiry.status}
              nowMs={now}
            />
          )}
          {/* Header */}
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <Eyebrow>Status</Eyebrow>
              </div>
              <span className="text-[12px] text-bz-muted">
                Submitted {formatDateTime(enquiry.created_at)}
              </span>
            </div>
            <div className="mt-3">
              <StatusPipeline
                enquiryId={enquiry.id}
                current={enquiry.status}
                readOnly={isArchived}
              />
            </div>
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Eyebrow>Lead temperature</Eyebrow>
                <TemperatureToggle
                  enquiryId={enquiry.id}
                  current={enquiry.temperature}
                  readOnly={isArchived}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isArchived ? null : (
                  <>
                    {enquiry.assigned_agent_id == null ? (
                      <AssignToMeButton enquiryId={enquiry.id} />
                    ) : (
                      <span className="text-[12px] text-bz-muted">
                        Assigned to{" "}
                        <span className="text-bz-ink-2">
                          {enquiry.staff?.display_name ?? "an advisor"}
                        </span>
                      </span>
                    )}
                  </>
                )}
                {canArchive ? (
                  <ArchiveEnquiryButton
                    enquiryId={enquiry.id}
                    name={enquiry.name}
                    archived={isArchived}
                    presentation="button"
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* What they sent — form, page, answers */}
          <SubmissionCard
            origin={origin}
            page={sourcePage}
            facts={facts}
            answers={answers}
            canEditForms={role !== null && FORM_EDIT_ROLES.has(role)}
          />

          {/* Conversation */}
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Conversation</Eyebrow>
            <ul className="mt-4 flex flex-col gap-3">
              {enquiry.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "outbound"
                      ? "justify-end"
                      : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[72%] rounded-lg px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                      m.direction === "outbound"
                        ? "bg-bz-ink text-bz-bg"
                        : m.author_kind === "system"
                          ? "bg-bz-surface-2 text-bz-muted italic"
                          : "bg-bz-accent-soft text-bz-ink",
                    )}
                  >
                    <div className="whitespace-pre-line">{m.body}</div>
                    <div
                      className={cn(
                        "mt-1.5 text-[10.5px] uppercase tracking-wider",
                        m.direction === "outbound"
                          ? "text-bz-bg/60"
                          : "text-bz-muted",
                      )}
                    >
                      {m.author_kind} · {channelLabel(m.channel)} ·{" "}
                      {formatDateTime(m.sent_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {isArchived ? (
              <p className="mt-4 rounded-md border border-dashed border-bz-border px-3.5 py-3 text-[12.5px] text-bz-muted">
                Replying is disabled while this enquiry is archived — the send
                action refuses it, so the composer is hidden rather than failing
                after you&apos;ve written the message.
              </p>
            ) : (
              <EnquiryComposer
                enquiryId={enquiry.id}
                tokenContext={tokenContext}
                hasEmail={Boolean(enquiry.email)}
                hasPhone={Boolean(enquiry.phone)}
                assets={{
                  email: emailAssets.map(toComposerAsset),
                  whatsapp: whatsappAssets.map(toComposerAsset),
                }}
                // By reference — an arrow wrapper here can't cross the boundary.
                send={sendEnquiryTouch}
              />
            )}
          </div>
        </div>

        {/* Right context column. Scrolls on its own once it outgrows the
            viewport — sticky alone left the notes editor at the bottom
            unreachable until the conversation ran out. */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-6 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Lead</Eyebrow>
            <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
              <div>
                <div className="font-medium">{enquiry.name}</div>
                {related ? (
                  <div className="text-[11.5px] text-bz-muted">
                    {related.length === 0
                      ? "First enquiry from them"
                      : `Returning — ${related.length > HISTORY_SHOWN ? `${HISTORY_SHOWN}+` : related.length} other ${related.length === 1 ? "enquiry" : "enquiries"}`}
                  </div>
                ) : null}
              </div>
              {enquiry.email ? (
                <a
                  href={`mailto:${enquiry.email}`}
                  className="inline-flex items-center gap-1.5 text-bz-ink-2 hover:text-bz-accent"
                >
                  <Mail size={13} strokeWidth={1.8} />
                  {enquiry.email}
                </a>
              ) : null}
              {enquiry.phone ? (
                <div className="flex flex-col gap-1">
                  <a
                    href={`tel:${enquiry.phone}`}
                    className="inline-flex items-center gap-1.5 text-bz-ink-2 hover:text-bz-accent"
                  >
                    <Phone size={13} strokeWidth={1.8} />
                    {enquiry.phone}
                  </a>
                  {(() => {
                    // Prefill the WhatsApp draft with the lead's first
                    // name + the property reference so the advisor opens
                    // the chat with context already in the composer.
                    const firstName = enquiry.name.split(" ")[0] ?? "there";
                    const ref = enquiry.properties?.reference;
                    const msg = ref
                      ? `Hi ${firstName}, this is Bazar Real Estate following up about ${ref}.`
                      : `Hi ${firstName}, this is Bazar Real Estate following up on your enquiry.`;
                    const waUrl = buildWhatsAppLink(enquiry.phone, msg);
                    if (!waUrl) return null;
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11.5px] text-bz-muted hover:text-bz-accent ms-5"
                      >
                        Open in WhatsApp →
                      </a>
                    );
                  })()}
                </div>
              ) : null}
              {/* Timeline and budget moved to the at-a-glance strip on the
                  submission card, where every form's version of them reads
                  the same. Language stays here: it decides how to reply. */}
              {enquiry.locale === "ar" ? (
                <div className="inline-flex items-center gap-1.5 text-bz-ink-2">
                  <Languages size={13} strokeWidth={1.8} />
                  Wrote to us from the Arabic site
                </div>
              ) : null}
            </div>
          </div>

          {related && related.length > 0 ? (
            <RelatedEnquiries
              rows={related.slice(0, HISTORY_SHOWN)}
              currentName={enquiry.name}
            />
          ) : null}

          {enquiry.developments ? (
            <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
              <Eyebrow>Came from this development</Eyebrow>
              <div className="mt-3 text-[13px]">
                <div className="text-bz-ink">{enquiry.developments.name}</div>
                <div
                  className={cn(
                    "mt-1 text-[12px]",
                    enquiry.developments.status === "sold_out"
                      ? "text-bz-danger"
                      : "text-bz-ink-2",
                  )}
                >
                  {PROJECT_STATUS[enquiry.developments.status] ??
                    humanise(enquiry.developments.status)}
                  {enquiry.developments.starting_price
                    ? ` · from ${formatPriceAED(enquiry.developments.starting_price)}`
                    : ""}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Link
                    href={`/developments/${enquiry.developments.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                  >
                    View project page <ExternalLink size={11} />
                  </Link>
                  <Link
                    href={`/admin/pages/sub/development/${enquiry.developments.slug}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                  >
                    Edit page content <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {enquiry.properties ? (
            <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
              <Eyebrow>About this property</Eyebrow>
              <div className="mt-3 text-[13px]">
                <div className="mono text-[11.5px] text-bz-muted">
                  {enquiry.properties.reference}
                </div>
                <div className="text-bz-ink mt-0.5">
                  {enquiry.properties.title}
                </div>
                <div className="mt-1 text-[12px] text-bz-ink-2">
                  {listingSummary(enquiry.properties)}
                </div>
                {enquiry.properties.status !== "published" ? (
                  // The first thing to know before quoting a listing back to
                  // someone is whether it's still there to quote.
                  <div className="mt-1.5 text-[12px] font-medium text-bz-danger">
                    No longer live — it&apos;s{" "}
                    {LISTING_STATUS[enquiry.properties.status] ??
                      humanise(enquiry.properties.status).toLowerCase()}
                    .
                  </div>
                ) : null}
                <div className="mt-2 flex flex-col gap-1.5">
                  <Link
                    href={propertyUrl({
                      slug: enquiry.properties.slug,
                      reference: enquiry.properties.reference,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                  >
                    View on site <ExternalLink size={11} />
                  </Link>
                  {enquiry.property_id ? (
                    <Link
                      href={`/admin/properties/${enquiry.property_id}`}
                      className="inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                    >
                      Open listing <ChevronRight size={11} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <FollowThrough crm={crm} ackSentAt={enquiry.ack_sent_at} />

          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Internal notes</Eyebrow>
            <div className="mt-3">
              <NotesEditor
                enquiryId={enquiry.id}
                initial={enquiry.internal_notes}
              />
            </div>
          </div>
        </aside>
      </div>
    </CmsShell>
  );
}
