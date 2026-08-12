import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getForm } from "@/lib/queries/forms";
import { MortgageCalculator } from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage calculator",
  description:
    "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
};

export default async function MortgagePage() {
  // Resolved here rather than inside the calculator because `getForm` is a
  // server read and the calculator is a client component — a `ResolvedForm` is
  // plain JSON and crosses the boundary intact, the same way the dialogs do it.
  const preApprovalForm = await getForm("mortgage_preapproval");

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-6">
        <Eyebrow>For buyers and investors</Eyebrow>
        <h1
          className="serif text-[36px] md:text-[64px] font-normal mt-3 leading-[1.0] max-w-[16ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          What will this property actually{" "}
          <em className="italic">cost you?</em>
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          The number you see on a listing is rarely the number you pay. This
          calculator includes everything: transfer fees, advisory, mortgage
          fees, and the full cash needed to close.
        </p>
      </section>

      <MortgageCalculator preApprovalForm={preApprovalForm} />
    </div>
  );
}
