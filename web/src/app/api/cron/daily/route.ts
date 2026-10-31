import { timingSafeEqual } from "node:crypto";
import { runDailyJobs } from "@/lib/reminders";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Vercel Cron (see vercel.json) calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await runDailyJobs(await createServiceClient());
  return Response.json(report);
}
