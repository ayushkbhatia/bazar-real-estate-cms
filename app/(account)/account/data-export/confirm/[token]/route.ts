import { NextResponse } from "next/server";
import { confirmDataExport } from "../../_actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Confirmation endpoint for the data export. Returns the JSON archive as a
 * download. On any failure the user is redirected back to the data-export
 * page with a `result=` flag the UI could render later. For now the failure
 * surface is a plain HTML message.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const result = await confirmDataExport(token);

  if (result.status === "ok") {
    const body = JSON.stringify(result.payload, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${result.filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  const message =
    result.status === "expired"
      ? "This confirmation link has expired. Please request a fresh export."
      : result.status === "already_used"
        ? "This link has already been used. Please request a fresh export."
        : result.status === "not_found"
          ? "We couldn't find this request. The link may have been mistyped."
          : `Something went wrong (${result.message}).`;

  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Data export</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 24px;color:#1B1A17">
<h1 style="font-size:24px;margin:0 0 12px">Data export</h1>
<p style="font-size:15px;color:#5a5a55">${message}</p>
<p style="margin-top:24px"><a href="/account/data-export" style="color:#1B1A17">Back to data export</a></p>
</body></html>`;

  return new NextResponse(html, {
    status: result.status === "not_found" ? 404 : 410,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
