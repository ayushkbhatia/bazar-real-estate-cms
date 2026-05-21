import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Commercial",
  description: "Commercial real estate — office, retail, and industrial.",
};

export default function CommercialPage() {
  return (
    <div className="px-12 py-24 max-w-[80ch]">
      <Eyebrow>Coming soon</Eyebrow>
      <h1
        className="serif text-[56px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Commercial real estate
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted">
        Office, retail, and industrial listings land later in Phase 1. For an
        opportunity to engage now, contact our advisory team directly.
      </p>
    </div>
  );
}
