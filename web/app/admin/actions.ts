'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { COOKIE, PASSWORD, isAdmin, matches, token } from '@/lib/auth';
import { isValidSite, resetContent, saveContent, type Site } from '@/lib/content';

export async function login(_: unknown, form: FormData) {
  if (!matches(String(form.get('password') ?? ''), PASSWORD)) return { error: 'Wrong password.' };
  (await cookies()).set(COOKIE, token(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect('/admin');
}

// On hosts with a read-only disk (e.g. Vercel) writes fail; say so plainly instead of a server error.
const READ_ONLY = { ok: false, message: "Saving isn’t available on this online demo yet. Changes only save when the site runs locally." };

export async function save(json: string) {
  if (!(await isAdmin())) return { ok: false, message: 'Your session expired. Log in again.' };
  let site: unknown;
  try { site = JSON.parse(json); } catch { return { ok: false, message: 'Could not read the changes.' }; }
  if (!(await isValidSite(site))) return { ok: false, message: 'Some content is missing; nothing was saved.' };
  try { await saveContent(site as Site); } catch { return READ_ONLY; }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved. The live site is updated.' };
}

export async function reset() {
  if (!(await isAdmin())) return { ok: false, message: 'Your session expired. Log in again.' };
  try { await resetContent(); } catch { return READ_ONLY; }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Demo content restored.' };
}
