import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "./data";
import DEFAULT_SITE from "./site-default.json";

// Public website content (the landing page), edited at /website and stored in settings under "site".

export type Video = { title: string; place: string; src: string; poster: string; facebook: string };
export type Feedback = { name: string; event: string; photo: string; text: string };
export type Photo = { area: string; src: string; alt: string };
export type Partner = { name: string; logo: string };

export type Site = {
  meta: { title: string; description: string };
  logo: string;
  nav: { about: string; videos: string; feedback: string; gallery: string; inquiry: string };
  socials: { facebook: string; instagram: string; tiktok: string };
  cover: { layout: "split" | "full"; photo: string; focus?: string; eyebrow: string; title: string; lead: string };
  about: { photo: string; eyebrow: string; heading: string; body: string; partnersLabel: string; partners: Partner[] };
  videos: { eyebrow: string; heading: string; facebookLabel: string; moreLabel: string; pageEyebrow: string; pageHeading: string; items: Video[] };
  feedback: { eyebrow: string; heading: string; percent: string; statLabel: string; url: string; items: Feedback[] };
  gallery: { eyebrow: string; heading: string; moreLabel: string; pageEyebrow: string; pageHeading: string; items: Photo[] };
  inquiry: { eyebrow: string; heading: string; email: string; eventTypes: string[]; submitLabel: string };
  footer: { copyright: string };
};

export const SITE_KEY = "site";
export const defaultSite = () => structuredClone(DEFAULT_SITE) as Site;

// Public pages read with the service client (settings is admin-only under RLS); cached per request.
export const getContent = cache(async (): Promise<Site> =>
  getSetting<Site>(await createServiceClient(), SITE_KEY, defaultSite()));

// Gallery photos grouped by area, keeping first-seen order; the first photo is the area's featured one.
export const groupByArea = (items: Photo[]) =>
  [...items.reduce((m, p) => m.set(p.area, [...(m.get(p.area) ?? []), p]), new Map<string, Photo[]>())];

// Minimal shape check for data coming from the admin form: same top-level sections and list fields as the defaults.
export function isValidSite(value: unknown): value is Site {
  if (!value || typeof value !== "object") return false;
  const ref: Record<string, unknown> = DEFAULT_SITE;
  const v = value as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return Object.keys(ref).every((k) => typeof v[k] === typeof ref[k] && v[k] !== null)
    && ["about.partners", "videos.items", "feedback.items", "gallery.items", "inquiry.eventTypes"]
      .every((p) => { const [a, b] = p.split("."); return Array.isArray(v[a]?.[b]); });
}
