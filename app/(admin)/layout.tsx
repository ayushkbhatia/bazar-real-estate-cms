export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth gate runs in proxy.ts. Each admin page wraps its content in
  // CmsShell with its own title + breadcrumbs.
  return <>{children}</>;
}
