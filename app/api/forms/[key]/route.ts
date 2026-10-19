import { NextResponse, type NextRequest } from "next/server";
import {
  submitForm,
  type FormSubmitContext,
} from "@/app/[locale]/(public)/_actions/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The second way into `submitForm`, for when the first one fails.
 *
 * The form renderer calls `submitForm` as a server action. A server action is
 * addressed by an id that changes with every build, so a page opened before a
 * deploy posts an id the new deployment does not know — Next throws "Server
 * Action was not found", and before this route the visitor's lead went
 * nowhere. Vercel's skew protection pins a page to its own deployment for 12
 * hours, which covers most tabs and not the one left open overnight; a network
 * blip mid-action fails the same way. This URL does not change between builds,
 * so the renderer retries here when the action throws.
 *
 * It is the same function behind both doors — the same validation against the
 * form as stored right now, the same spam check, rate limit and intake — so it
 * opens nothing the action did not already expose.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "That request could not be read." },
      { status: 400 },
    );
  }

  const { values, context } = (body ?? {}) as {
    values?: unknown;
    context?: unknown;
  };
  if (!isRecord(values)) {
    return NextResponse.json(
      { status: "error", message: "That request could not be read." },
      { status: 400 },
    );
  }

  const result = await submitForm(
    key,
    values,
    isRecord(context) ? (context as FormSubmitContext) : {},
  );
  return NextResponse.json(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
