#!/usr/bin/env node
/**
 * Create the first admin in a fresh environment.
 *
 * This replaces the old bootstrap, which was: sign up as a customer at
 * /sign-up, then run scripts/promote-staff.sh. Customer accounts — and
 * /sign-up with them — no longer exist, and /staff-invite deliberately
 * requires an already-authenticated admin. Without this script a new
 * deployment has no way to create its first staff user at all.
 *
 * Usage:
 *   node --env-file=.env.local scripts/bootstrap-admin.mjs \
 *     --email you@bazarrealestate.ae --name "Your Name" [--password '...']
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Prints a
 * generated password when one isn't supplied — copy it before it scrolls.
 *
 * Idempotent: an existing auth user is reused and, if they have no staff row,
 * promoted. Re-running never downgrades or overwrites an existing admin.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

function die(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

const email = (arg("--email") ?? "").trim().toLowerCase();
const displayName = (arg("--name") ?? "").trim();
const suppliedPassword = arg("--password");

if (!email.includes("@")) die("--email is required");
if (displayName.length < 2) die("--name is required");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  die(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — run with `node --env-file=.env.local`",
  );

// 24 bytes of base64url: long enough that nobody is tempted to keep it.
const password = suppliedPassword ?? randomBytes(24).toString("base64url");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Page through auth users; there is no email filter in this SDK version. */
async function findUser(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) die(`listing users failed: ${error.message}`);
    const hit = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === target,
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Mirrors handle_staff_invitation's slug de-duplication. */
async function uniqueSlug(name) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "staff";
  const { data } = await admin.from("staff").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 1; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

const existing = await findUser(email);
let userId;

if (existing) {
  userId = existing.id;
  console.log(`  · auth user already exists (${userId})`);
  if (suppliedPassword) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) die(`could not set the password: ${error.message}`);
    console.log("  · password updated");
  }
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: displayName.split(" ")[0] ?? "" },
  });
  if (error) die(`could not create the auth user: ${error.message}`);
  userId = data.user.id;
  console.log(`  · auth user created (${userId})`);
}

const { data: staffRow } = await admin
  .from("staff")
  .select("user_id, role, status")
  .eq("user_id", userId)
  .maybeSingle();

if (staffRow) {
  // Never silently downgrade or reactivate someone: report and stop.
  console.log(
    `  · staff row already exists — role=${staffRow.role}, status=${staffRow.status}`,
  );
  if (staffRow.role !== "admin" || staffRow.status !== "active") {
    console.log(
      "\n  ! Not promoting an existing staff row. Change it in the CMS, or delete the row and re-run.",
    );
  }
} else {
  const slug = await uniqueSlug(displayName);
  const { error } = await admin.from("staff").insert({
    user_id: userId,
    display_name: displayName,
    slug,
    role: "admin",
    status: "active",
    joined_at: new Date().toISOString().slice(0, 10),
  });
  if (error) die(`could not create the staff row: ${error.message}`);
  console.log(`  · staff row created (admin, slug=${slug})`);
}

console.log("\n  Sign in at /admin/login");
console.log(`  email    ${email}`);
if (!suppliedPassword && !existing) {
  console.log(`  password ${password}`);
  console.log("\n  Change it after signing in — this was printed to your terminal.");
} else if (suppliedPassword) {
  console.log("  password (the one you supplied)");
} else {
  console.log("  password unchanged — pass --password to reset it");
}
console.log("");
