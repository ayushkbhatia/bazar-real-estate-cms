import { Eyebrow } from "@/components/brand/eyebrow";
import { getMyNewsletterSubscription } from "@/lib/queries/newsletter";
import { getSessionUser } from "@/lib/supabase/server";
import { ResubscribeForm } from "./_resubscribe-form";
import { UnsubscribeButton } from "./_unsubscribe-button";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  confirmed: {
    title: "You're subscribed.",
    body: "You'll receive the Bazar Brief every Wednesday morning.",
  },
  pending: {
    title: "Almost there.",
    body: "We sent a confirmation email — click the link inside to start receiving the Brief.",
  },
  unsubscribed: {
    title: "Not currently subscribed.",
    body: "You unsubscribed previously. You can resubscribe below at any time.",
  },
  bounced: {
    title: "We couldn't reach your inbox.",
    body: "Your email address bounced. Confirm the address below and we'll try again.",
  },
};

export default async function AccountNewsletterPage() {
  const user = await getSessionUser();
  const sub = await getMyNewsletterSubscription();

  const status = sub?.status ?? null;
  const copy = status ? STATUS_COPY[status] : null;

  return (
    <div className="max-w-[640px]">
      <Eyebrow>Newsletter</Eyebrow>
      <h1
        className="serif text-[40px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        The Bazar Brief.
      </h1>
      <p className="mt-3 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        Long-form market analysis, advisor field notes, and the occasional
        contrarian take. One email every Wednesday.
      </p>

      <div className="mt-10 border border-bz-border rounded-lg p-6 bg-bz-surface">
        {copy ? (
          <>
            <h2
              className="serif text-[24px] font-normal"
              style={{ letterSpacing: "-0.015em" }}
            >
              {copy.title}
            </h2>
            <p className="mt-2 text-[14.5px] text-bz-ink-2 leading-relaxed">
              {copy.body}
            </p>

            <dl className="mt-5 text-[12.5px] grid grid-cols-2 gap-y-1.5 max-w-md">
              <dt className="text-bz-muted">Email</dt>
              <dd className="mono">{sub?.email}</dd>
              <dt className="text-bz-muted">Subscribed since</dt>
              <dd>{fmt(sub?.subscribed_at ?? null)}</dd>
              {sub?.confirmed_at ? (
                <>
                  <dt className="text-bz-muted">Confirmed</dt>
                  <dd>{fmt(sub.confirmed_at)}</dd>
                </>
              ) : null}
              {sub?.unsubscribed_at ? (
                <>
                  <dt className="text-bz-muted">Unsubscribed</dt>
                  <dd>{fmt(sub.unsubscribed_at)}</dd>
                </>
              ) : null}
            </dl>

            <div className="mt-6">
              {status === "confirmed" ? (
                <UnsubscribeButton />
              ) : status === "pending" ? (
                <p className="text-[12.5px] text-bz-muted">
                  Didn&apos;t get the email? Check spam, or resend below.
                  <ResubscribeForm defaultEmail={sub!.email} />
                </p>
              ) : (
                <ResubscribeForm defaultEmail={sub!.email} />
              )}
            </div>
          </>
        ) : (
          <>
            <h2
              className="serif text-[24px] font-normal"
              style={{ letterSpacing: "-0.015em" }}
            >
              You&apos;re not subscribed yet.
            </h2>
            <p className="mt-2 text-[14.5px] text-bz-ink-2 leading-relaxed">
              We&apos;ll send a confirmation email and never share your address.
            </p>
            <ResubscribeForm defaultEmail={user?.email ?? ""} />
          </>
        )}
      </div>
    </div>
  );
}
