import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";

// searchParams.reason needs to be readable per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account deleted",
  description: "Your Bazar account has been deleted.",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AccountDeletedPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;

  const failure = reason && reason !== "ok"
    ? reason === "expired"
      ? "This confirmation link has expired. Email info@bazarrealestate.ae to request deletion again."
      : reason === "already_used"
        ? "This link has already been used. If you didn't expect this, contact dpo@bazar.ae."
        : reason === "not_found"
          ? "We couldn't find this request — the link may have been mistyped."
          : "We couldn't complete the deletion. Please try again or contact dpo@bazar.ae."
    : null;

  return (
    <section className="px-12 py-24 max-w-[640px] mx-auto text-center">
      <Eyebrow>Privacy</Eyebrow>
      {failure ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            We couldn&apos;t complete the deletion.
          </h1>
          <p className="mt-6 text-[15.5px] text-bz-ink-2 leading-relaxed">
            {failure}
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/">Back to the marketplace</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1
            className="serif text-[48px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.05 }}
          >
            Your account has been deleted.
          </h1>
          <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
            We&apos;ve anonymised the records we&apos;re required to retain
            under UAE AML/CFT rules and hard-deleted everything else. The
            email address can be re-registered if you change your mind.
          </p>
          <p className="mt-4 text-[13px] text-bz-muted leading-relaxed">
            Questions or concerns?{" "}
            <a className="underline text-bz-ink" href="mailto:dpo@bazar.ae">
              dpo@bazar.ae
            </a>
          </p>
          <div className="mt-10 flex gap-3 justify-center">
            <Button asChild>
              <Link href="/">Back to the marketplace</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
