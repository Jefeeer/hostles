import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export type Video = { title: string; place: string; src: string; poster: string; facebook: string };
export type Feedback = { name: string; event: string; photo: string; text: string };
export type Photo = { area: string; src: string; alt: string };
export type Partner = { name: string; logo: string };

export type Site = {
  meta: { title: string; description: string };
  logo: string;
  nav: { about: string; videos: string; feedback: string; gallery: string; inquiry: string };
  socials: { facebook: string; instagram: string; tiktok: string };
  cover: { layout: 'split' | 'full'; photo: string; focus?: string; eyebrow: string; title: string; lead: string };
  about: { photo: string; eyebrow: string; heading: string; body: string; partnersLabel: string; partners: Partner[] };
  videos: { eyebrow: string; heading: string; facebookLabel: string; moreLabel: string; pageEyebrow: string; pageHeading: string; items: Video[] };
  feedback: { eyebrow: string; heading: string; percent: string; statLabel: string; url: string; items: Feedback[] };
  gallery: { eyebrow: string; heading: string; moreLabel: string; pageEyebrow: string; pageHeading: string; items: Photo[] };
  inquiry: { eyebrow: string; heading: string; email: string; eventTypes: string[]; submitLabel: string };
  footer: { copyright: string };
};

const DATA = path.join(process.cwd(), 'data');
const FILE = path.join(DATA, 'site.json');
const DEFAULT = path.join(DATA, 'site.default.json');

// ponytail: content lives in a JSON file on disk — fine locally; on Vercel the filesystem is read-only, so move to a database/Blob before going live.
export async function getContent(): Promise<Site> {
  // Until the first save there is no site.json; read the defaults directly (copying here raced with parallel reads).
  const file = await readFile(FILE, 'utf8').catch(() => readFile(DEFAULT, 'utf8'));
  return JSON.parse(file);
}

export async function saveContent(site: Site) {
  // Write then rename, so a visitor loading the page mid-save never reads half a file.
  await writeFile(`${FILE}.tmp`, JSON.stringify(site, null, 2));
  await rename(`${FILE}.tmp`, FILE);
}

export async function resetContent() {
  await rm(FILE, { force: true }); // falls back to the defaults
}

// Gallery photos grouped by area, keeping first-seen order; the first photo is the area's featured one.
export const groupByArea = (items: Photo[]) =>
  [...items.reduce((m, p) => m.set(p.area, [...(m.get(p.area) ?? []), p]), new Map<string, Photo[]>())];

// Minimal shape check for data coming from the admin form: same top-level sections and list fields as the defaults.
export async function isValidSite(value: unknown): Promise<boolean> {
  if (!value || typeof value !== 'object') return false;
  const ref: Record<string, unknown> = JSON.parse(await readFile(DEFAULT, 'utf8'));
  const v = value as Record<string, any>;
  return Object.keys(ref).every(k => typeof v[k] === typeof ref[k] && v[k] !== null)
    && ['about.partners', 'videos.items', 'feedback.items', 'gallery.items', 'inquiry.eventTypes']
      .every(p => { const [a, b] = p.split('.'); return Array.isArray(v[a]?.[b]); });
}
