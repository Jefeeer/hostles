import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { getContent } from "@/lib/site";
import { SiteEditor } from "./site-editor";

export const metadata: Metadata = { title: "Website" };

export default async function WebsitePage() {
  await requireAdmin();
  return <SiteEditor initial={await getContent()} />;
}
