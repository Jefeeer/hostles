"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/data";
import { isDemo } from "@/lib/demo/db";
import { SITE_KEY, isValidSite } from "@/lib/site";
import { MAX_SITE_MEDIA_BYTES, SITE_MEDIA_TYPES, putDemoSiteMedia, signSiteUpload } from "@/lib/storage";

type Result = { ok: boolean; message: string };

export async function saveSite(json: string): Promise<Result> {
  const supabase = await requireAdmin();
  let site: unknown;
  try { site = JSON.parse(json); } catch { return { ok: false, message: "Could not read the changes." }; }
  if (!isValidSite(site)) return { ok: false, message: "Some content is missing; nothing was saved." };
  const { error } = await supabase.from("settings").upsert({ key: SITE_KEY, value: site });
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  await logActivity(supabase, { entity_type: "settings", action: "settings.site", summary: "Website updated" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. The live site is updated." };
}

export async function resetSite(): Promise<Result> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("settings").delete().eq("key", SITE_KEY); // falls back to the original content
  if (error) return { ok: false, message: "Couldn't restore. Please try again." };
  await logActivity(supabase, { entity_type: "settings", action: "settings.site", summary: "Website restored to original content" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Original content restored." };
}

function mediaName(file: string, size: number): { name: string; type: string } | { error: string } {
  const ext = file.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? "";
  const type = SITE_MEDIA_TYPES[ext];
  if (!type) return { error: "Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV." };
  if (size > MAX_SITE_MEDIA_BYTES) return { error: "File is larger than 50 MB." };
  const base = file.slice(0, -ext.length).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  return { name: `${Date.now()}-${base}${ext}`, type };
}

/** Step 1 of an upload: where the browser should send the file. Demo mode has no Supabase Storage, so it posts to uploadDemoMedia. */
export async function prepareUpload(file: string, size: number): Promise<{ error: string } | { demo: true } | { uploadUrl: string; url: string }> {
  await requireAdmin();
  const n = mediaName(file, size);
  if ("error" in n) return n;
  if (isDemo()) return { demo: true };
  try { return await signSiteUpload(n.name); } catch { return { error: "Upload isn't available right now. Please try again." }; }
}

export async function uploadDemoMedia(fd: FormData): Promise<{ error: string } | { url: string }> {
  await requireAdmin();
  const file = fd.get("file");
  if (!isDemo() || !(file instanceof File)) return { error: "No file received." };
  const n = mediaName(file.name, file.size);
  if ("error" in n) return n;
  await putDemoSiteMedia(n.name, new Uint8Array(await file.arrayBuffer()), n.type);
  return { url: `/site-media/${n.name}` };
}
