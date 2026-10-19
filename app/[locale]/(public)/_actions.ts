"use server";

import { fileEnquiry, type CreateEnquiryResult } from "@/lib/enquiries/intake";

export type { CreateEnquiryResult };

/**
 * Public enquiry intake. Anonymous and authed both supported.
 *
 * A thin wrapper: the write lives in `lib/enquiries/intake.ts`, where the
 * server-only `held` option can't be reached from a browser.
 */
export async function createEnquiry(
  raw: Record<string, unknown>,
): Promise<CreateEnquiryResult> {
  return fileEnquiry(raw);
}
