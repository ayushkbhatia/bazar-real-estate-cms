import { redirect } from "next/navigation";

/**
 * Per IA spec `/account` redirects to `/account/saved`.
 * Sprint 2 closes this gap; previously rendered a static "Welcome back" stub.
 */
export default function AccountIndexPage() {
  redirect("/account/saved");
}
