import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 4c: advisor-note callout — left-rule moss block with a quoted
 * note from the lead advisor on the listing.
 *
 * Sprint 8 will introduce `properties.advisor_note`. Until then the page
 * synthesises one from the property short_description if present.
 */
export function AdvisorNote({
  note,
  advisorName,
}: {
  note: string;
  advisorName: string;
}) {
  return (
    <div className="border-l-2 border-bz-accent pl-6 py-2">
      <Eyebrow>Advisor&apos;s note</Eyebrow>
      <blockquote
        className="serif italic text-[20px] mt-3 leading-relaxed text-bz-ink max-w-[58ch]"
        style={{ letterSpacing: "-0.005em" }}
      >
        &ldquo;{note}&rdquo;
      </blockquote>
      <div className="mt-4 text-[12.5px] text-bz-muted">
        — {advisorName}
      </div>
    </div>
  );
}
