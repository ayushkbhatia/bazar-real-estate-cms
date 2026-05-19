import { Eyebrow } from "@/components/brand/eyebrow";

export default function SavedPage() {
  return (
    <div>
      <Eyebrow>Saved</Eyebrow>
      <h1
        className="serif text-[48px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Your saved properties.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        Coming in Phase 1 — properties you heart will appear here with price
        diffs, status changes, and recent activity.
      </p>
    </div>
  );
}
