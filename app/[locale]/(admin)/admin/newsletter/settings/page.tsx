import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { env } from "@/lib/env";
import { emailSender, resendSendingDomains } from "@/lib/email";
import { ownSenderDomains, ownVerifiedDomains } from "@/lib/newsletter/sender";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { readNewsletterSender, readNewsletterSenderSettings } from "@/lib/newsletter/sender-read";
import { campaignCount, subscriberCounts } from "../_data";
import { NewsletterTabs } from "../_shared";
import { SenderForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewsletterSettingsPage() {
  await requireRole(STAFF_ROLES);
  const [role, counts, campaigns, settings, effective, domains] = await Promise.all([
    getStaffRole(),
    subscriberCounts(),
    campaignCount(),
    readNewsletterSenderSettings(),
    readNewsletterSender(),
    resendSendingDomains(),
  ]);
  const canEdit = role !== null && (NEWSLETTER_SEND_ROLES as readonly string[]).includes(role);
  const site = emailSender();

  return (
    <CmsShell title="Newsletter" breadcrumbs="Content · Newsletter · Sender">
      <div className="flex flex-col gap-6 max-w-[760px]">
        <NewsletterTabs active="settings" counts={{ campaigns, confirmed: counts.confirmed }} />
        <SenderForm
          initial={{
            from_name: settings?.from_name ?? "",
            from_address: settings?.from_address ?? "",
            reply_to: settings?.reply_to ?? "",
          }}
          effective={effective}
          canEdit={canEdit}
          domains={domains.status === "ok" ? ownVerifiedDomains(domains.domains, env.RESEND_FROM_ADDRESS) : null}
          ownDomains={ownSenderDomains(env.RESEND_FROM_ADDRESS)}
          domainsUnavailable={domains.status === "unavailable" ? domains.reason : null}
        />
        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 text-[12.5px] text-bz-ink-2 flex flex-col gap-1.5">
          <p className="font-medium text-bz-ink">Every other email the site sends</p>
          <p>
            Enquiry replies, confirmations, password links and the rest keep the site&apos;s own sender — this page only
            changes newsletters.
          </p>
          <dl className="grid grid-cols-[90px_1fr] gap-y-1 mt-1">
            <dt className="text-bz-muted">From</dt>
            <dd className="mono break-all">{site.from}</dd>
            <dt className="text-bz-muted">Reply-To</dt>
            <dd className="mono break-all">{site.replyTo}</dd>
          </dl>
        </section>
      </div>
    </CmsShell>
  );
}
