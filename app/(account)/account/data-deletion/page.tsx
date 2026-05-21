import Link from "next/link";
import type { Metadata } from "next";
import { AlertOctagon } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { RequestDeletionForm } from "./_form";

export const metadata: Metadata = {
  title: "Delete my account",
  description:
    "Permanently delete your Bazar account and anonymise your data, per UAE PDPL.",
};

export default function DataDeletionPage() {
  return (
    <div className="max-w-[640px]">
      <Eyebrow>Privacy</Eyebrow>
      <h1
        className="serif text-[40px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Delete my account.
      </h1>
      <p className="mt-3 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        Under UAE PDPL, you can request that Bazar delete the personal data
        held about your account. We&apos;ll send a confirmation email; once
        confirmed, this is what happens:
      </p>

      <div className="mt-6 flex gap-3 items-start p-4 rounded-lg border border-[oklch(0.85_0.05_28)] bg-[oklch(0.98_0.02_28)]">
        <AlertOctagon
          size={18}
          strokeWidth={1.6}
          className="text-[oklch(0.45_0.13_28)] flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="text-[13.5px] text-bz-ink leading-snug">
          <p className="font-medium">This cannot be undone.</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-bz-ink-2 list-disc pl-5">
            <li>
              Your <b>saved properties</b> and <b>saved searches</b> are
              hard-deleted.
            </li>
            <li>
              Your <b>enquiries</b>, <b>viewings</b>, and{" "}
              <b>message bodies</b> are anonymised — the audit row stays so
              UAE AML rules are still satisfied, but the contents are wiped.
            </li>
            <li>
              Your <b>newsletter subscription</b> is set to unsubscribed and
              the email is replaced with a redacted placeholder.
            </li>
            <li>
              Your <b>sign-in is disabled</b>; the email cannot be used to
              sign in again. You can create a new account with the same
              address.
            </li>
            <li>
              <b>KYC documents</b> tied to closed transactions are retained
              for seven years under UAE AML/CFT rules. To request earlier
              removal where law permits, email{" "}
              <a className="underline" href="mailto:dpo@bazar.ae">
                dpo@bazar.ae
              </a>
              .
            </li>
          </ul>
        </div>
      </div>

      <RequestDeletionForm />

      <p className="mt-10 text-[12px] text-bz-muted">
        Want a copy of your data first? See{" "}
        <Link href="/account/data-export" className="underline text-bz-ink">
          /account/data-export
        </Link>
        .
      </p>
    </div>
  );
}
