import { getTranslations } from "next-intl/server";
import { FlowPage } from "../../../../_components/flow-page";
import { FlowHeading } from "../../../../_components/steps";

/**
 * A link that can't be used: unknown or cancelled, expired, locked after five
 * wrong codes, or already used (FE-2: not designed). None of them shows
 * anything about the application, whose link it was.
 */
export async function LinkMessage({
  state,
  purpose,
  reference,
}: {
  state: "unavailable" | "expired" | "locked" | "used";
  purpose: "reupload" | "preapproval_invite" | null;
  /** A used invite: the application it made, which the applicant already knows. */
  reference?: string | null;
}) {
  const t = await getTranslations("mortgage");
  const key = state === "used" && purpose === "preapproval_invite" ? "invited" : state;
  return (
    <FlowPage>
      <FlowHeading
        eyebrow={t("w8.code.eyebrow")}
        title={t(`w8.state.${key}.title`)}
        lede={
          <>
            {t(`w8.state.${key}.body`)}
            {reference ? <> {t("w8.invite.reference", { reference })}</> : null}
          </>
        }
      />
      <p className="mt-6 text-[13.5px] text-bz-ink-2">{t("w8.state.contact")}</p>
    </FlowPage>
  );
}
