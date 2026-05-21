import { NextResponse } from "next/server";
import { confirmAccountDeletion } from "../../_actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Account-deletion confirmation. We redirect to /data-deleted (a public
 * route — note: NOT /account-deleted, because /account* is auth-gated
 * by the proxy and the user has just been signed out) so the now-signed
 * out user can read the confirmation. The ?reason query carries the
 * failure mode if any.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const result = await confirmAccountDeletion(token);

  if (result.status === "ok") {
    return NextResponse.redirect(new URL("/data-deleted", _req.url));
  }

  const param = encodeURIComponent(result.status);
  return NextResponse.redirect(
    new URL(`/data-deleted?reason=${param}`, _req.url),
  );
}
