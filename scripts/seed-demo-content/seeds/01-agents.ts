/**
 * Seed twelve advisors into auth.users + public.staff.
 *
 * Why this is two-step: staff.user_id has a FK on auth.users(id), so we
 * must create the auth user before the staff row. We use the admin API
 * (service-role key) and look up existing users by email so re-runs
 * converge rather than collide on "User already registered".
 *
 * Idempotency: keyed on email_local + slug. Re-running mutates only the
 * staff row (display_name, title, bio, etc.); the auth.users row is
 * created once and looked up thereafter.
 */
import { adminClient } from "../lib/client.ts";
import { log } from "../lib/log.ts";
import { countRows } from "../lib/count.ts";
import { AGENTS, type AgentSeed } from "../data/agents.ts";
import type { SeedContext } from "../index.ts";

const EMAIL_DOMAIN = "bazar.ae";
/** Predictable password for demo accounts. Bazar resets these at handover. */
const DEMO_PASSWORD = "DemoAdvisor!2026";

async function findUserByEmail(email: string): Promise<string | null> {
  const supabase = adminClient();
  // listUsers paginates; staff table is small so page 1 is enough.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function ensureAuthUser(agent: AgentSeed): Promise<string> {
  const supabase = adminClient();
  const email = `${agent.email_local}@${EMAIL_DOMAIN}`;
  const existing = await findUserByEmail(email);
  if (existing) {
    log.dim(`auth.users · ${email} exists (${existing.slice(0, 8)}…)`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: agent.display_name,
      role: "agent",
      seeded: true,
    },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message ?? "no user returned"}`);
  log.ok(`auth.users · ${email} created (${data.user.id.slice(0, 8)}…)`);
  return data.user.id;
}

async function upsertStaff(userId: string, agent: AgentSeed): Promise<void> {
  const supabase = adminClient();
  const { error } = await supabase
    .from("staff")
    .upsert(
      {
        user_id: userId,
        display_name: agent.display_name,
        slug: agent.slug,
        title: agent.title,
        brn: agent.brn,
        photo_url: null,
        bio: agent.bio,
        specialties: agent.specialties,
        languages: agent.languages,
        credentials: agent.credentials,
        role: "agent",
        status: "active",
        joined_at: agent.joined_at,
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`upsert staff ${agent.slug}: ${error.message}`);
}

export async function runAgents(ctx: SeedContext): Promise<void> {
  log.step("Seeding 12 advisors (auth.users + staff)");
  const before = await countRows("staff", { col: "role", val: "agent" });

  for (const agent of AGENTS) {
    const userId = await ensureAuthUser(agent);
    await upsertStaff(userId, agent);
    ctx.agents.set(agent.slug, userId);
    log.ok(`staff · ${agent.slug}`);
  }

  const after = await countRows("staff", { col: "role", val: "agent" });
  log.summary([{ label: "staff (role=agent)", before, after }]);
}
