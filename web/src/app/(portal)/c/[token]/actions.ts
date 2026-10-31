"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signContract } from "@/lib/contracts";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z
  .object({
    name: z.string().trim().min(2, "Type your full name").max(120),
    mode: z.enum(["type", "draw"]),
    signature_text: z.string().trim().max(120).optional(),
    // PNG data URL from the canvas, capped at ~300 KB.
    signature_image: z.string().max(400_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).optional().or(z.literal("")),
    agree: z.literal("on", { message: "Please confirm you agree" }),
  })
  .refine((d) => (d.mode === "type" ? !!d.signature_text : !!d.signature_image), { path: ["signature"], message: "Please add your signature" });

export type SignState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; done?: boolean } | undefined;

export async function sign(token: string, _prev: SignState, fd: FormData): Promise<SignState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const h = await headers();
  try {
    await signContract(await createServiceClient(), token, {
      name: d.name,
      signatureText: d.mode === "type" ? d.signature_text : undefined,
      signatureImage: d.mode === "draw" ? d.signature_image || undefined : undefined,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/c/${token}`);
  return { done: true };
}
