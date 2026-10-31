"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/data";
import { syncMonthToSheet } from "@/lib/sheets";

export async function syncSheet(y: number, m: number) {
  const supabase = await requireAdmin();
  const r = await syncMonthToSheet(supabase, y, m);
  revalidatePath("/records");
  return r;
}
