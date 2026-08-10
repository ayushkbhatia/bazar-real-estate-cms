import { isPhoneRequest } from "@/lib/device";
import type { SearchView } from "./view-toggle";

const ALLOWED_VIEWS: readonly SearchView[] = ["grid", "list", "map"];

/**
 * Resolve which of grid / list / map a search route should render.
 *
 * The `view` search param always wins when it names a real view — a link
 * shared from a phone keeps showing list on a desktop, and vice versa.
 * With no param we pick the default from the device: a phone gets `list`,
 * because a 375px column of 4:3 grid cards is a lot of scrolling for very
 * few listings, while every wider viewport keeps `grid`.
 *
 * `defaultView` comes back alongside `view` because `ViewToggle` needs it
 * too: it renders the default as selected when the param is absent, and it
 * clears the param (rather than writing it) when you pick the default back.
 * If the toggle assumed `grid` there, tapping "Grid" on a phone would strip
 * `?view=` and land right back on the list — a dead button.
 */
export async function resolveSearchView(
  raw: Record<string, string | string[] | undefined>,
): Promise<{ view: SearchView; defaultView: SearchView }> {
  const defaultView: SearchView = (await isPhoneRequest()) ? "list" : "grid";
  const v = typeof raw.view === "string" ? raw.view : null;
  const view: SearchView = ALLOWED_VIEWS.includes(v as SearchView)
    ? (v as SearchView)
    : defaultView;
  return { view, defaultView };
}
