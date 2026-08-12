import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/schemas/page";

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} />;
    case "strip":
      return <StripBlock block={block} />;
    case "split":
      return <SplitBlock block={block} />;
    case "grid":
      return <GridBlock block={block} />;
    case "banner":
      return <BannerBlock block={block} />;
  }
}

function HeroBlock({
  block,
}: {
  block: Extract<Block, { type: "hero" }>;
}) {
  return (
    <section className="relative">
      <div className="px-4 md:px-12 py-12 md:py-20 max-w-[1200px] mx-auto">
        {block.eyebrow ? <Eyebrow>{block.eyebrow}</Eyebrow> : null}
        <h1
          className="serif text-[36px] md:text-[68px] mt-4 leading-[1] font-normal"
          style={{ letterSpacing: "-0.03em" }}
        >
          {block.title}
        </h1>
        {block.subtitle ? (
          <p className="mt-6 text-[18px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
            {block.subtitle}
          </p>
        ) : null}
        {block.cta ? (
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href={block.cta.href}>{block.cta.label}</Link>
            </Button>
          </div>
        ) : null}
        {block.image ? (
          <div className="relative mt-12 aspect-[21/9] rounded-lg overflow-hidden bg-bz-surface-2">
            <PlaceholderImage
              label={block.image.label ?? "hero image"}
              className="w-full h-full"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StripBlock({
  block,
}: {
  block: Extract<Block, { type: "strip" }>;
}) {
  return (
    <section
      className={cn(
        "px-4 md:px-12 py-12 md:py-20 max-w-[1024px] mx-auto",
        block.align === "center" ? "text-center" : "text-start",
      )}
    >
      {block.eyebrow ? <Eyebrow>{block.eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "serif text-[28px] md:text-[40px] font-normal leading-tight mt-3",
          block.align === "center" ? "mx-auto" : "",
        )}
        style={{ letterSpacing: "-0.025em" }}
      >
        {block.heading}
      </h2>
      {block.body ? (
        <p
          className={cn(
            "mt-5 text-[16.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]",
            block.align === "center" ? "mx-auto" : "",
          )}
        >
          {block.body}
        </p>
      ) : null}
    </section>
  );
}

function SplitBlock({
  block,
}: {
  block: Extract<Block, { type: "split" }>;
}) {
  const imageOnRight = block.image_side === "right";
  const imageEl = (
    <div className="relative aspect-[5/4] rounded-lg overflow-hidden bg-bz-surface-2">
      <PlaceholderImage
        label={block.image?.label ?? block.heading.toLowerCase().slice(0, 24)}
        className="w-full h-full"
      />
    </div>
  );
  const textEl = (
    <div className="self-center">
      {block.eyebrow ? <Eyebrow>{block.eyebrow}</Eyebrow> : null}
      <h2
        className="serif text-[36px] mt-3 leading-[1.1] font-normal"
        style={{ letterSpacing: "-0.02em" }}
      >
        {block.heading}
      </h2>
      {block.body ? (
        <p className="mt-5 text-[15.5px] text-bz-ink-2 leading-relaxed">
          {block.body}
        </p>
      ) : null}
    </div>
  );

  return (
    <section className="px-4 md:px-12 py-12 md:py-20 max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {imageOnRight ? (
          <>
            {textEl}
            {imageEl}
          </>
        ) : (
          <>
            {imageEl}
            {textEl}
          </>
        )}
      </div>
    </section>
  );
}

function GridBlock({
  block,
}: {
  block: Extract<Block, { type: "grid" }>;
}) {
  const cols =
    block.items.length >= 4
      ? "grid-cols-2 md:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className="px-4 md:px-12 py-12 md:py-20 max-w-[1280px] mx-auto">
      {block.heading ? (
        <h2
          className="serif text-[32px] font-normal leading-tight mb-10"
          style={{ letterSpacing: "-0.02em" }}
        >
          {block.heading}
        </h2>
      ) : null}
      <div className={cn("grid gap-6", cols)}>
        {block.items.map((item, idx) => {
          const inner = (
            <>
              <h3
                className="serif text-[20px] leading-[1.2] font-normal"
                style={{ letterSpacing: "-0.01em" }}
              >
                {item.title}
              </h3>
              {item.body ? (
                <p className="mt-2 text-[13.5px] text-bz-ink-2 leading-relaxed">
                  {item.body}
                </p>
              ) : null}
            </>
          );
          return (
            <article
              key={idx}
              className="border border-bz-border rounded-lg p-5 bg-bz-surface"
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="block hover:text-bz-accent transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BannerBlock({
  block,
}: {
  block: Extract<Block, { type: "banner" }>;
}) {
  const palette =
    block.variant === "accent"
      ? "bg-bz-accent text-white"
      : block.variant === "soft"
        ? "bg-bz-accent-soft text-bz-accent"
        : "bg-bz-ink text-white";
  return (
    <section className="px-4 md:px-12 py-12 max-w-[1280px] mx-auto">
      <div
        className={cn(
          "rounded-lg p-6 md:p-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between",
          palette,
        )}
      >
        <div className="flex-1">
          <h3
            className="serif text-[26px] font-normal leading-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            {block.title}
          </h3>
          {block.body ? (
            <p className="mt-3 text-[14.5px] opacity-80 leading-relaxed max-w-[60ch]">
              {block.body}
            </p>
          ) : null}
        </div>
        {block.cta ? (
          <Button asChild variant="outline" className="flex-shrink-0 border-current text-current bg-transparent hover:bg-current hover:text-bz-ink">
            <Link href={block.cta.href}>{block.cta.label}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
