"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

/**
 * MapLibre's own UI strings, in the visitor's language — for the map
 * constructor's `locale` option.
 *
 * MapLibre ships these in English and draws them itself: the "Use ⌘ + scroll to
 * zoom the map" overlay that `cooperativeGestures` shows, and the titles and
 * accessible names of the zoom and attribution buttons. On `/ar` they were the
 * last English on the search page. The English values are MapLibre's own
 * defaults, so an English map renders exactly what it did before.
 *
 * Only the controls the public maps add are listed; a key left out falls back
 * to MapLibre's English.
 */
export function useMapUiStrings(): Record<string, string> {
  const t = useTranslations("common");
  return useMemo(
    () => ({
      "Map.Title": t("mapControls.title"),
      "Marker.Title": t("mapControls.marker"),
      "NavigationControl.ZoomIn": t("mapControls.zoomIn"),
      "NavigationControl.ZoomOut": t("mapControls.zoomOut"),
      "NavigationControl.ResetBearing": t("mapControls.resetBearing"),
      "AttributionControl.ToggleAttribution": t("mapControls.toggleAttribution"),
      "Popup.Close": t("mapControls.closePopup"),
      "CooperativeGesturesHandler.WindowsHelpText": t("mapControls.ctrlScroll"),
      "CooperativeGesturesHandler.MacHelpText": t("mapControls.cmdScroll"),
      "CooperativeGesturesHandler.MobileHelpText": t("mapControls.twoFingers"),
    }),
    [t],
  );
}
