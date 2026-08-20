import Link from "@/components/i18n/link";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-16 bg-bz-bg text-bz-ink">
      <div className="max-w-xl w-full">
        <Eyebrow>404 · Not found</Eyebrow>
        <h1 className="serif text-4xl mt-3 mb-4">
          This page isn&rsquo;t here.
        </h1>
        <p className="text-bz-ink-2 mb-8">
          The link may be out of date, or the page has been moved. The home
          page is the quickest way back to the catalogue.
        </p>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/buy">Browse buy</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
