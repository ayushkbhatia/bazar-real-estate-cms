import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { unsubscribeNewsletterToken } from "../../../_actions/newsletter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribed — Bazar",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params;
  const result = await unsubscribeNewsletterToken(token);

  return (
    <section className="px-12 py-24 max-w-[640px] mx-auto text-center">
      <Eyebrow>Newsletter</Eyebrow>
      {result.status === "ok" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            You&apos;ve been removed.
          </h1>
          <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
            <span className="mono">{result.email}</span> won&apos;t receive the
            Bazar Brief any more. We&apos;re sorry to see you go.
          </p>
        </>
      ) : result.status === "not_found" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            Already removed.
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            This link is no longer active. If you&apos;re still receiving
            emails, contact us at hello@bazar.ae.
          </p>
        </>
      ) : (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            Something went wrong.
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            {result.message}
          </p>
        </>
      )}
      <div className="mt-10">
        <Button asChild>
          <Link href="/insights">Back to Insights</Link>
        </Button>
      </div>
    </section>
  );
}
