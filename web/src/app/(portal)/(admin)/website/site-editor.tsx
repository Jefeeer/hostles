"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, ExternalLink, Image as ImageIcon, Images, LayoutDashboard, Mail, MessageSquareQuote, Plus,
  RotateCcw, SlidersHorizontal, Trash2, UserRound, Video, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { prepareUpload, resetSite, saveSite, uploadDemoMedia } from "./actions";

type Path = (string | number)[];
type Ask = { title: string; message: string; confirm: string };
type Ctx = { site: Site; set: (path: Path, value: unknown) => void; go: (tab: string) => void; ask: (a: Ask) => Promise<boolean> };
const Editor = createContext<Ctx>(null!);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (obj: any, path: Path) => path.reduce((o, k) => o?.[k], obj);
function setIn<T>(obj: T, path: Path, value: unknown): T {
  const copy = structuredClone(obj) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  path.slice(0, -1).reduce((o, k) => o[k], copy)[path.at(-1)!] = value;
  return copy;
}

/* ---------- Fields ---------- */

const fieldLabel = "text-sm font-medium";
const hintText = "text-xs text-muted-foreground";

function Text({ label, path, multiline, hint, wide }: { label: string; path: Path; multiline?: boolean; hint?: string; wide?: boolean }) {
  const { site, set } = useContext(Editor);
  const value = String(get(site, path) ?? "");
  return (
    <label className={cn("grid content-start gap-1.5", (multiline || wide) && "sm:col-span-2")}>
      <span className={fieldLabel}>{label}</span>
      {multiline
        ? <Textarea rows={5} value={value} onChange={(e) => set(path, e.target.value)} />
        : <Input className="h-10" value={value} onChange={(e) => set(path, e.target.value)} />}
      {hint && <small className={hintText}>{hint}</small>}
    </label>
  );
}

function Choice({ label, path, options }: { label: string; path: Path; options: [string, string][] }) {
  const { site, set } = useContext(Editor);
  return (
    <div className="grid gap-1.5 sm:col-span-2" role="radiogroup" aria-label={label}>
      <span className={fieldLabel}>{label}</span>
      <div className="inline-flex flex-wrap gap-1 justify-self-start rounded-lg border bg-muted/50 p-1">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={get(site, path) === v} onClick={() => set(path, v)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm">
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

async function uploadFile(file: File): Promise<string> {
  const target = await prepareUpload(file.name, file.size);
  if ("error" in target) throw new Error(target.error);
  if ("demo" in target) {
    const body = new FormData();
    body.append("file", file);
    const res = await uploadDemoMedia(body);
    if ("error" in res) throw new Error(res.error);
    return res.url;
  }
  // Straight to Supabase Storage, so big videos don't pass through the server.
  const res = await fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type, "x-upsert": "false" } });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  return target.url;
}

const isVideo = (src: string) => /\.(mp4|webm|mov)(\?|$)/i.test(src);

function Media({ label, path, kind = "image" }: { label: string; path: Path; kind?: "image" | "video" }) {
  const { site, set } = useContext(Editor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = String(get(site, path) ?? "");
  const Placeholder = kind === "video" ? Video : ImageIcon;

  async function upload(file: File) {
    setBusy(true); setError("");
    try { set(path, await uploadFile(file)); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <span className={fieldLabel}>{label}</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="grid aspect-[4/3] w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-muted-foreground">
          {value ? (kind === "video" ? <video src={value} muted preload="metadata" className="size-full object-cover" /> : <img src={value} alt="" className="size-full object-cover" />) : <Placeholder className="size-7 opacity-50" />}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="relative h-9 px-3">
              <label>
                {busy ? "Uploading…" : `Upload ${kind}`}
                <input type="file" className="absolute inset-0 cursor-pointer opacity-0" disabled={busy}
                  accept={kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif"}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              </label>
            </Button>
            {value && <button type="button" className="text-sm text-muted-foreground hover:text-destructive" onClick={() => set(path, "")}>Remove</button>}
          </div>
          <Input className="h-10" aria-label={`${label} link`} value={value} placeholder="or paste a link" onChange={(e) => set(path, e.target.value)} />
          <small className={hintText}>{kind === "video" ? "MP4, WEBM or MOV · up to 50 MB" : "JPG, PNG, WEBP or GIF"}</small>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function List<T>({ path, label, blank, title, thumb, children }: {
  path: Path; label: string; blank: T; title: (item: T) => string; thumb?: (item: T) => string; children: (base: Path) => ReactNode;
}) {
  const { site, set, ask } = useContext(Editor);
  const items: T[] = get(site, path);
  const [added, setAdded] = useState(-1); // a newly added item opens so its fields are visible
  const remove = async (i: number) => {
    const name = title(items[i]);
    if (await ask({ title: `Remove this ${label}?`, message: `${name ? `“${name}”` : "This item"} will be removed from the site when you save.`, confirm: "Remove" }))
      set(path, items.filter((_, j) => j !== i));
  };
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(path, next);
  };
  const iconBtn = "grid size-8 place-items-center rounded-md border bg-background hover:border-brand/60 disabled:opacity-30 [&_svg]:size-4";
  return (
    <div className="grid gap-2 sm:col-span-2">
      {items.map((item, i) => {
        const src = thumb?.(item);
        return (
          <details key={i} className="group rounded-lg border bg-background open:border-brand/50" open={items.length <= 2 || i === added}>
            <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
              {thumb && <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-muted">{src ? (isVideo(src) ? <video src={src} muted preload="metadata" className="size-full object-cover" /> : <img src={src} alt="" className="size-full object-cover" />) : null}</span>}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title(item) || "Untitled"}</span>
              <span className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></button>
                <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></button>
                <button type="button" className={cn(iconBtn, "hover:border-destructive hover:text-destructive")} onClick={() => remove(i)} aria-label="Remove"><Trash2 /></button>
              </span>
            </summary>
            <div className="grid gap-4 border-t p-4 sm:grid-cols-2">{children([...path, i])}</div>
          </details>
        );
      })}
      <Button type="button" variant="outline" className="h-10 justify-self-start border-dashed" onClick={() => { set(path, [...items, structuredClone(blank)]); setAdded(items.length); }}>
        <Plus /> Add {label}
      </Button>
    </div>
  );
}

function StringList({ path, label }: { path: Path; label: string }) {
  const { site, set } = useContext(Editor);
  const items: string[] = get(site, path);
  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <span className={fieldLabel}>{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((v, i) => (
          <div className="flex items-center gap-1.5" key={i}>
            <Input className="h-10" value={v} onChange={(e) => set([...path, i], e.target.value)} aria-label={`Option ${i + 1}`} />
            <Button type="button" variant="ghost" size="icon" className="hover:text-destructive" onClick={() => set(path, items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="h-10 justify-self-start border-dashed" onClick={() => set(path, [...items, ""])}><Plus /> Add option</Button>
    </div>
  );
}

const Group = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <section className="rounded-xl border bg-card">
    <header className="border-b px-5 py-4">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
    </header>
    <div className="grid gap-5 p-5 sm:grid-cols-2">{children}</div>
  </section>
);

/* ---------- Overview ---------- */

function Overview() {
  const { site, go } = useContext(Editor);
  const areas = new Set(site.gallery.items.map((p) => p.area)).size;
  const stats: [string, number, string, string, LucideIcon][] = [
    ["Videos", site.videos.items.length, `${Math.min(4, site.videos.items.length)} featured on home`, "Videos", Video],
    ["Feedback", site.feedback.items.length, "client cards", "Feedback", MessageSquareQuote],
    ["Photos", site.gallery.items.length, `${areas} area${areas === 1 ? "" : "s"}`, "Gallery", Images],
    ["Partners", site.about.partners.length, "supplier logos", "About", UserRound],
  ];
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, n, sub, tab, Icon]) => (
          <button key={label} onClick={() => go(tab)} className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-brand/50">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Icon className="size-4 text-brand" />{label}</span>
            <strong className="tabular mt-1.5 block text-2xl font-bold">{n}</strong>
            <small className={hintText}>{sub}</small>
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border bg-card">
          <header className="border-b px-5 py-4"><h2 className="font-semibold">Live site</h2><p className="text-sm text-muted-foreground">What visitors see right now. Saved changes show here.</p></header>
          {/* Renders the site at desktop width, scaled down to fit. */}
          <div className="relative m-4 aspect-[16/11] overflow-hidden rounded-lg border">
            <iframe src="/" title="Live site preview" loading="lazy" className="pointer-events-none absolute top-0 left-0 h-[250%] w-[250%] origin-top-left scale-[.4] border-0" />
          </div>
        </section>
        <section className="rounded-xl border bg-card">
          <header className="border-b px-5 py-4"><h2 className="font-semibold">What do you want to change?</h2><p className="text-sm text-muted-foreground">Pick a part of the website.</p></header>
          <div className="grid p-2">
            {TABS.slice(1).map((t) => (
              <button key={t.name} onClick={() => go(t.name)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted">
                <t.icon className="size-5 shrink-0 text-brand" />
                <span className="grid leading-tight"><strong className="text-sm">{t.name}</strong><small className={hintText}>{t.desc}</small></span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Tabs (one per part of the site) ---------- */

type Tab = { name: string; icon: LucideIcon; desc: string; anchor?: string; count?: (s: Site) => number; body: () => ReactNode };

const TABS: Tab[] = [
  { name: "Overview", icon: LayoutDashboard, desc: "Your website at a glance", body: Overview },
  { name: "Cover", icon: ImageIcon, desc: "The first screen visitors see", anchor: "/#top", body: () => <>
    <Group title="Photo">
      <Choice label="Layout" path={["cover", "layout"]} options={[["split", "One-sided photo"], ["full", "Whole-page photo"]]} />
      <Media label="Cover photo" path={["cover", "photo"]} />
      <Choice label="Photo focus (which part stays in view)" path={["cover", "focus"]} options={[["center 0%", "Top"], ["center 20%", "Upper"], ["center 50%", "Middle"], ["center 100%", "Bottom"]]} />
      <p className={cn(hintText, "sm:col-span-2")}>Tip: “Whole-page photo” looks best with a wide (landscape) photo. A tall portrait gets cropped close.</p>
    </Group>
    <Group title="Text">
      <Text label="Small label" path={["cover", "eyebrow"]} />
      <Text label="Name / title" path={["cover", "title"]} />
      <Text label="Tagline" path={["cover", "lead"]} wide />
    </Group>
  </> },
  { name: "About", icon: UserRound, desc: "Your bio, photo and partner suppliers", anchor: "/#about", count: (s) => s.about.partners.length, body: () => <>
    <Group title="About me">
      <Text label="Small label" path={["about", "eyebrow"]} />
      <Text label="Heading" path={["about", "heading"]} />
      <Text label="Bio" path={["about", "body"]} multiline hint="Leave a blank line between paragraphs." />
      <Media label="Photo" path={["about", "photo"]} />
    </Group>
    <Group title="Partner suppliers" note="Shown at the end of the About section. The name shows when there is no logo.">
      <Text label="Section label" path={["about", "partnersLabel"]} wide />
      <List path={["about", "partners"]} label="partner" blank={{ name: "", logo: "" }} title={(p) => p.name} thumb={(p) => p.logo}>
        {(b) => <><Text label="Name" path={[...b, "name"]} wide /><Media label="Logo (optional)" path={[...b, "logo"]} /></>}
      </List>
    </Group>
  </> },
  { name: "Videos", icon: Video, desc: "Featured videos and the videos page", anchor: "/#videos", count: (s) => s.videos.items.length, body: () => <>
    <Group title="Videos" note="The first 4 are featured on the home page. All of them appear on the videos page.">
      <List path={["videos", "items"]} label="video" blank={{ title: "", place: "", src: "", poster: "", facebook: "" }} title={(v) => v.title} thumb={(v) => v.poster || v.src}>
        {(b) => <>
          <Text label="Title" path={[...b, "title"]} />
          <Text label="Venue / place" path={[...b, "place"]} />
          <Media label="Video file" path={[...b, "src"]} kind="video" />
          <Media label="Cover image" path={[...b, "poster"]} />
          <Text label="Facebook link" path={[...b, "facebook"]} wide />
        </>}
      </List>
    </Group>
    <Group title="Home page section">
      <Text label="Small label" path={["videos", "eyebrow"]} />
      <Text label="Heading" path={["videos", "heading"]} />
      <Text label="Facebook link text" path={["videos", "facebookLabel"]} />
      <Text label="See more button" path={["videos", "moreLabel"]} />
    </Group>
    <Group title="Videos page">
      <Text label="Small label" path={["videos", "pageEyebrow"]} />
      <Text label="Heading" path={["videos", "pageHeading"]} />
    </Group>
  </> },
  { name: "Feedback", icon: MessageSquareQuote, desc: "Client feedback and the highlight", anchor: "/#feedback", count: (s) => s.feedback.items.length, body: () => <>
    <Group title="Client feedback" note="Feedback longer than 100 characters shows “Read more”.">
      <List path={["feedback", "items"]} label="feedback" blank={{ name: "", event: "", photo: "", text: "" }} title={(f) => f.name} thumb={(f) => f.photo}>
        {(b) => <>
          <Text label="Client name" path={[...b, "name"]} />
          <Text label="Event" path={[...b, "event"]} />
          <Text label="Feedback" path={[...b, "text"]} multiline />
          <Media label="Photo" path={[...b, "photo"]} />
        </>}
      </List>
    </Group>
    <Group title="Section and highlight">
      <Text label="Small label" path={["feedback", "eyebrow"]} />
      <Text label="Heading" path={["feedback", "heading"]} />
      <Text label="Highlight number" path={["feedback", "percent"]} />
      <Text label="Highlight text" path={["feedback", "statLabel"]} />
      <Text label="Facebook reviews link" path={["feedback", "url"]} wide />
    </Group>
  </> },
  { name: "Gallery", icon: Images, desc: "Photos by area and the gallery page", anchor: "/#gallery", count: (s) => s.gallery.items.length, body: () => <>
    <Group title="Photos" note="Photos with the same area are grouped. The first photo of each area is featured on the home page.">
      <List path={["gallery", "items"]} label="photo" blank={{ area: "", src: "", alt: "" }} title={(p) => `${p.area || "No area"} · ${p.alt || "Photo"}`} thumb={(p) => p.src}>
        {(b) => <>
          <Text label="Area" path={[...b, "area"]} hint="e.g. Tagaytay" />
          <Text label="Description" path={[...b, "alt"]} hint="Read aloud by screen readers" />
          <Media label="Photo" path={[...b, "src"]} />
        </>}
      </List>
    </Group>
    <Group title="Home page section">
      <Text label="Small label" path={["gallery", "eyebrow"]} />
      <Text label="Heading" path={["gallery", "heading"]} />
      <Text label="View more button" path={["gallery", "moreLabel"]} />
    </Group>
    <Group title="Gallery page">
      <Text label="Small label" path={["gallery", "pageEyebrow"]} />
      <Text label="Heading" path={["gallery", "pageHeading"]} />
    </Group>
  </> },
  { name: "Inquiry form", icon: Mail, desc: "The booking form at the bottom of the page", anchor: "/#inquire", body: () => <>
    <Group title="Where inquiries go">
      <p className="text-sm sm:col-span-2">
        Every inquiry from this form shows up in <Link href="/bookings" className="font-semibold text-brand-deep underline dark:text-brand">Leads &amp; bookings</Link> as a new lead,
        and you get an email (set the address in <Link href="/settings#email" className="font-semibold text-brand-deep underline dark:text-brand">Settings → Email</Link>).
      </p>
    </Group>
    <Group title="Form">
      <Text label="Small label" path={["inquiry", "eyebrow"]} />
      <Text label="Heading" path={["inquiry", "heading"]} />
      <StringList label="Types of event (“Wedding” asks for the ceremony start time)" path={["inquiry", "eventTypes"]} />
      <Text label="Button text" path={["inquiry", "submitLabel"]} />
    </Group>
  </> },
  { name: "General", icon: SlidersHorizontal, desc: "Site name, logo, menu and social links", anchor: "/", body: () => <>
    <Group title="Site" note="Shown in the browser tab, search results and footer.">
      <Text label="Site name" path={["meta", "title"]} />
      <Text label="Footer copyright name" path={["footer", "copyright"]} />
      <Text label="Search description" path={["meta", "description"]} multiline />
      <Media label="Logo" path={["logo"]} />
    </Group>
    <Group title="Menu labels" note="The links in the top bar and the mobile menu.">
      <Text label="About" path={["nav", "about"]} />
      <Text label="Videos" path={["nav", "videos"]} />
      <Text label="Feedback" path={["nav", "feedback"]} />
      <Text label="Gallery" path={["nav", "gallery"]} />
      <Text label="Inquiry" path={["nav", "inquiry"]} />
    </Group>
    <Group title="Social links" note="Shown as icons in the menu and footer. Leave one empty to hide it.">
      <Text label="Facebook" path={["socials", "facebook"]} wide />
      <Text label="Instagram" path={["socials", "instagram"]} wide />
      <Text label="TikTok" path={["socials", "tiktok"]} wide />
    </Group>
  </> },
];

/* ---------- Editor shell ---------- */

export function SiteEditor({ initial }: { initial: Site }) {
  const [site, setSite] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState("Overview");
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const dirty = JSON.stringify(site) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault(); // don't lose unsaved edits on reload/close
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ask = (a: Ask) => new Promise<boolean>((resolve) => setDialog({ ...a, resolve }));
  const closeDialog = (ok: boolean) => { dialog?.resolve(ok); setDialog(null); };
  const go = (name: string) => { setTab(name); scrollTo({ top: 0 }); };

  const onSave = () => start(async () => {
    const res = await saveSite(JSON.stringify(site));
    if (res.ok) { setSaved(site); toast.success(res.message); } else toast.error(res.message);
  });
  const onReset = async () => {
    if (!(await ask({ title: "Restore the original website?", message: "Every part of the website goes back to how it was when it moved into this portal. Your edits will be replaced and this can’t be undone.", confirm: "Restore" }))) return;
    start(async () => {
      const res = await resetSite();
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      location.reload();
    });
  };

  const current = TABS.find((t) => t.name === tab)!;
  const Body = current.body;

  return (
    <Editor.Provider value={{ site, go, ask, set: (path, value) => setSite((s) => setIn(s, path, value)) }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">Change what visitors see on your public site. Nothing goes live until you press Save.</p>
        </div>
        <Button asChild variant="outline" className="h-9">
          <a href={current.anchor ?? "/"} target="_blank" rel="noopener"><ExternalLink /> View live site</a>
        </Button>
      </div>

      {/* Sticky so Save is always in reach; sits under the phone header. */}
      <div className="sticky top-[52px] z-20 -mx-4 mb-5 border-b bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <span role="status" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <i aria-hidden className={cn("size-2 shrink-0 rounded-full", pending || dirty ? "bg-brand" : "bg-emerald-500")} />
            <span className="truncate">{pending ? "Saving…" : dirty ? "You have unsaved changes" : "All changes saved"}</span>
          </span>
          <Button onClick={onSave} disabled={!dirty || pending} className="h-9 px-5 font-semibold">Save changes</Button>
        </div>
        <nav aria-label="Parts of the website" className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {TABS.map((t) => (
            <button key={t.name} onClick={() => go(t.name)} aria-current={t.name === tab ? "page" : undefined}
              className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:border-brand/50 aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink">
              <t.icon className="size-4" />{t.name}
              {t.count && <span className="tabular rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{t.count(site)}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5">
        {tab !== "Overview" && <p className="text-sm text-muted-foreground">{current.desc}</p>}
        <Body />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onReset} disabled={pending}><RotateCcw /> Restore original website</Button>
        </div>
      </div>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && closeDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.title}</DialogTitle>
            <DialogDescription>{dialog?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>Never mind</Button>
            <Button variant="destructive" onClick={() => closeDialog(true)}>{dialog?.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Editor.Provider>
  );
}
