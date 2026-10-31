// Creates (or promotes) the admin user. Sign-ups are disabled, so this is the only way in.
//   pnpm admin:create lester@example.com 'a-strong-password'
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: pnpm admin:create <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let userId: string | undefined;
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    // Already exists: find them and reset the password.
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw created.error;
    userId = existing.id;
    const upd = await supabase.auth.admin.updateUserById(userId, { password });
    if (upd.error) throw upd.error;
    console.log("User existed; password updated.");
  } else {
    userId = created.data.user.id;
  }

  const { error } = await supabase.from("admins").upsert({ user_id: userId });
  if (error) throw error;
  console.log(`✓ ${email} is an admin.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
