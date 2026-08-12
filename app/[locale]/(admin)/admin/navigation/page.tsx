import { redirect } from "next/navigation";

/** Renamed to Megamenu, which is what the thing is called everywhere else. */
export default function NavigationRedirect() {
  redirect("/admin/megamenu");
}
