"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/data";
import type { FormState } from "../bookings/actions";

const blank = (v: unknown) => (v === "" ? null : v);
const text = z.preprocess(blank, z.string().trim().max(5000).nullable());

const clientSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  partner_name: text,
  email: z.preprocess(blank, z.email("Invalid email").nullable()),
  phone: text,
  facebook: text,
  city: text,
  pronunciation_notes: text,
  story: text,
  program_notes: text,
  notes: text,
});

export async function saveClient(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await requireAdmin();

  const q = id
    ? supabase.from("clients").update(parsed.data).eq("id", id).select("id").single()
    : supabase.from("clients").insert(parsed.data).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.message };

  await logActivity(supabase, {
    entity_type: "client", entity_id: data.id, action: id ? "client.updated" : "client.created",
    summary: `${parsed.data.full_name} ${id ? "updated" : "added"}`,
  });
  revalidatePath("/", "layout");
  redirect(`/clients/${data.id}?saved=1`, id ? RedirectType.push : RedirectType.replace);
}
