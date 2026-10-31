import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, demoDb } from "./db";

// DEMO MODE ONLY: implements the subset of the supabase-js API this app uses
// (from/select/filters/order/single, insert/update/upsert/delete, rpc, auth)
// on top of PGlite. Real deployments never load this file's code paths.

export const DEMO_COOKIE = "hl_demo_session";

type Result = { data: any; error: { message: string } | null }; // eslint-disable-line @typescript-eslint/no-explicit-any
type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, opts?: Record<string, unknown>): void;
  delete(name: string): void;
};

// Foreign keys used by embedded selects, e.g. "client:clients(id, full_name)".
const RELATIONS: Record<string, { local: string; foreign: string }> = {
  "bookings.clients": { local: "client_id", foreign: "id" },
  "bookings.packages": { local: "package_id", foreign: "id" },
  "payments.bookings": { local: "booking_id", foreign: "id" },
};
const PRIMARY_KEY: Record<string, string> = { settings: "key", admins: "user_id" };

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`Bad identifier: ${s}`);
  return `"${s}"`;
};

/** Split on commas that aren't inside parentheses. */
function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function selectList(table: string, select: string, alias: string) {
  return splitTop(select).map((item) => {
    if (item === "*") return `${alias}.*`;
    const embed = item.match(/^(?:(\w+):)?(\w+)\(([\s\S]*)\)$/);
    if (!embed) return `${alias}.${ident(item)}`;
    const [, as, target, cols] = embed;
    const rel = RELATIONS[`${table}.${target}`];
    if (!rel) throw new Error(`Demo mode: no relation ${table} → ${target}`);
    const inner = cols.trim() === "*" ? "e.*" : splitTop(cols).map((c) => `e.${ident(c)}`).join(", ");
    return `(select row_to_json(x) from (select ${inner} from public.${ident(target)} e where e.${ident(rel.foreign)} = ${alias}.${ident(rel.local)}) x) as ${ident(as ?? target)}`;
  }).join(", ");
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectStr: string | null = null;
  private where: { sql: (p: (v: unknown) => string) => string }[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(private table: string) {
    ident(table);
  }

  select(cols = "*") { this.selectStr = cols; return this; }
  insert(v: Record<string, unknown> | Record<string, unknown>[]) { this.op = "insert"; this.rows = [v].flat(); return this; }
  upsert(v: Record<string, unknown> | Record<string, unknown>[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert"; this.rows = [v].flat(); this.upsertOpts = o; return this;
  }
  update(v: Record<string, unknown>) { this.op = "update"; this.patch = v; return this; }
  delete() { this.op = "delete"; return this; }

  private cmp(col: string, opr: string, v: unknown) {
    this.where.push({ sql: (p) => `t.${ident(col)} ${opr} ${p(v)}` });
    return this;
  }
  eq(c: string, v: unknown) { return this.cmp(c, "=", v); }
  neq(c: string, v: unknown) { return this.cmp(c, "<>", v); }
  gte(c: string, v: unknown) { return this.cmp(c, ">=", v); }
  lte(c: string, v: unknown) { return this.cmp(c, "<=", v); }
  is(c: string, v: null | boolean) { this.where.push({ sql: () => `t.${ident(c)} is ${v === null ? "null" : v ? "true" : "false"}` }); return this; }
  not(c: string, op: "is" | "eq", v: unknown) {
    if (op === "is") this.where.push({ sql: () => `t.${ident(c)} is not ${v === null ? "null" : v ? "true" : "false"}` });
    else this.cmp(c, "<>", v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.where.push({ sql: (p) => (vs.length ? `t.${ident(c)} in (${vs.map(p).join(", ")})` : "false") });
    return this;
  }
  /** PostgREST "or" filter, e.g. "full_name.ilike.%ana%,partner_name.ilike.%ana%". */
  or(expr: string) {
    const parts = splitTop(expr).map((s) => s.match(/^(\w+)\.(eq|ilike)\.(.*)$/)!);
    this.where.push({ sql: (p) => `(${parts.map(([, c, o, v]) => `t.${ident(c)} ${o === "eq" ? "=" : "ilike"} ${p(v)}`).join(" or ")})` });
    return this;
  }
  order(c: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const asc = o.ascending ?? true;
    this.orders.push(`t.${ident(c)} ${asc ? "asc" : "desc"} nulls ${(o.nullsFirst ?? !asc) ? "first" : "last"}`);
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private build(): [string, unknown[]] {
    const params: unknown[] = [];
    const p = (v: unknown) => { params.push(v === undefined ? null : v); return `$${params.length}`; };
    const T = `public.${ident(this.table)}`;
    const whereSql = this.where.length ? ` where ${this.where.map((w) => w.sql(p)).join(" and ")}` : "";
    const tail = `${this.orders.length ? ` order by ${this.orders.join(", ")}` : ""}${this.limitN ? ` limit ${Number(this.limitN)}` : ""}`;

    if (this.op === "select") {
      return [`select ${selectList(this.table, this.selectStr ?? "*", "t")} from ${T} t${whereSql}${tail}`, params];
    }

    let mutation: string;
    if (this.op === "insert" || this.op === "upsert") {
      const cols = Object.keys(this.rows[0] ?? {});
      const values = this.rows.map((r) => `(${cols.map((c) => p(r[c])).join(", ")})`).join(", ");
      mutation = `insert into ${T} (${cols.map(ident).join(", ")}) values ${values}`;
      if (this.op === "upsert") {
        const key = this.upsertOpts.onConflict ?? PRIMARY_KEY[this.table] ?? "id";
        const sets = cols.filter((c) => c !== key).map((c) => `${ident(c)} = excluded.${ident(c)}`);
        mutation += ` on conflict (${ident(key)}) ${this.upsertOpts.ignoreDuplicates || !sets.length ? "do nothing" : `do update set ${sets.join(", ")}`}`;
      }
    } else if (this.op === "update") {
      const sets = Object.entries(this.patch).map(([c, v]) => `${ident(c)} = ${p(v)}`).join(", ");
      mutation = `update ${T} as t set ${sets}${whereSql}`;
    } else {
      mutation = `delete from ${T} as t${whereSql}`;
    }
    const list = this.selectStr ? selectList(this.table, this.selectStr, "r") : "r.*";
    return [`with r as (${mutation} returning *) select ${list} from r`, params];
  }

  async run(): Promise<Result> {
    try {
      const [sql, params] = this.build();
      const db = await demoDb();
      // jsonb/array params: PGlite serializes by the parameter types it infers.
      const res = await db.query<Record<string, unknown>>(sql, params);
      const rows = res.rows;
      const isMutation = this.op !== "select";
      if (this.mode === "single") {
        if (rows.length !== 1) return { data: null, error: { message: `Expected 1 row, got ${rows.length}` } };
        return { data: rows[0], error: null };
      }
      if (this.mode === "maybe") {
        if (rows.length > 1) return { data: null, error: { message: `Expected at most 1 row, got ${rows.length}` } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: isMutation && !this.selectStr ? null : rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, fail);
  }
}

export function createDemoClient(cookies: CookieStore): SupabaseClient {
  const signedIn = () => cookies.get(DEMO_COOKIE)?.value === DEMO_USER_ID;
  const client = {
    from: (table: string) => new Query(table),
    async rpc(fn: string, args: Record<string, unknown> = {}): Promise<Result> {
      try {
        const db = await demoDb();
        const keys = Object.keys(args);
        const res = await db.query<{ r: unknown }>(
          `select public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")}) as r`,
          keys.map((k) => args[k]),
        );
        // is_admin also requires the demo session cookie.
        if (fn === "is_admin") return { data: signedIn() && res.rows[0]?.r === true, error: null };
        return { data: res.rows[0]?.r ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    auth: {
      async getClaims() {
        return signedIn()
          ? { data: { claims: { sub: DEMO_USER_ID, email: DEMO_EMAIL, role: "authenticated" } }, error: null }
          : { data: null, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          return { data: null, error: { message: "Invalid login credentials" } };
        }
        cookies.set(DEMO_COOKIE, DEMO_USER_ID, { httpOnly: true, sameSite: "lax", path: "/" });
        return { data: { user: { id: DEMO_USER_ID } }, error: null };
      },
      async signOut() {
        cookies.delete(DEMO_COOKIE);
        return { error: null };
      },
    },
  };
  return client as unknown as SupabaseClient;
}
