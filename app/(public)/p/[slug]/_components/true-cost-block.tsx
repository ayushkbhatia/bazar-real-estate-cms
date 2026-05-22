import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";

/**
 * Sprint 4c: True cost of buying block. Itemises DLD 4% transfer +
 * trustee + Bazar 1.5% advisory + (optional) mortgage figure.
 * Numbers are derived inline; Sprint 12 swaps mortgage figure for a
 * real calculation against the `/tools/mortgage` engine.
 */
export function TrueCostBlock({ priceAed }: { priceAed: number }) {
  const dld = Math.round(priceAed * 0.04);
  const trustee = 4000;
  const advisory = Math.round(priceAed * 0.015);
  const total = dld + trustee + advisory;
  const cashTotal = priceAed + total;

  const rows: { label: string; value: number; note?: string }[] = [
    { label: "Listing price", value: priceAed, note: "AED" },
    { label: "DLD transfer fee (4%)", value: dld, note: "Government" },
    { label: "Trustee office fee", value: trustee, note: "Fixed" },
    {
      label: "Bazar advisory (1.5%)",
      value: advisory,
      note: "Buyer side, due on transfer",
    },
  ];

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-7">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-5">
        <div>
          <Eyebrow>True cost of buying</Eyebrow>
          <h3
            className="serif text-[24px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.012em" }}
          >
            What you&apos;ll actually pay.
          </h3>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/tools/mortgage">Run the mortgage calculator</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-bz-border">
        <table className="w-full text-[14px]">
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.label}
                className={
                  i === rows.length - 1
                    ? ""
                    : "border-b border-bz-border"
                }
              >
                <td className="px-4 py-3 text-bz-ink-2">
                  {r.label}
                  {r.note ? (
                    <span className="text-bz-muted text-[11.5px] ml-2">
                      {r.note}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right mono text-bz-ink">
                  AED {r.value.toLocaleString()}
                </td>
              </tr>
            ))}
            <tr className="bg-bz-ink text-bz-bg">
              <td className="px-4 py-3 font-medium">Total cash to close</td>
              <td className="px-4 py-3 text-right mono font-medium">
                AED {cashTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-bz-muted leading-relaxed">
        Estimate excludes mortgage fees (~1% bank + 0.25% DLD), NOC ({" "}
        <span className="mono">AED 500–5,000</span>), and conveyancing. Get a
        line-item breakdown from your advisor.
      </p>
    </div>
  );
}
