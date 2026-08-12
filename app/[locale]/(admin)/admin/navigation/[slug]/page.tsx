import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

/** Keeps older links working after the rename. */
export default async function NavigationTabRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/admin/megamenu/${slug}`);
}
