"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, LayoutGrid, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloorPlanViewer } from "./floor-plan-viewer";

type PanelKey = "photos" | "floor_plan";

/**
 * Gallery tab strip on the property detail page.
 *
 * Photos and Floor plan swap the panel below. **Map is not a panel** — it
 * scrolls to the Location section further down the page, which already
 * renders a real MapLibre embed on the listing's coordinates. It used to
 * open a fourth panel drawing a `map · mapbox · sprint 12` placeholder, so
 * the page showed an empty grey box while a working map sat below it.
 *
 * Video and Virtual tour are gone entirely: both roles exist in
 * `property_media_role` but nothing in the admin ever wrote one, so the tabs
 * only ever rendered "no walk-through video uploaded yet" copy naming an
 * unshipped sprint.
 */
export function GalleryTabs({
  children,
  floorPlanUrl,
  reference,
}: {
  children: React.ReactNode;
  /** The uploaded floor plan (media role `floor_plan`), or null. */
  floorPlanUrl?: string | null;
  reference: string;
}) {
  // `property` is on CLIENT_NAMESPACES, so this crosses to the browser
  // already — the tab labels were simply never wired to it.
  const t = useTranslations("property");
  const [active, setActive] = useState<PanelKey>("photos");

  function scrollToLocation() {
    document
      .getElementById("location")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="px-4 md:px-12">
      <div className="border-b border-bz-border flex gap-5 mb-4 overflow-x-auto">
        {/* The tablist holds only real tabs. Map is a jump link, and a
            `role="tablist"` whose children aren't all `role="tab"` fails
            axe's aria-required-children — so it sits outside the group
            rather than inside it pretending to be a tab. */}
        <div role="tablist" aria-label={t("floorPlan.tabs")} className="flex gap-5">
          <TabButton
            icon={Camera}
            label={t("floorPlan.photos")}
            isActive={active === "photos"}
            onClick={() => setActive("photos")}
          />
          <TabButton
            icon={LayoutGrid}
            label={t("floorPlan.heading")}
            isActive={active === "floor_plan"}
            onClick={() => setActive("floor_plan")}
          />
        </div>
        <button
          type="button"
          onClick={scrollToLocation}
          className="py-2.5 inline-flex items-center gap-1.5 text-[13.5px] border-b-2 -mb-px border-transparent text-bz-muted hover:text-bz-ink-2 transition-colors"
        >
          <Map size={13} strokeWidth={1.7} />
          Map
        </button>
      </div>

      {active === "photos" ? (
        children
      ) : (
        <FloorPlanPanel url={floorPlanUrl ?? null} reference={reference} />
      )}
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "py-2.5 inline-flex items-center gap-1.5 text-[13.5px] border-b-2 -mb-px transition-colors",
        isActive
          ? "border-bz-teal text-bz-teal"
          : "border-transparent text-bz-muted hover:text-bz-ink-2",
      )}
    >
      <Icon size={13} strokeWidth={1.7} />
      {label}
    </button>
  );
}

function FloorPlanPanel({
  url,
  reference,
}: {
  url: string | null;
  reference: string;
}) {
  if (!url) {
    return (
      <div className="rounded-lg border border-bz-border bg-bz-surface aspect-[16/9] flex items-center justify-center">
        <p className="text-[13.5px] text-bz-muted text-center max-w-[42ch] px-6">
          No floor plan attached to this listing yet. Enquire and the advisor
          will send one back.
        </p>
      </div>
    );
  }
  return (
    <FloorPlanViewer
      src={url}
      alt={`Floor plan for ${reference}`}
      // Full width of the tab strip's own container — `px-4 md:px-12`, no max
      // width on the page. Measured 1344px at a 1440 viewport.
      sizes="(min-width: 768px) calc(100vw - 96px), calc(100vw - 32px)"
    />
  );
}
