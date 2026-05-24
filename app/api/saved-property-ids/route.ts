import { NextResponse } from "next/server";
import { listSavedPropertyIdsForCurrentUser } from "@/lib/queries/saved-ids";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ids, isAuthed } = await listSavedPropertyIdsForCurrentUser();
  return NextResponse.json(
    { ids, isAuthed },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
