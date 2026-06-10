import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { NewsletterSignup } from "@/app/(public)/_components/newsletter-signup";

/**
 * Sprint 5d (backfilled): right rail on the article detail page.
 * Two cards stacked: "Talk to the author" (links to agent profile +
 * mail) and "Subscribe to the Brief" newsletter signup.
 */
export function ArticleRail({
  author,
}: {
  author: {
    display_name: string;
    title: string | null;
    slug: string;
  } | null;
}) {
  return (
    <aside className="sticky top-6 w-full md:w-[240px] flex-shrink-0 flex flex-col gap-4">
      {author ? (
        <div className="rounded-lg border border-bz-border bg-bz-surface p-5">
          <Eyebrow>Talk to the author</Eyebrow>
          <Link
            href={`/agents/${author.slug}`}
            className="block mt-3 flex flex-col items-start gap-3"
          >
            <PlaceholderImage
              label={author.slug}
              className="w-16 h-16 rounded-full flex-shrink-0"
            />
            <div>
              <div className="text-[14px] font-medium text-bz-ink">
                {author.display_name}
              </div>
              {author.title ? (
                <div className="text-[12px] text-bz-muted mt-0.5">
                  {author.title}
                </div>
              ) : null}
            </div>
          </Link>
          <div className="mt-4 flex flex-col gap-1.5 text-[12px]">
            <Link
              href={`/agents/${author.slug}`}
              className="text-bz-ink-2 hover:text-bz-accent underline underline-offset-2"
            >
              View advisor profile
            </Link>
            <Link
              href={`/contact?to=${author.slug}`}
              className="text-bz-ink-2 hover:text-bz-accent underline underline-offset-2"
            >
              Send a brief
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg bg-bz-ink text-white p-5">
        <Eyebrow className="text-white/60">Subscribe to the brief</Eyebrow>
        <h4
          className="serif text-[18px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.01em" }}
        >
          One email every Wednesday.
        </h4>
        <p className="mt-2 text-[12px] text-white/70 leading-relaxed">
          Field notes, the weekly Abu Dhabi index, and one chart worth
          sitting with.
        </p>
        <div className="mt-4">
          <NewsletterSignup source="insights_article" variant="dark" />
        </div>
      </div>
    </aside>
  );
}
