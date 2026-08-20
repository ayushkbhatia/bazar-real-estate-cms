import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getFooterForAdmin } from "@/lib/queries/footer";
import { FooterEditor } from "./_editor";

export const dynamic = "force-dynamic";

/**
 * The site footer, editable — copy, links, contact details, and the Arabic
 * for all of it.
 *
 * Sits beside /admin/megamenu under Content because they are the two pieces of
 * chrome mounted on every public page, and until now only one of them was
 * reachable: the footer's content lived in `const` arrays inside
 * `components/brand/public-footer.tsx`, so changing a phone number was a
 * deploy and translating a link was impossible.
 */
export default async function FooterAdminPage() {
  const footer = await getFooterForAdmin();
  const linkCount = footer.links.length;
  const translated = footer.links.filter((l) => l.label_ar?.trim()).length;

  return (
    <CmsShell
      title="Footer"
      breadcrumbs="Content · Footer"
      secondary={
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View on site <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          Everything below the page, on every public route. Each English field
          carries a collapsed Arabic box beneath it — a blank one shows the
          English in place rather than leaving a hole, so publishing is never
          blocked on translation.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {footer.columns.length}{" "}
          {footer.columns.length === 1 ? "column" : "columns"} · {linkCount}{" "}
          {linkCount === 1 ? "link" : "links"} ({translated} with Arabic) ·{" "}
          {footer.socials.length} social · {footer.contact.length} contact
        </div>

        <FooterEditor footer={footer} />
      </div>
    </CmsShell>
  );
}
