import "server-only";
import { SalesforceError, salesforceRequest } from "@/lib/salesforce/client";
import {
  LISTING_FIELDS,
  PROPERTY_FIELDS,
  REQUIRED_LISTING_FIELDS,
  deletedSoql,
  isLiveWebsiteStatus,
  statusSoql,
  sweepSoql,
  type FieldVisibility,
  type SfListingRecord,
} from "./fields";

type QueryPage<T> = {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
};

/**
 * `nextRecordsUrl` comes back absolute from the data root —
 * `/services/data/v67.0/query/01g…-2000` — and `salesforceRequest` wants the
 * part after the version. Anything that does not look like that is refused
 * rather than followed: the URL is the org's to give, but it is still input.
 */
export function nextPagePath(nextRecordsUrl: string): string | null {
  const m = nextRecordsUrl.match(/^\/services\/data\/v\d+\.\d+\/((?:query|queryAll)\/[A-Za-z0-9-]+)$/);
  return m ? m[1] : null;
}

/** Every page of a query. Salesforce pages at 2,000 records by default. */
async function queryAllPages<T>(soql: string, endpoint: "query" | "queryAll"): Promise<T[]> {
  const out: T[] = [];
  let path: string | null = `${endpoint}?q=${encodeURIComponent(soql)}`;
  for (let page = 0; path && page < 50; page++) {
    const res: QueryPage<T> | null = await salesforceRequest<QueryPage<T>>(path, { method: "GET" });
    if (!res) break;
    out.push(...res.records);
    path = !res.done && res.nextRecordsUrl ? nextPagePath(res.nextRecordsUrl) : null;
  }
  return out;
}

type Describe = { fields: { name: string }[] };

/** Which of our fields the integration user can actually read, from a live
 *  describe of both objects. Two API calls — only made when a sweep has
 *  already failed on a field. */
async function visibleFields(): Promise<{ visibility: FieldVisibility; hidden: string[] }> {
  const [listing, property] = await Promise.all([
    salesforceRequest<Describe>("sobjects/Property_Listing__c/describe", { method: "GET" }),
    salesforceRequest<Describe>("sobjects/Listing__c/describe", { method: "GET" }),
  ]);
  const l = new Set((listing?.fields ?? []).map((f) => f.name));
  const p = new Set((property?.fields ?? []).map((f) => f.name));
  const hidden = [
    ...LISTING_FIELDS.filter((f) => !l.has(f)).map((f) => `Property_Listing__c.${f}`),
    ...PROPERTY_FIELDS.filter((f) => !p.has(f)).map((f) => `Listing__c.${f}`),
  ];
  const missingRequired = [...REQUIRED_LISTING_FIELDS].filter((f) => !l.has(f));
  if (missingRequired.length) {
    throw new SalesforceError(
      `The integration user cannot read ${missingRequired.join(", ")} on Property_Listing__c`,
      { status: 403, errorCode: "INSUFFICIENT_ACCESS", retryable: false },
    );
  }
  return { visibility: { listing: l, property: p }, hidden };
}

export type Sweep = {
  records: SfListingRecord[];
  /** Fields the org hides from the integration user, when a describe had to
   *  narrow the query. Empty on a normal run. */
  hiddenFields: string[];
};

/**
 * Every listing Salesforce says is published on the website.
 *
 * One query in the normal case. If the org has hidden one of our fields from
 * the integration user, the query fails whole with INVALID_FIELD; rather than
 * stop syncing every listing over one field, the run describes both objects,
 * drops what it cannot see, and reports the gap.
 */
export async function fetchPublishedListings(): Promise<Sweep> {
  try {
    return { records: await queryAllPages<SfListingRecord>(sweepSoql(), "query"), hiddenFields: [] };
  } catch (err) {
    if (!(err instanceof SalesforceError) || err.errorCode !== "INVALID_FIELD") throw err;
    const { visibility, hidden } = await visibleFields();
    return {
      records: await queryAllPages<SfListingRecord>(sweepSoql(visibility), "query"),
      hiddenFields: hidden,
    };
  }
}

export type Absence =
  /** Salesforce shows the record, not published: withdraw. `status` is the
   *  value it holds — Deactivated is what the website itself writes when a
   *  listing cannot be published, and the reasons are worth keeping. */
  | { kind: "unpublished"; reason: string; status: string | null }
  /** In the recycle bin: withdraw. */
  | { kind: "deleted"; reason: string }
  /** Published after all — it appeared between the sweep and this check. */
  | { kind: "still_published" }
  /** Salesforce will not say anything about it. A sharing rule or a
   *  permission changed; this is not evidence of a withdrawal. */
  | { kind: "invisible" };

const CHUNK = 200;

/**
 * Why each listing missing from the sweep is missing.
 *
 * This is the step that makes a withdrawal safe. Absence from the sweep proves
 * only that the integration user did not see the record as published. Asking
 * about each record by id separates "unpublished" and "deleted" — both
 * withdrawals — from "cannot see it at all", which is how a permission change
 * looks, and which must never take a listing off the website.
 */
export async function explainAbsences(ids: readonly string[]): Promise<Map<string, Absence>> {
  const out = new Map<string, Absence>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const soql = statusSoql(chunk);
    if (!soql) continue;
    const seen = await queryAllPages<{ Id: string; Website_Status__c?: string | null; Listing_Status__c?: string | null }>(soql, "query");
    for (const r of seen) {
      if (isLiveWebsiteStatus(r.Website_Status__c)) {
        out.set(r.Id, { kind: "still_published" });
      } else {
        const status = r.Website_Status__c ? `"${r.Website_Status__c}"` : "blank";
        out.set(r.Id, {
          kind: "unpublished",
          reason: `Website_Status__c is ${status} in Salesforce`,
          status: r.Website_Status__c ?? null,
        });
      }
    }
    const unseen = chunk.filter((id) => !out.has(id));
    const del = deletedSoql(unseen);
    if (del) {
      const gone = await queryAllPages<{ Id: string }>(del, "queryAll");
      for (const r of gone) {
        out.set(r.Id, { kind: "deleted", reason: "Deleted in Salesforce" });
      }
    }
    for (const id of chunk) {
      if (!out.has(id)) out.set(id, { kind: "invisible" });
    }
  }
  return out;
}
