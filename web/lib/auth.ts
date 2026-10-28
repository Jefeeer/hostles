import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// ponytail: demo-grade auth — one shared password, no rate limiting. Use a real auth provider before giving this to a client for production.
export const PASSWORD = process.env.ADMIN_PASSWORD || 'lester-demo';
export const COOKIE = 'lester_admin';
export const token = () => createHash('sha256').update(`lester:${PASSWORD}`).digest('hex');

export const matches = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && matches(value, token());
}
