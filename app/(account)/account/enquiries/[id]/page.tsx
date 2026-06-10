import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Building2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getEnquiryById } from "@/lib/queries/enquiries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReplyComposer } from "./_reply";

export const metadata: Metadata = {
  title: "Enquiry thread",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  qualifying: "Qualifying",
  viewing: "Viewing",
  offer: "Offer",
  negotiation: "Negotiation",
  closed_won: "Closed",
  closed_lost: "Closed",
};

export default async function AccountEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const enquiry = await getEnquiryById(id);
  if (!enquiry || enquiry.account_id !== user.id) notFound();

  const status = STATUS_LABEL[enquiry.status] ?? "Open";

  return (
    <div>
      {/* Crumb */}
      <Link
        href="/account/enquiries"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink-2 transition-colors"
      >
        <ArrowLeft size={13} strokeWidth={1.8} />
        All enquiries
      </Link>

      {/* Header */}
      <div className="mt-6">
        <Eyebrow>
          Enquiry · {status}
          {enquiry.staff ? ` · ${enquiry.staff.display_name}` : ""}
        </Eyebrow>
        <h1
          className="serif text-[28px] md:text-[40px] mt-2 font-normal leading-[1.05] max-w-[26ch]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {enquiry.properties ? enquiry.properties.title : "General brief"}
        </h1>
        {enquiry.properties ? (
          <Link
            href={`/p/${enquiry.properties.slug}`}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
          >
            <Building2 size={13} strokeWidth={1.7} />
            <span className="mono">{enquiry.properties.reference}</span>
            <span>·</span>
            <span>View property</span>
          </Link>
        ) : null}
      </div>

      {/* Conversation */}
      <div className="mt-10 max-w-[720px]">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Conversation
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {/* Initial brief always shows */}
          {enquiry.brief_raw ? (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-bz-ink text-bz-bg px-4 py-3">
                <div className="text-[10.5px] uppercase tracking-wider opacity-70 mb-1">
                  You · {formatTime(enquiry.created_at)}
                </div>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                  {enquiry.brief_raw}
                </p>
              </div>
            </div>
          ) : null}

          {enquiry.messages.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-bz-muted">
              Awaiting advisor reply.
            </div>
          ) : (
            enquiry.messages.map((m) => {
              if (m.author_kind === "system") {
                return (
                  <div
                    key={m.id}
                    className="text-center py-1.5 text-[11.5px] text-bz-muted italic"
                  >
                    {m.body}
                  </div>
                );
              }
              const isOutbound = m.direction === "outbound";
              return (
                <div
                  key={m.id}
                  className={
                    isOutbound ? "flex justify-start" : "flex justify-end"
                  }
                >
                  <div
                    className={
                      isOutbound
                        ? "max-w-[80%] rounded-2xl rounded-bl-md bg-bz-surface border border-bz-border px-4 py-3"
                        : "max-w-[80%] rounded-2xl rounded-br-md bg-bz-ink text-bz-bg px-4 py-3"
                    }
                  >
                    <div
                      className={
                        isOutbound
                          ? "text-[10.5px] uppercase tracking-wider text-bz-muted mb-1"
                          : "text-[10.5px] uppercase tracking-wider opacity-70 mb-1"
                      }
                    >
                      {isOutbound
                        ? `${enquiry.staff?.display_name ?? "Bazar"} · ${formatTime(m.sent_at)}`
                        : `You · ${formatTime(m.sent_at)}`}
                    </div>
                    <p
                      className={
                        isOutbound
                          ? "text-[14px] text-bz-ink leading-relaxed whitespace-pre-wrap"
                          : "text-[14px] leading-relaxed whitespace-pre-wrap"
                      }
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply composer */}
        <div className="mt-8">
          <ReplyComposer
            enquiryId={enquiry.id}
            conversationId={enquiry.conversation_id}
          />
        </div>
      </div>
    </div>
  );
}
