import { NewsletterSignup } from "@/app/[locale]/(public)/_components/newsletter-signup";
import type { ResolvedForm } from "@/lib/forms/types";

/**
 * The newsletter box under every article.
 *
 * Its words are the /insights hero box's: the eyebrow, heading and blurb from
 * the `featured` section of the Insights master page, and the button,
 * placeholder and confirmation from the `insights_newsletter` form — so one
 * edit in /admin/pages/master/insights or /admin/forms words both boxes, in
 * both languages. The page passes them in; this only lays them out.
 *
 * This took the place of `ArticleRail`, which was built for a sidebar the
 * article layout never had and was never mounted. Its signup card was the
 * part worth keeping; its author card repeated the byline in the header and
 * its copy was English literals.
 *
 * Switched off in the Forms Manager, the whole box goes — a heading inviting
 * people to subscribe above nothing would be worse than no box.
 */
export function ArticleNewsletter({
  form,
  eyebrow,
  heading,
  body,
}: {
  form: ResolvedForm;
  eyebrow: string;
  heading: string;
  body: string;
}) {
  if (!form.enabled) return null;
  return (
    <aside className="rounded-lg bg-bz-ink text-white p-6 md:p-8">
      <div className="text-[11px] uppercase tracking-widest text-white/60">
        {eyebrow}
      </div>
      <h2
        className="serif text-[24px] md:text-[28px] mt-3 leading-tight"
        style={{ letterSpacing: "-0.015em" }}
      >
        {heading}
      </h2>
      {body ? (
        <p className="mt-3 text-[14px] leading-relaxed text-white/70 max-w-[52ch]">
          {body}
        </p>
      ) : null}
      <div className="mt-5">
        <NewsletterSignup
          source="insights_article"
          variant="dark"
          form={form}
        />
      </div>
    </aside>
  );
}
