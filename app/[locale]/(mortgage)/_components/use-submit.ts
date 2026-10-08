"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { validateDetails } from "@/lib/mortgage-requests/details";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import { ApiError, submitRequest, type SubmitBody } from "@/lib/mortgage-requests/client/api";
import { afterSubmit, FLOW_PATHS, type ApplyState } from "@/lib/mortgage-requests/client/apply-state";
import { setApplyState } from "@/lib/mortgage-requests/client/apply-store";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";

export type SubmitFailure = { message: string; code: string };

/**
 * Submitting, for W3 and W5/W6 (W3 "Submit"): the CTA disables while it runs,
 * and the wizard's Idempotency-Key
 * makes a retry after a timeout land on the same application. On success the
 * tab keeps only the summary and the route is replaced, so Back can't
 * resubmit.
 */
export function useSubmit() {
  const t = useTranslations("mortgage");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  const submit = useCallback(
    async (
      state: ApplyState,
      extra:
        | { service: "consultancy" }
        | {
            service: "pre_approval";
            draftId: string;
            draftToken: string;
            fileIds: string[];
            wordingVersion: string;
            documents: { kind: DocKind; files: number }[];
          },
    ): Promise<SubmitFailure | null> => {
      const valid = validateDetails(state.details);
      if (!valid.ok) {
        router.push(FLOW_PATHS.details);
        return null;
      }
      const details = valid.details;
      setBusy(true);
      setFailure(null);
      try {
        const common = {
          details,
          entryPoint: state.entryPoint,
          ...(state.propertyRef ? { propertyRef: state.propertyRef } : {}),
          siteLocale: state.siteLocale ?? "en",
        };
        const body: SubmitBody =
          extra.service === "consultancy"
            ? { service: "consultancy", ...common }
            : {
                service: "pre_approval",
                ...common,
                draftId: extra.draftId,
                fileIds: extra.fileIds,
                consent: { given: true, wordingVersion: extra.wordingVersion },
              };
        const res = await submitRequest(
          body,
          state.idempotencyKey,
          extra.service === "pre_approval" ? extra.draftToken : undefined,
        );
        trackMortgage("mortgage_request_submitted", {
          service: res.service,
          residency: details.residency,
          employment_type: details.employmentType,
          entry_point: state.entryPoint,
        });
        setApplyState((s) =>
          afterSubmit(s, {
            reference: res.reference,
            service: res.service,
            submittedAt: res.submittedAt,
            dueAt: res.dueAt,
            residency: details.residency,
            employmentType: details.employmentType,
            mobile: details.mobile,
            email: details.email,
            ...(extra.service === "pre_approval" ? { documents: extra.documents } : {}),
            returnTo: s.returnTo,
          }),
        );
        router.replace(FLOW_PATHS.received);
        return null;
      } catch (e) {
        const error = e instanceof ApiError ? e : new ApiError(0, "network");
        trackMortgage("mortgage_request_failed", { service: extra.service, status: error.status });
        // A detail the server refused: back to W2 with that field marked.
        if (error.status === 422 && error.field?.startsWith("details.")) {
          const field = error.field.slice("details.".length);
          setApplyState((s) => ({ ...s, flagged: { field, rule: String(error.details.message ?? "") } }));
          router.push(FLOW_PATHS.details);
          return null;
        }
        const message =
          error.code === "rate_limited"
            ? t("submit.error.rateLimited")
            : error.code === "files_not_ready"
              ? t("submit.error.filesNotReady")
              : error.code === "draft_expired"
                ? t("submit.error.draftExpired")
                : t("submit.error.generic");
        const f = { message, code: error.code };
        setFailure(f);
        return f;
      } finally {
        setBusy(false);
      }
    },
    [router, t],
  );

  return { submit, busy, failure, clearFailure: () => setFailure(null) };
}
