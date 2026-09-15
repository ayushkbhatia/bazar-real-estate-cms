"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import {
  EmailFrame,
  InboxHeader,
  ViewportToggle,
  type EmailViewport,
} from "../_email-frame";

/** An email the site sends whose wording is not the CMS's to change. */
export function PreviewOnlyEmail({
  def,
  email,
  from,
  replyTo,
  to,
}: {
  def: { label: string; trigger: string; recipient: string; builtIn: string; why: string };
  email: RenderedEmail;
  from: string;
  replyTo: string;
  to: string;
}) {
  const [viewport, setViewport] = useState<EmailViewport>("desktop");
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,660px)] gap-6 items-start">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-bz-border bg-bz-surface p-5">
          <div className="flex items-center gap-2">
            <Eye size={13} strokeWidth={1.8} className="text-bz-muted" />
            <Eyebrow>Preview only</Eyebrow>
          </div>
          <p className="mt-2 text-[13px] text-bz-ink-2 max-w-[70ch]">{def.trigger}</p>
          <p className="mt-2 text-[12.5px] text-bz-muted max-w-[70ch]">{def.why}</p>
          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-bz-muted">Goes to</dt>
            <dd className="text-bz-ink-2">{def.recipient}</dd>
            <dt className="text-bz-muted">Built from</dt>
            <dd className="mono text-[11.5px] text-bz-ink-2">{def.builtIn}</dd>
          </dl>
          <p className="mt-4 text-[12.5px] text-bz-ink-2">
            The logo, colours and footer come from{" "}
            <Link href="/admin/content-assets/design" className="underline">
              Email design
            </Link>
            . Reusable wording for the body lives in{" "}
            <Link href="/admin/content-assets?view=outreach" className="underline">
              Outreach
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-bz-border bg-bz-surface-2 overflow-hidden xl:sticky xl:top-6">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-bz-border bg-bz-surface">
          <span className="text-[12px] text-bz-ink-2">With sample wording</span>
          <ViewportToggle value={viewport} onChange={setViewport} />
        </div>
        <InboxHeader from={from} replyTo={replyTo} to={to} subject={email.subject} />
        <EmailFrame html={email.html} viewport={viewport} title={`${def.label} preview`} className="py-4" />
      </div>
    </div>
  );
}
