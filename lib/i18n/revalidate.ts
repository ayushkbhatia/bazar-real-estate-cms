import { revalidatePath } from "next/cache";
import { LOCALES, revalidateKey } from "./locales";

/**
 * Revalidate a locale-agnostic public path across every enabled locale.
 *
 * Every `revalidatePath()` call naming a PUBLIC route must go through here.
 * `lib/i18n/revalidate.test.ts` fails the build otherwise.
 *
 * Why this exists a whole phase before Arabic does: once the `[locale]`
 * segment lands, Next prerenders the English `/buy` to `/en/buy`, so a bare
 * `revalidatePath("/buy")` names a cache key that no longer exists. It does
 * not throw — it silently no-ops. The CMS shows a success toast, the public
 * page keeps serving stale content, and it reads as a caching bug for a week.
 * There are 193 `revalidatePath` calls in this repo and zero `revalidateTag`,
 * so this is the entire cache-invalidation surface of the product.
 *
 * Admin paths deliberately keep calling `revalidatePath` directly — `/admin`
 * is pinned to English and never gains a locale segment.
 */
export function revalidateLocalised(
  path: string,
  type?: "page" | "layout",
): void {
  for (const locale of LOCALES) {
    revalidatePath(revalidateKey(path, locale), type);
  }
}
