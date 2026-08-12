import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { confirmNewsletterToken } from "../../../_actions/newsletter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm subscription — Bazar",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function ConfirmPage({ params }: PageProps) {
  const { token } = await params;
  const result = await confirmNewsletterToken(token);

  return (
    <section className="px-12 py-24 max-w-[640px] mx-auto text-center">
      <Eyebrow>Newsletter</Eyebrow>

      {result.status === "ok" ? (
        <>
          <h1
            className="serif text-[48px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.05 }}
          >
            You&apos;re in.
          </h1>
          <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
            We&apos;ve confirmed <span className="mono">{result.email}</span>.
            The first Bazar Brief lands in your inbox next Wednesday.
          </p>
          <div className="mt-10 flex gap-3 justify-center">
            <Button asChild>
              <Link href="/insights">Read recent insights</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/buy">Browse marketplace</Link>
            </Button>
          </div>
        </>
      ) : result.status === "expired" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            This link has expired.
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            Confirmation links are valid for 14 days. Please subscribe again
            and watch your inbox.
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">Back to Insights</Link>
            </Button>
          </div>
        </>
      ) : result.status === "not_found" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            We couldn&apos;t find that link.
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            It may already have been used. Try subscribing again from the
            Insights page.
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">Back to Insights</Link>
            </Button>
          </div>
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
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">Back to Insights</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
