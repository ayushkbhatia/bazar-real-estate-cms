import { ENTRY_PARAM_KEYS, parseEntryParams } from "@/lib/mortgage-requests/client/apply-state";
import { ChooseService } from "./_steps/choose-service";

/** W1 · Choose service (docs/mortgage/frontend/W1-choose-service). */
export default async function ChooseServicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of ENTRY_PARAM_KEYS) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  return <ChooseService entry={parseEntryParams(params)} />;
}
