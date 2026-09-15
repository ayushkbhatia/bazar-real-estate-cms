"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmailViewport = "desktop" | "mobile";

const WIDTH: Record<EmailViewport, number> = { desktop: 620, mobile: 375 };

/**
 * The email as an inbox would draw it.
 *
 * An iframe, not a <div dangerouslySetInnerHTML>: the email is a whole HTML
 * document with its own <body> background, and injected into the admin page
 * it would inherit the CMS's fonts and resets and look like neither the admin
 * nor an inbox. `srcDoc` gives it a document of its own.
 *
 * Sandboxed with no scripts. `allow-same-origin` is there only so the frame
 * can be measured and sized to its content — with scripts disallowed, same
 * origin grants the email nothing it could use, and the HTML has already been
 * through the email allowlist besides. Links do not navigate: a preview is not
 * the place to click a real unsubscribe link.
 */
export function EmailFrame({
  html,
  viewport,
  title,
  className,
  minHeight = 320,
}: {
  html: string;
  viewport: EmailViewport;
  title: string;
  className?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.body) return;
    // The body, not the document: the document is never shorter than the
    // frame, so measuring it could only ever grow the preview.
    setHeight(Math.max(minHeight, doc.body.scrollHeight));
  }, [minHeight]);

  const onLoad = useCallback(() => {
    measure();
    // A logo or an inline image changes the height once it arrives.
    const doc = ref.current?.contentDocument;
    doc?.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });
  }, [measure]);

  useEffect(() => {
    // The width animates, and text reflows as it does.
    const t = window.setTimeout(measure, 240);
    return () => window.clearTimeout(t);
  }, [viewport, measure]);

  return (
    <div className={cn("flex justify-center overflow-x-auto", className)}>
      <iframe
        ref={ref}
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={onLoad}
        style={{ width: WIDTH[viewport], height }}
        className="block max-w-full border-0 bg-white transition-[width] duration-200"
      />
    </div>
  );
}

export function ViewportToggle({
  value,
  onChange,
}: {
  value: EmailViewport;
  onChange: (v: EmailViewport) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Preview width"
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {(
        [
          ["desktop", Monitor, "Desktop"],
          ["mobile", Smartphone, "Phone"],
        ] as const
      ).map(([v, Icon, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={label}
          title={label}
          className={cn(
            "h-6 w-7 inline-flex items-center justify-center rounded transition-colors",
            value === v ? "bg-bz-navy text-bz-bg" : "text-bz-ink-2 hover:text-bz-ink",
          )}
        >
          <Icon size={12} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

/** The envelope above the message: who it is from, to, and about what. */
export function InboxHeader({
  from,
  replyTo,
  to,
  subject,
}: {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
}) {
  return (
    <div className="px-4 py-3 border-b border-bz-border bg-bz-surface text-[12px] leading-relaxed">
      <div className="text-[14px] font-medium text-bz-ink break-words">
        {subject || <span className="text-bz-muted italic">No subject</span>}
      </div>
      <dl className="mt-1.5 grid grid-cols-[64px_1fr] gap-x-2 text-bz-muted">
        <dt>From</dt>
        <dd className="text-bz-ink-2 break-all">{from}</dd>
        <dt>Reply-to</dt>
        <dd className="text-bz-ink-2 break-all">{replyTo}</dd>
        <dt>To</dt>
        <dd className="text-bz-ink-2 break-all">{to}</dd>
      </dl>
    </div>
  );
}
