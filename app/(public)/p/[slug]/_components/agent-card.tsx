import Link from "next/link";
import { Phone, MessageCircle, Mail } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { SeedAgent } from "@/lib/seeds/agents";

/**
 * Sprint 4c: advisor card on the property page. Avatar + BRN + Call /
 * WhatsApp / Email actions. Sprint 9 wires the real assigned-agent.
 */
export function AgentCard({ agent }: { agent: SeedAgent }) {
  const waUrl = `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi ${agent.display_name.split(" ")[0]}, I'd like to discuss a listing.`,
  )}`;

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex gap-4 items-start">
        <Link
          href={`/agents/${agent.slug}`}
          className="block w-16 h-16 rounded-md overflow-hidden flex-shrink-0"
        >
          {agent.photo_url ? (
            <Image
              src={agent.photo_url}
              alt={agent.display_name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <PlaceholderImage label={agent.slug} className="w-full h-full" />
          )}
        </Link>
        <div className="min-w-0">
          <Eyebrow>Lead advisor</Eyebrow>
          <Link
            href={`/agents/${agent.slug}`}
            className="block mt-1 serif text-[18px] leading-tight hover:text-bz-accent transition-colors"
            style={{ letterSpacing: "-0.008em" }}
          >
            {agent.display_name}
          </Link>
          <div className="text-[12px] text-bz-muted mt-0.5">
            {agent.title}
          </div>
          <div className="mt-2 mono text-[11px] text-bz-muted">
            BRN · <span className="text-bz-ink-2">{agent.brn}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <a
          href={`tel:${agent.phone.replace(/\s/g, "")}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-bz-ink text-bz-bg text-[12.5px] font-medium hover:bg-bz-ink-2 transition-colors"
        >
          <Phone size={13} strokeWidth={1.8} />
          Call
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
        >
          <MessageCircle size={13} strokeWidth={1.7} />
          WhatsApp
        </a>
        <a
          href={`mailto:${agent.email}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
        >
          <Mail size={13} strokeWidth={1.7} />
          Email
        </a>
      </div>

      <p className="mt-4 text-[11.5px] text-bz-muted leading-relaxed">
        {agent.languages.join(" · ")}
      </p>
    </div>
  );
}
