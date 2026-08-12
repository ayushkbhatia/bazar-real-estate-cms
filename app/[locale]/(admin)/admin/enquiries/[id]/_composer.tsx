"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  missingTokens,
  renderTokens,
  type TokenContext,
} from "@/lib/content-assets/tokens";
import type { SendTouchResult, TouchChannel } from "../_actions";

export type ComposerAsset = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  notes: string | null;
  followUpAfterDays: number | null;
  nextName: string | null;
};

const TABS: {
  channel: TouchChannel;
  label: string;
  icon: typeof Mail;
  verb: string;
}[] = [
  { channel: "email", label: "Email lead", icon: Mail, verb: "Send email" },
  {
    channel: "whatsapp",
    label: "WhatsApp lead",
    icon: MessageCircle,
    verb: "Open WhatsApp",
  },
  { channel: "call", label: "Log a call", icon: Phone, verb: "Log call" },
];

export function EnquiryComposer({
  enquiryId,
  tokenContext,
  hasEmail,
  hasPhone,
  assets,
  send,
}: {
  enquiryId: string;
  /** Resolved values for this lead — drives template fill and the warnings. */
  tokenContext: TokenContext;
  hasEmail: boolean;
  hasPhone: boolean;
  assets: { email: ComposerAsset[]; whatsapp: ComposerAsset[] };
  /**
   * Passed by reference from the server page. Wrapping it in an arrow would
   * make it a plain function and break the server/client boundary.
   */
  send: (
    id: string,
    input: { channel: TouchChannel; body: string; subject?: string | null },
  ) => Promise<SendTouchResult>;
}) {
  const [channel, setChannel] = useState<TouchChannel>(
    hasEmail ? "email" : hasPhone ? "whatsapp" : "call",
  );
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [assetId, setAssetId] = useState("");
  const [pending, start] = useTransition();

  const tab = TABS.find((t) => t.channel === channel)!;
  const channelAssets =
    channel === "email" ? assets.email : channel === "whatsapp" ? assets.whatsapp : [];
  const chosen = channelAssets.find((a) => a.id === assetId) ?? null;

  const blockedReason =
    channel === "email" && !hasEmail
      ? "This lead has no email address on file."
      : channel === "whatsapp" && !hasPhone
        ? "This lead has no phone number on file."
        : null;

  // Warn about tokens that fell back, using the ASSET's raw copy — once the
  // template is rendered into the textarea the tokens are gone, so this has to
  // be measured before substitution.
  const fellBack = useMemo(
    () =>
      chosen
        ? missingTokens(`${chosen.subject ?? ""}\n${chosen.body}`, tokenContext)
        : [],
    [chosen, tokenContext],
  );

  function applyAsset(id: string) {
    setAssetId(id);
    const asset = channelAssets.find((a) => a.id === id);
    if (!asset) return;
    setBody(renderTokens(asset.body, tokenContext));
    if (channel === "email")
      setSubject(renderTokens(asset.subject ?? "", tokenContext));
  }

  function switchChannel(next: TouchChannel) {
    setChannel(next);
    // The copy is channel-shaped — an email body pasted into WhatsApp reads
    // wrong — so start clean rather than carrying it across.
    setAssetId("");
    setBody("");
    setSubject("");
  }

  function onSend() {
    if (!body.trim() || blockedReason) return;
    start(async () => {
      const result = await send(enquiryId, {
        channel,
        body,
        subject: channel === "email" ? subject : null,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      // The deep link has to open from the click's transition, not a redirect,
      // or the browser treats it as a popup.
      if (result.whatsappUrl) window.open(result.whatsappUrl, "_blank", "noopener");
      toast.success(result.message);
      setBody("");
      setSubject("");
      setAssetId("");
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-bz-border flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.channel}
                type="button"
                onClick={() => switchChannel(t.channel)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                  channel === t.channel
                    ? "bg-bz-navy text-bz-bg font-medium"
                    : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                <Icon size={12} strokeWidth={1.8} />
                {t.label}
              </button>
            );
          })}
        </div>
        <Link
          href="/admin/content-assets"
          className="text-[11.5px] text-bz-muted hover:text-bz-ink"
        >
          Manage templates →
        </Link>
      </div>

      {blockedReason ? (
        <p className="text-[12.5px] text-bz-muted">{blockedReason}</p>
      ) : (
        <>
          {channelAssets.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <select
                value={assetId}
                onChange={(e) => applyAsset(e.target.value)}
                className="border border-bz-border rounded p-2 text-[13px] bg-bz-surface focus:border-bz-accent outline-none"
              >
                <option value="">Start from a template…</option>
                {channelAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {chosen?.notes ? (
                <p className="text-[11.5px] text-bz-muted">{chosen.notes}</p>
              ) : null}
              {chosen?.nextName ? (
                <p className="text-[11.5px] text-bz-muted">
                  Next in the sequence: {chosen.nextName}
                  {chosen.followUpAfterDays
                    ? ` — after ${chosen.followUpAfterDays} day${chosen.followUpAfterDays === 1 ? "" : "s"}`
                    : ""}
                  . Sending it is a manual step.
                </p>
              ) : null}
              {fellBack.length > 0 ? (
                <p className="inline-flex items-start gap-1.5 text-[11.5px] text-[oklch(0.45_0.13_28)]">
                  <TriangleAlert size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                  <span>
                    This lead has no{" "}
                    {fellBack.map((t) => t.replace(/_/g, " ")).join(", ")} — the
                    template filled in generic wording. Read it before sending.
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {channel === "email" ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="border border-bz-border rounded p-2 text-[13px] bg-bz-surface focus:border-bz-accent outline-none"
            />
          ) : null}

          <label htmlFor="composer-body" className="sr-only">
            {tab.label}
          </label>
          <textarea
            id="composer-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={channel === "call" ? 3 : 5}
            placeholder={
              channel === "call"
                ? "What was discussed, and what happens next."
                : "Write your message…"
            }
            className="border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent outline-none resize-y"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11.5px] text-bz-muted">
              {channel === "whatsapp"
                ? "Opens WhatsApp with this message ready to send, and records the handoff here."
                : channel === "call"
                  ? "Recorded on the timeline. Nothing is sent to the lead."
                  : "Sent to the lead and recorded on the timeline."}{" "}
              ⌘+Enter. {body.length}/4000.
            </span>
            <Button
              type="button"
              onClick={onSend}
              disabled={pending || !body.trim()}
            >
              <Send size={14} strokeWidth={1.8} />
              {pending ? "Working…" : tab.verb}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
