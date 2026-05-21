/**
 * Concierge-specific env loader.
 *
 * We keep `lib/env.ts` (the project-wide loader) untouched so the parallel
 * branches' work doesn't conflict. Anthropic is only consumed by the
 * concierge surface, so it lives next to its callers.
 *
 * Empty-string env vars are normalised to undefined — Vercel slots that
 * exist but have no value should not crash the build.
 */
import "server-only";

function normalize(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export const anthropicEnv = {
  ANTHROPIC_API_KEY: normalize(process.env.ANTHROPIC_API_KEY),
};

export const isAnthropicConfigured = Boolean(anthropicEnv.ANTHROPIC_API_KEY);
