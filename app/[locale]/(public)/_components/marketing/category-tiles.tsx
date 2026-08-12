import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

export type CategoryTile = {
  name: string;
  desc: string;
  cta: string;
  /** Caption for the placeholder art, used when no asset is picked. */
  img: string;
  href: string;
  /** Resolved URL of the asset chosen in the master-page editor. */
  imgUrl?: string | null;
  imgAlt?: string | null;
};

type Props = {
  items: CategoryTile[];
};

/**
 * Full-bleed image tiles with a bottom gradient scrim and overlaid copy.
 * 1-up mobile → 2-up tablet → 4-up desktop (the handoff's `CategoryTiles`).
 */
export function CategoryTiles({ items }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {items.map((t) => (
        <Link
          key={t.name}
          href={t.href}
          className="group relative rounded-xl overflow-hidden min-h-[320px] flex flex-col justify-end text-white"
        >
          {t.imgUrl ? (
            <Image
              src={t.imgUrl}
              alt={t.imgAlt ?? t.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <PlaceholderImage
              label={t.img}
              dark
              className="absolute inset-0 h-full w-full"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,52,82,.1) 0%, rgba(0,52,82,.78) 100%)",
            }}
          />
          <div className="relative p-6">
            <div
              className="serif text-[26px]"
              style={{ letterSpacing: "-0.01em" }}
            >
              {t.name}
            </div>
            <p className="text-[12.5px] leading-[1.5] mt-2" style={{ opacity: 0.82 }}>
              {t.desc}
            </p>
            <div className="flex items-center gap-2 mt-4 text-[12.5px] font-medium">
              {t.cta}
              <ArrowRight
                size={14}
                strokeWidth={1.8}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
