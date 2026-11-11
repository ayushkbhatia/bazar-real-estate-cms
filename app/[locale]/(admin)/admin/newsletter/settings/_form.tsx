"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { domainOf, formatFrom, type NewsletterSender, type NewsletterSenderSettings } from "@/lib/newsletter/sender";
import { saveSenderSettings } from "./_actions";

const INPUT = "w-full border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent disabled:opacity-60";
const FIELD_ERROR = "text-[11.5px] text-[oklch(0.45_0.13_28)]";

export function SenderForm({
  initial,
  effective,
  canEdit,
  domains,
  domainsUnavailable,
}: {
  initial: NewsletterSenderSettings;
  /** What a newsletter carries right now, env fallbacks included. */
  effective: NewsletterSender;
  canEdit: boolean;
  /** Resend's verified sending domains, or null when Resend can't be asked here. */
  domains: string[] | null;
  domainsUnavailable: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const domain = values.from_address.includes("@") ? domainOf(values.from_address) : "";
  const unverified = Boolean(domains && domain && !domains.includes(domain));

  function set<K extends keyof NewsletterSenderSettings>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function save() {
    start(async () => {
      const r = await saveSenderSettings(values);
      if (r.status === "error") {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      router.refresh();
    });
  }

  const field = (key: keyof NewsletterSenderSettings, label: string, hint: string, placeholder: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-bz-ink-2">{label}</span>
      <input
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        disabled={!canEdit}
        placeholder={placeholder}
        className={cn(INPUT, errors[key] ? "border-[oklch(0.6_0.15_28)]" : "border-bz-border")}
      />
      {errors[key] ? <span className={FIELD_ERROR}>{errors[key]}</span> : <span className="text-[11.5px] text-bz-muted">{hint}</span>}
    </label>
  );

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
      <div>
        <Eyebrow>Newsletter sender</Eyebrow>
        <p className="mt-1 text-[12.5px] text-bz-muted max-w-[70ch]">
          The name and address subscribers see a newsletter come from, and where their replies go. Used by every
          newsletter, scheduled ones included, and by &ldquo;Send me a test&rdquo;.
        </p>
      </div>

      {field("from_name", "From name", "The name inboxes show beside the subject.", "Marketing at Bazar")}
      {field(
        "from_address",
        "From address",
        domains
          ? `Must be on a domain verified in Resend: ${domains.join(", ") || "none yet"}.`
          : "Must be on a domain verified in Resend.",
        "marketing@bazarrealestate.com",
      )}
      {unverified && !errors.from_address ? (
        <p className="-mt-2 rounded border border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.03_80)] px-3 py-2 text-[12px] text-[oklch(0.4_0.08_60)]">
          {`${domain} isn't verified in Resend, so it can't be saved:`} Resend would refuse every newsletter from
          it. Add the domain in Resend, set the DNS records it lists at your domain registrar, wait for it to show
          Verified, then save here.
        </p>
      ) : null}
      {domainsUnavailable ? (
        <p className="-mt-2 text-[11.5px] text-bz-muted">
          Resend can&apos;t be asked which domains are verified here ({domainsUnavailable}).
        </p>
      ) : null}
      {field("reply_to", "Reply-To", "Where a subscriber's reply lands. Any address — it needn't be verified.", "marketing@bazarrealestate.ae")}

      <div className="rounded-md border border-bz-border bg-bz-surface-2 px-3 py-2.5 text-[12.5px]">
        <p className="text-[11.5px] text-bz-muted mb-1">{dirty ? "After saving, newsletters will show" : "Newsletters currently show"}</p>
        <dl className="grid grid-cols-[80px_1fr] gap-y-1">
          <dt className="text-bz-muted">From</dt>
          <dd className="mono break-all">
            {dirty && values.from_address.trim() ? formatFrom(values.from_name, values.from_address.trim()) : effective.from}
          </dd>
          <dt className="text-bz-muted">Reply-To</dt>
          <dd className="mono break-all">{dirty && values.reply_to.trim() ? values.reply_to.trim() : effective.replyTo}</dd>
        </dl>
      </div>

      {canEdit ? (
        <Button onClick={save} disabled={busy || !dirty || unverified} className="self-start">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.8} />}
          Save sender
        </Button>
      ) : (
        <p className="text-[12px] text-bz-muted">Only admins and marketing can change the sender.</p>
      )}
    </section>
  );
}
