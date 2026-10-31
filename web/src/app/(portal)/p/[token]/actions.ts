"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submitClientPayment } from "@/lib/payments";
import { findBookingByPortalToken } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS } from "@/lib/types";

const schema = z.object({
  amount: z.preprocess((v) => Number(String(v).replace(/[₱,\s]/g, "")), z.number().positive("Enter the amount you sent")),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).optional(),
  file: z.instanceof(File, { message: "Attach your screenshot or receipt" }),
});

export type UploadState = { error?: string; ok?: boolean } | undefined;

export async function uploadProof(token: string, _prev: UploadState, fd: FormData): Promise<UploadState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const supabase = await createServiceClient();
  const booking = await findBookingByPortalToken(supabase, token);
  if (!booking) return { error: "This link has expired. Please use the latest email from Lester." };
  try {
    await submitClientPayment(supabase, booking, parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/p/${token}`);
  return { ok: true };
}
