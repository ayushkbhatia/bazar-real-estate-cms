import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import { emailSiteUrl } from "@/lib/email-templates";
import { NEWSLETTER_WRITE_ROLES, renderNewsletter } from "@/lib/newsletter/campaign";
import { designFeatureHtml, normaliseDesign } from "@/lib/newsletter/blocks/document";
import { BUILT_IN_TEMPLATES } from "@/lib/newsletter/blocks/templates";
import { featureDrawer, newsletterFeatures } from "@/lib/newsletter/features";
import { campaignCount, savedTemplates, subscriberCounts } from "../_data";
import { NewsletterTabs, formatDubai } from "../_shared";
import { TemplateCard } from "./_template-card";

export const dynamic = "force-dynamic";

export default async function NewsletterTemplatesPage() {
  await requireRole(STAFF_ROLES);
  const [role, counts, campaigns, templates, brand] = await Promise.all([
    getStaffRole(),
    subscriberCounts(),
    campaignCount(),
    savedTemplates(),
    readEmailBrand(),
  ]);
  const canWrite = role !== null && (NEWSLETTER_WRITE_ROLES as readonly string[]).includes(role);

  // Each saved template drawn as the email it starts, in English.
  const cards = await Promise.all(
    templates.map(async (t) => {
      const design = normaliseDesign(t.design);
      const found = await newsletterFeatures([designFeatureHtml(design)], "en");
      const email = renderNewsletter(
        { format: "blocks", design, subject: t.subject, preheader: "", body: "", subject_ar: t.subject_ar, preheader_ar: "", body_ar: "" },
        {
          brand,
          locale: "en",
          unsubscribeUrl: `${emailSiteUrl()}/newsletter/unsubscribe/preview`,
          features: (l) => featureDrawer(found, brand, l),
        },
      );
      return { ...t, html: email.html, blocks: design.blocks.length, arabic: Boolean(t.subject_ar.trim()) };
    }),
  );

  return (
    <CmsShell title="Newsletter" breadcrumbs="Content · Newsletter · Templates">
      <div className="flex flex-col gap-6">
        <NewsletterTabs active="templates" counts={{ campaigns, confirmed: counts.confirmed, templates: templates.length }} />
        <p className="text-[12.5px] text-bz-muted max-w-[80ch]">
          Templates your team saved from a block-built newsletter (<strong>Save as template</strong> in the editor).
          Start a newsletter from one under <strong>New newsletter</strong>, or here. Bazar&apos;s own —{" "}
          {BUILT_IN_TEMPLATES.map((t) => t.label).join(", ")} — are always there too, filled from the live site when
          you use them.
        </p>
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bz-border p-10 text-center">
            <p className="serif text-[22px]">No saved templates yet</p>
            <p className="mt-2 text-[13px] text-bz-muted max-w-[56ch] mx-auto">
              Build a newsletter from blocks — start from Project launch, say — make it yours, then press{" "}
              <strong>Save as template</strong>. It will be here, and in New newsletter, for the next one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((t) => (
              <TemplateCard
                key={t.id}
                id={t.id}
                name={t.name}
                description={t.description}
                html={t.html}
                meta={`${t.blocks} block${t.blocks === 1 ? "" : "s"}${t.arabic ? " · English + Arabic" : ""} · edited ${formatDubai(t.updated_at)}`}
                canWrite={canWrite}
              />
            ))}
          </div>
        )}
      </div>
    </CmsShell>
  );
}
