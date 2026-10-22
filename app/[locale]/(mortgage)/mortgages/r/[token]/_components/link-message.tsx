import type { Locale } from "@/lib/i18n/locales";
import { getMortgageTranslator } from "@/lib/queries/wizards";
import { FlowPage } from "../../../../_components/flow-page";
import { isolate } from "../../../../_components/rich";
import { FlowHeading } from "../../../../_components/steps";

/**
 * A link that can't be used: unknown or cancelled, expired, locked after five
 * wrong codes, or already used (FE-2: not designed). None of them shows
 * anything about the application, whose link it was.
 */
export async function LinkMessage({
  locale,
  state,
  purpose,
  reference,
}: {
  locale: Locale;
  state: "unavailable" | "expired" | "locked" | "used";
  purpose: "reupload" | "preapproval_invite" | null;
  /** A used invite: the application it made, which the applicant already knows. */
  reference?: string | null;
}) {
  const t = await getMortgageTranslator(locale);
  const key = state === "used" && purpose === "preapproval_invite" ? "invited" : state;
  return (
    <FlowPage>
      <FlowHeading
        eyebrow={t("w8.code.eyebrow")}
        title={t(`w8.state.${key}.title`)}
        lede={
          <>
            {t(`w8.state.${key}.body`)}
            {reference ? <> {t("w8.invite.reference", { reference: isolate(reference) })}</> : null}
          </>
        }
      />
      <p className="mt-6 text-[13.5px] text-bz-ink-2">{t("w8.state.contact")}</p>
    </FlowPage>
  );
}
