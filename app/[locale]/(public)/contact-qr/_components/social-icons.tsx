import * as React from "react";
import { Globe } from "lucide-react";

/**
 * Social glyphs for the contact card.
 *
 * lucide-react v1 dropped its brand icons, so these are drawn here in the same
 * minimal-stroke language as the rest of the icon set rather than pulled from
 * a brand-icon package (which would ship a solid-fill style that reads wrong
 * next to lucide, plus a few hundred KB for five marks).
 *
 * An unrecognised network falls back to a globe, so a link an editor adds is
 * never silently dropped.
 */

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Instagram({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Facebook({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <path d="M16 3h-2.5A4.5 4.5 0 0 0 9 7.5V10H6v4h3v7h4v-7h3l1-4h-4V7.5a1 1 0 0 1 1-1H16Z" />
    </svg>
  );
}

function TikTok({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <path d="M14 3v11.5a4.5 4.5 0 1 1-4.5-4.5" />
      <path d="M14 3c.4 3 2.6 5 5.5 5.2" />
    </svg>
  );
}

function YouTube({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.5 9.5 5 2.5-5 2.5z" />
    </svg>
  );
}

function LinkedIn({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <path d="M15.5 8.5A5.5 5.5 0 0 1 21 14v6.5h-3.5V14a2 2 0 0 0-4 0v6.5H10V9h3.5v1.4a5.5 5.5 0 0 1 2-1.9Z" />
      <rect x="2.5" y="9" width="4" height="11.5" rx="0.5" />
      <circle cx="4.5" cy="4.5" r="2" />
    </svg>
  );
}

function XTwitter({ size }: { size: number }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      <path d="m3.5 3.5 8.2 10.4L20.5 20.5" />
      <path d="m3.5 20.5 7-7.6" />
      <path d="M13.6 10.2 20.5 3.5" />
    </svg>
  );
}

const REGISTRY: { match: RegExp; Icon: (p: { size: number }) => React.ReactElement }[] =
  [
    { match: /insta/i, Icon: Instagram },
    { match: /face|fb\b/i, Icon: Facebook },
    { match: /tik ?tok/i, Icon: TikTok },
    { match: /you ?tube|yt\b/i, Icon: YouTube },
    { match: /linked ?in/i, Icon: LinkedIn },
    { match: /^x$|twitter/i, Icon: XTwitter },
  ];

export function SocialIcon({
  network,
  size = 18,
}: {
  network: string;
  size?: number;
}) {
  const entry = REGISTRY.find((r) => r.match.test(network.trim()));
  if (!entry) return <Globe size={size} strokeWidth={1.7} aria-hidden="true" />;
  const { Icon } = entry;
  return <Icon size={size} />;
}
