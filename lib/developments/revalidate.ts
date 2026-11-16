import { revalidateLocalised } from "@/lib/i18n/revalidate";
import {
  developmentRegisterUrl,
  developmentUrl,
} from "@/lib/queries/development-utils";

/**
 * A project's public pages after a write: the project page and its sign-up
 * page (/developments/<slug>/register, the newsletter's call to action), in
 * every locale.
 *
 * One call so the two cannot drift. The sign-up page reads the project's
 * record and its page's Hero section, so every write that changes the project
 * page can change it too — and a project published, unpublished or renamed
 * has to take both with it.
 */
export function revalidateDevelopmentPages(slug: string): void {
  revalidateLocalised(developmentUrl({ slug }));
  revalidateLocalised(developmentRegisterUrl({ slug }));
}
