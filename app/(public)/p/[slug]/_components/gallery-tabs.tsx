"use client";

import { useState } from "react";
import { Camera, LayoutGrid, Video, Eye, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

type TabKey = "photos" | "floor_plan" | "video" | "virtual_tour" | "map";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "photos", label: "Photos", icon: Camera },
  { key: "floor_plan", label: "Floor plan", icon: LayoutGrid },
  { key: "video", label: "Video", icon: Video },
  { key: "virtual_tour", label: "Virtual tour", icon: Eye },
  { key: "map", label: "Map", icon: Map },
];

/**
 * Sprint 4c (backfilled): gallery tab strip on the property detail page.
 * Sits above the gallery and switches between Photos / Floor plan /
 * Video / Virtual tour / Map views.
 *
 * `children` is the active panel — typically the existing 5-tile gallery
 * for the photos tab. The other tabs render placeholder copy until
 * Sprint 7c (Media tab) seeds floor plans + video URLs into the
 * property_media table.
 */
export function GalleryTabs({
  children,
  hasFloorPlan,
  hasVideo,
  hasVirtualTour,
}: {
  children: React.ReactNode;
  hasFloorPlan?: boolean;
  hasVideo?: boolean;
  hasVirtualTour?: boolean;
}) {
  const [active, setActive] = useState<TabKey>("photos");

  return (
    <div className="px-12">
      <div
        role="tablist"
        aria-label="Gallery views"
        className="border-b border-bz-border flex gap-5 mb-4"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          const available =
            key === "photos" ||
            (key === "floor_plan" && hasFloorPlan) ||
            (key === "video" && hasVideo) ||
            (key === "virtual_tour" && hasVirtualTour) ||
            key === "map";
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(key)}
              className={cn(
                "py-2.5 inline-flex items-center gap-1.5 text-[13.5px] border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-bz-ink text-bz-ink"
                  : "border-transparent text-bz-muted hover:text-bz-ink-2",
              )}
            >
              <Icon size={13} strokeWidth={1.7} />
              {label}
              {!available ? (
                <span className="text-[10px] mono text-bz-muted ml-1">·</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {active === "photos" ? (
        children
      ) : active === "floor_plan" ? (
        <FloorPlanPanel hasFloorPlan={hasFloorPlan} />
      ) : active === "video" ? (
        <VideoPanel hasVideo={hasVideo} />
      ) : active === "virtual_tour" ? (
        <VirtualTourPanel hasVirtualTour={hasVirtualTour} />
      ) : (
        <MapPanel />
      )}
    </div>
  );
}

function FloorPlanPanel({ hasFloorPlan }: { hasFloorPlan?: boolean }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface aspect-[16/9] flex items-center justify-center">
      {hasFloorPlan ? (
        <PlaceholderImage
          label="floor plan"
          className="w-full h-full rounded-lg"
        />
      ) : (
        <p className="text-[13.5px] text-bz-muted text-center max-w-[42ch]">
          The advisor hasn&apos;t uploaded a floor plan yet. Send a brief and
          we&apos;ll attach one to the reply.
        </p>
      )}
    </div>
  );
}

function VideoPanel({ hasVideo }: { hasVideo?: boolean }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface-2 aspect-[16/9] flex items-center justify-center text-bz-muted text-[13.5px]">
      {hasVideo
        ? "Video tour loading…"
        : "No walk-through video uploaded yet. Sprint 7c adds video uploads to the property editor."}
    </div>
  );
}

function VirtualTourPanel({
  hasVirtualTour,
}: {
  hasVirtualTour?: boolean;
}) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface-2 aspect-[16/9] flex items-center justify-center text-bz-muted text-[13.5px]">
      {hasVirtualTour
        ? "Virtual tour loading…"
        : "No virtual tour uploaded yet. Matterport-style embeds activate once the URL field lands in Sprint 7c."}
    </div>
  );
}

function MapPanel() {
  return (
    <PlaceholderImage
      label="map · mapbox · sprint 12"
      className="w-full aspect-[16/9] rounded-lg"
    />
  );
}
