import { randomUUID } from "node:crypto";

/**
 * An in-memory stand-in for the service-role Supabase client, covering the
 * query shapes the listing sync uses and nothing more. Enough to run the
 * whole sync against, so its specs test the contract — what reaches
 * `properties`, what is held, what is taken down — rather than which methods
 * were called in which order.
 *
 * Unique constraints fail the way PostgREST does (code 23505, the constraint
 * name in the message), because the sync branches on exactly that.
 */

type Row = Record<string, unknown>;

const UNIQUE: Record<string, string[][]> = {
  properties: [["id"], ["reference"], ["salesforce_listing_id"]],
  salesforce_listings: [["sf_listing_id"]],
  salesforce_media: [["source_key"]],
  salesforce_mappings: [["kind", "source_key"]],
  property_media: [["property_id", "media_id"]],
  media_assets: [["id"], ["storage_key"]],
};

const DEFAULTS: Record<string, () => Row> = {
  properties: () => ({
    id: randomUUID(),
    status: "draft",
    published_at: null,
    i18n: {},
    title_ar: null,
    description_ar: null,
    assigned_agent_id: null,
    salesforce_listing_id: null,
  }),
  salesforce_listings: () => ({
    holds: [],
    notes: [],
    unresolved: {},
    images_total: 0,
    images_ready: 0,
    image_failures: {},
    approved_at: null,
    approved_by: null,
    hidden_at: null,
    hidden_by: null,
    withdrawn_at: null,
    withdrawn_reason: null,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    last_synced_at: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  }),
  media_assets: () => ({ id: randomUUID(), deleted_at: null }),
};

type Result = { data: unknown; error: { code?: string; message: string } | null };

export class FakeDb {
  tables: Record<string, Row[]> = {};
  objects = new Map<string, Uint8Array>();
  lease: { holder: string | null; until: number } = { holder: null, until: 0 };
  users: { id: string; email: string }[] = [];

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  /** Seed rows as they would exist after defaults. */
  seed(table: string, ...rows: Row[]): void {
    for (const r of rows) this.rows(table).push({ ...(DEFAULTS[table]?.() ?? {}), ...r });
  }

  violates(table: string, candidate: Row, except?: Row): string | null {
    for (const cols of UNIQUE[table] ?? []) {
      if (cols.some((c) => candidate[c] == null)) continue;
      const clash = this.rows(table).find(
        (r) => r !== except && cols.every((c) => r[c] === candidate[c]),
      );
      if (clash) return `${table}_${cols.join("_")}_key`;
    }
    return null;
  }

  client() {
    return {
      from: (table: string) => new Query(this, table),
      rpc: async (name: string, args: Record<string, unknown>): Promise<Result> => {
        if (name === "claim_salesforce_listing_lease") {
          const now = Date.now();
          if (this.lease.holder && this.lease.until > now && this.lease.holder !== args.p_holder) {
            return { data: false, error: null };
          }
          this.lease = { holder: args.p_holder as string, until: now + Number(args.p_seconds) * 1000 };
          return { data: true, error: null };
        }
        if (name === "release_salesforce_listing_lease") {
          if (this.lease.holder === args.p_holder) this.lease = { holder: null, until: 0 };
          return { data: null, error: null };
        }
        return { data: null, error: { message: `no rpc ${name}` } };
      },
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: this.users }, error: null }),
        },
      },
      storage: {
        from: () => ({
          upload: async (key: string, bytes: Uint8Array) => {
            if (this.objects.has(key)) return { data: null, error: { message: "exists" } };
            this.objects.set(key, bytes);
            return { data: { path: key }, error: null };
          },
          remove: async (keys: string[]) => {
            for (const k of keys) this.objects.delete(k);
            return { data: null, error: null };
          },
        }),
      },
    };
  }
}

class Query {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private single = false;
  private limitN: number | null = null;
  private conflict: string[] | null = null;

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select(): this {
    return this;
  }
  insert(rows: Row | Row[]): this {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }): this {
    this.op = "upsert";
    this.payload = rows;
    this.conflict = opts?.onConflict?.split(",").map((s) => s.trim()) ?? null;
    return this;
  }
  update(patch: Row): this {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown): this {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown): this {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]): this {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  is(c: string, v: unknown): this {
    this.filters.push((r) => (v === null ? r[c] == null : r[c] === v));
    return this;
  }
  not(c: string, op: string, v: unknown): this {
    if (op === "is" && v === null) this.filters.push((r) => r[c] != null);
    return this;
  }
  order(): this {
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  maybeSingle(): this {
    this.single = true;
    return this;
  }
  then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T): Promise<T> {
    try {
      return Promise.resolve(resolve(this.exec()));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }

  private shape(rows: Row[]): Result {
    const copies = rows.map((r) => structuredClone(r));
    if (this.single) return { data: copies[0] ?? null, error: null };
    return { data: this.limitN != null ? copies.slice(0, this.limitN) : copies, error: null };
  }

  private exec(): Result {
    const all = this.db.rows(this.table);
    const match = (r: Row) => this.filters.every((f) => f(r));

    if (this.op === "select") return this.shape(all.filter(match));

    if (this.op === "delete") {
      this.db.tables[this.table] = all.filter((r) => !match(r));
      return { data: null, error: null };
    }

    if (this.op === "update") {
      const hits = all.filter(match);
      for (const r of hits) {
        const next = { ...r, ...(this.payload as Row) };
        const clash = this.db.violates(this.table, next, r);
        if (clash) return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${clash}"` } };
        Object.assign(r, this.payload);
      }
      return this.shape(hits);
    }

    const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
    const written: Row[] = [];
    for (const raw of incoming) {
      if (this.op === "upsert" && this.conflict) {
        const existing = all.find((r) => this.conflict!.every((c) => r[c] === raw[c]));
        if (existing) {
          Object.assign(existing, raw);
          written.push(existing);
          continue;
        }
      }
      const row = { ...(DEFAULTS[this.table]?.() ?? {}), ...raw };
      const clash = this.db.violates(this.table, row);
      if (clash) {
        return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${clash}"` } };
      }
      all.push(row);
      written.push(row);
    }
    return this.shape(written);
  }
}
