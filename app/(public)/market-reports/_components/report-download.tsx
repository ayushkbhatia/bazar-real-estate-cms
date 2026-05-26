"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyTypeSlug, Quarter } from "@/lib/queries/market-reports";

type Props = {
  area_slug: string;
  property_type: PropertyTypeSlug;
  quarter: Quarter;
};

export function ReportDownload({ area_slug, property_type, quarter }: Props) {
  const url = `/api/pdf/market-report?area=${encodeURIComponent(area_slug)}&type=${encodeURIComponent(property_type)}&quarter=${quarter.year}-q${quarter.q}`;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Download size={14} strokeWidth={1.6} />
        Download as PDF
      </a>
    </Button>
  );
}
