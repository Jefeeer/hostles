import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo/db";

const BUCKET = "payment-proofs";

export const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

/** Check the file really is what it claims (magic bytes), not just its extension/MIME. */
export function sniffType(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}

// Demo mode keeps files in a table instead of Supabase Storage.
async function demoPut(path: string, data: Uint8Array, contentType: string) {
  const { demoDb } = await import("@/lib/demo/db");
  await (await demoDb()).query(`insert into storage.demo_files (path, content_type, data) values ($1, $2, $3)`, [path, contentType, data]);
}
async function demoGet(path: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  const { demoDb } = await import("@/lib/demo/db");
  const res = await (await demoDb()).query<{ data: Uint8Array; content_type: string }>(`select data, content_type from storage.demo_files where path = $1`, [path]);
  const row = res.rows[0];
  return row ? { data: row.data, contentType: row.content_type } : null;
}

export async function putProof(path: string, data: Uint8Array, contentType: string) {
  if (isDemo()) return demoPut(path, data, contentType);
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, data, { contentType, upsert: false });
  if (error) throw error;
}

export async function getProof(path: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  if (isDemo()) return demoGet(path);
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { data: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
}

// ─── Website media (public bucket, see migration 20261031000001_website.sql) ───
const SITE_BUCKET = "site-media";
export const SITE_MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
};
export const MAX_SITE_MEDIA_BYTES = 50 * 1024 * 1024; // the bucket's limit

/** A one-time URL the admin's browser uploads to directly (skips Vercel's 4.5 MB request cap), plus the file's public URL. */
export async function signSiteUpload(name: string) {
  const storage = createAdminClient().storage.from(SITE_BUCKET);
  const { data, error } = await storage.createSignedUploadUrl(name);
  if (error) throw error;
  return { uploadUrl: data.signedUrl, url: storage.getPublicUrl(name).data.publicUrl };
}

export const putDemoSiteMedia = (name: string, data: Uint8Array, contentType: string) => demoPut(`${SITE_BUCKET}/${name}`, data, contentType);
export const getDemoSiteMedia = (name: string) => demoGet(`${SITE_BUCKET}/${name}`);
export const siteMediaPublicUrl = (name: string) => createAdminClient().storage.from(SITE_BUCKET).getPublicUrl(name).data.publicUrl;
