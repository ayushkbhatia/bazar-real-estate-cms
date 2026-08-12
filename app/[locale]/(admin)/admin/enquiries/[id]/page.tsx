import { notFound } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import {
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getEnquiryById } from "@/lib/queries/enquiries";
import { propertyUrl } from "@/lib/queries/property-utils";
import { currentStaffRow } from "@/lib/queries/staff";
import { LiveDot } from "@/lib/realtime/live-dot";
import { PresencePile } from "@/lib/realtime/presence-pile";
import { EscalationBanner } from "./_escalation-banner";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { markConversationRead, sendEnquiryTouch } from "../_actions";
import { StatusPipeline, TemperatureToggle } from "./_pipeline";
import { AssignToMeButton } from "./_assign-button";
import { NotesEditor } from "./_notes";
import { EnquiryComposer, type ComposerAsset } from "./_composer";
import { listPublishedAssets } from "@/lib/queries/content-assets";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import type { TokenContext } from "@/lib/content-assets/tokens";
import { ScheduleViewingButton } from "./_schedule";

export const dynamic = "force-dynamic";

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
  const [enquiry, me, emailAssets, whatsappAssets] = await Promise.all([
    getEnquiryById(id),
    currentStaffRow(),
    listPublishedAssets("email"),
    listPublishedAssets("whatsapp"),
  ]);
  if (!enquiry) notFound();
  const now = serverNow();

  // Best-effort mark-read on each staff view. Failures shouldn't block
  // page render — but they shouldn't disappear silently either.
  if (enquiry.unread_count > 0) {
    await markConversationRead(id).catch((err: unknown) => {
      Sentry.captureException(err, {
        tags: { component: "enquiry/mark-read" },
        contexts: { enquiry: { id } },
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
  const advisorPhone = enquiry.staff?.slug
    ? (SEED_AGENTS.find((a) => a.slug === enquiry.staff!.slug)?.phone ?? null)
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
          <EscalationBanner
            createdAt={enquiry.created_at}
            firstResponseAt={enquiry.first_response_at}
            assignedAgentId={enquiry.assigned_agent_id}
            status={enquiry.status}
            nowMs={now}
          />
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
              <StatusPipeline enquiryId={enquiry.id} current={enquiry.status} />
            </div>
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Eyebrow>Lead temperature</Eyebrow>
                <TemperatureToggle
                  enquiryId={enquiry.id}
                  current={enquiry.temperature}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ScheduleViewingButton enquiryId={enquiry.id} />
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
              </div>
            </div>
          </div>

          {/* Conversation */}
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Conversation</Eyebrow>
            <ul className="mt-4 flex flex-col gap-3">
              {enquiry.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "outbound" ? "justify-end" : "justify-start",
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
          </div>
        </div>

        {/* Right context column */}
        <aside className="flex flex-col gap-4 sticky top-6 self-start">
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Lead</Eyebrow>
            <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
              <div>
                <div className="font-medium">{enquiry.name}</div>
                <div className="text-[11.5px] text-bz-muted capitalize">
                  via {enquiry.source.replace(/_/g, " ")}
                </div>
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
                        className="text-[11.5px] text-bz-muted hover:text-bz-accent ml-5"
                      >
                        Open in WhatsApp →
                      </a>
                    );
                  })()}
                </div>
              ) : null}
              {enquiry.timeline ? (
                <div className="inline-flex items-center gap-1.5 text-bz-muted">
                  <Calendar size={13} strokeWidth={1.8} />
                  Timeline:{" "}
                  <span className="text-bz-ink-2 capitalize">
                    {enquiry.timeline.replace(/_/g, " ")}
                  </span>
                </div>
              ) : null}
              {enquiry.budget_min || enquiry.budget_max ? (
                <div className="text-[12px] text-bz-muted">
                  Budget:{" "}
                  <span className="text-bz-ink-2">
                    {enquiry.budget_min
                      ? `AED ${(enquiry.budget_min / 1_000_000).toFixed(1)}M`
                      : "0"}
                    {" – "}
                    {enquiry.budget_max
                      ? `AED ${(enquiry.budget_max / 1_000_000).toFixed(1)}M`
                      : "∞"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {enquiry.developments ? (
            <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
              <Eyebrow>Came from this development</Eyebrow>
              <div className="mt-3 text-[13px]">
                <div className="text-bz-ink">{enquiry.developments.name}</div>
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
                <Link
                  href={propertyUrl({
                    slug: enquiry.properties.slug,
                    reference: enquiry.properties.reference,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                >
                  View on site <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ) : null}

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
