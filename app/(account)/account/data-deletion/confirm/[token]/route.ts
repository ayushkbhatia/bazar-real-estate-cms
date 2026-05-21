import { NextResponse } from "next/server";
import { confirmAccountDeletion } from "../../_actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Account-deletion confirmation. We redirect to /account-deleted (a public
 * route) because the user's session has just been signed out and they
 * shouldn't bounce through /sign-in to read a confirmation message. The
 * ?reason query carries the failure mode if any.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const result = await confirmAccountDeletion(token);

  if (result.status === "ok") {
    return NextResponse.redirect(new URL("/account-deleted", _req.url));
  }

  const param = encodeURIComponent(result.status);
  return NextResponse.redirect(
    new URL(`/account-deleted?reason=${param}`, _req.url),
  );
}
