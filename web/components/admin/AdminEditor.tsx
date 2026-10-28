'use client';
import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import type { Site } from '@/lib/content';
import { logout, reset, save } from '@/app/admin/actions';

type Path = (string | number)[];
type Ask = { title: string; message: string; confirm: string; danger?: boolean };
type Ctx = { site: Site; set: (path: Path, value: unknown) => void; go: (tab: string) => void; ask: (a: Ask) => Promise<boolean> };
const Editor = createContext<Ctx>(null!);

const get = (obj: any, path: Path) => path.reduce((o, k) => o?.[k], obj);
function setIn<T>(obj: T, path: Path, value: unknown): T {
  const copy = structuredClone(obj) as any;
  path.slice(0, -1).reduce((o, k) => o[k], copy)[path.at(-1)!] = value;
  return copy;
}

/* ---------- Icons ---------- */

const ICON: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  general: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  cover: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  about: <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  videos: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4z" /></>,
  feedback: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  gallery: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /></>,
  inquiry: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  external: <path d="M7 17 17 7M7 7h10v10" />,
  up: <path d="m18 15-6-6-6 6" />, down: <path d="m6 9 6 6 6-6" />, trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />, close: <path d="M6 6l12 12M18 6 6 18" />
};
const Icon = ({ name }: { name: string }) => (
  <svg className="a-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>
);

/* ---------- Fields ---------- */

function Text({ label, path, multiline, hint, wide }: { label: string; path: Path; multiline?: boolean; hint?: string; wide?: boolean }) {
  const { site, set } = useContext(Editor);
  const value = String(get(site, path) ?? '');
  return (
    <label className={`a-field${multiline || wide ? ' a-wide' : ''}`}>
      <span>{label}</span>
      {multiline
        ? <textarea rows={5} value={value} onChange={e => set(path, e.target.value)} />
        : <input value={value} onChange={e => set(path, e.target.value)} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Choice({ label, path, options }: { label: string; path: Path; options: [string, string][] }) {
  const { site, set } = useContext(Editor);
  return (
    <div className="a-field a-wide" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div className="a-segment">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={get(site, path) === v} onClick={() => set(path, v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Media({ label, path, kind = 'image' }: { label: string; path: Path; kind?: 'image' | 'video' }) {
  const { site, set } = useContext(Editor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const value = String(get(site, path) ?? '');

  async function upload(file: File) {
    setBusy(true); setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set(path, data.url);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Upload failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="a-field a-media a-wide">
      <span>{label}</span>
      <div className="a-media-row">
        <div className="a-preview">
          {value ? (kind === 'video' ? <video src={value} muted preload="metadata" /> : <img src={value} alt="" />) : <Icon name={kind === 'video' ? 'videos' : 'cover'} />}
        </div>
        <div className="a-media-controls">
          <div className="a-media-buttons">
            <label className="a-upload">
              {busy ? 'Uploading…' : `Upload ${kind}`}
              <input type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif'} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            </label>
            {value && <button type="button" className="a-link" onClick={() => set(path, '')}>Remove</button>}
          </div>
          <input aria-label={`${label} URL`} value={value} placeholder="or paste a link" onChange={e => set(path, e.target.value)} />
          <small>{kind === 'video' ? 'MP4, WEBM or MOV · up to 200 MB' : 'JPG, PNG, WEBP or GIF'}</small>
          {error && <p className="admin-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function List<T>({ path, label, blank, title, thumb, children }: {
  path: Path; label: string; blank: T; title: (item: T) => string; thumb?: (item: T) => string; children: (base: Path) => React.ReactNode;
}) {
  const { site, set, ask } = useContext(Editor);
  const items: T[] = get(site, path);
  const remove = async (i: number) => {
    const name = title(items[i]);
    if (await ask({ title: `Remove this ${label}?`, message: `${name ? `“${name}”` : 'This item'} will be removed from the site when you save.`, confirm: 'Remove', danger: true }))
      set(path, items.filter((_, j) => j !== i));
  };
  const [added, setAdded] = useState(-1); // newly added item opens so its fields are visible
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(path, next);
  };
  return (
    <div className="a-list a-wide">
      {items.map((item, i) => {
        const src = thumb?.(item);
        return (
          <details key={i} className="a-item" open={items.length <= 2 || i === added}>
            <summary>
              <span className="a-num">{i + 1}</span>
              {thumb && <span className="a-thumb">{src ? (/\.(mp4|webm|mov)$/i.test(src) ? <video src={src} muted preload="metadata" /> : <img src={src} alt="" />) : null}</span>}
              <span className="a-item-title">{title(item) || 'Untitled'}</span>
              <span className="a-item-actions" onClick={e => e.preventDefault()}>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" /></button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" /></button>
                <button type="button" className="a-danger" onClick={() => remove(i)} aria-label="Remove"><Icon name="trash" /></button>
              </span>
            </summary>
            <div className="a-item-body">{children([...path, i])}</div>
          </details>
        );
      })}
      <button type="button" className="a-add" onClick={() => { set(path, [...items, structuredClone(blank)]); setAdded(items.length); }}><Icon name="plus" /> Add {label}</button>
    </div>
  );
}

function StringList({ path, label }: { path: Path; label: string }) {
  const { site, set } = useContext(Editor);
  const items: string[] = get(site, path);
  return (
    <div className="a-field a-wide">
      <span>{label}</span>
      <div className="a-chips">
        {items.map((v, i) => (
          <div className="a-inline" key={i}>
            <input value={v} onChange={e => set([...path, i], e.target.value)} aria-label={`Option ${i + 1}`} />
            <button type="button" className="a-danger" onClick={() => set(path, items.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="a-add" onClick={() => set(path, [...items, ''])}><Icon name="plus" /> Add option</button>
    </div>
  );
}

const Group = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="a-group">
    <header><h2>{title}</h2>{note && <p>{note}</p>}</header>
    <div className="a-grid">{children}</div>
  </section>
);

/* ---------- Dashboard ---------- */

function Dashboard() {
  const { site, go } = useContext(Editor);
  const areas = new Set(site.gallery.items.map(p => p.area)).size;
  const stats: [string, number, string, string][] = [
    ['Videos', site.videos.items.length, `${Math.min(4, site.videos.items.length)} featured on home`, 'Videos'],
    ['Feedback', site.feedback.items.length, 'client cards', 'Feedback'],
    ['Photos', site.gallery.items.length, `${areas} area${areas === 1 ? '' : 's'}`, 'Gallery'],
    ['Partners', site.about.partners.length, 'supplier logos', 'About']
  ];
  return <>
    <div className="a-stats">
      {stats.map(([label, n, sub, tab]) => (
        <button key={label} className="a-stat" onClick={() => go(tab)}>
          <span className="a-stat-label"><Icon name={tab.toLowerCase()} />{label}</span>
          <strong>{n}</strong>
          <small>{sub}</small>
        </button>
      ))}
    </div>
    <div className="a-dash">
      <section className="a-group">
        <header><h2>Live site</h2><p>What visitors see right now. Saved changes appear here.</p></header>
        <div className="a-frame"><iframe src="/" title="Live site preview" loading="lazy" /></div>
      </section>
      <section className="a-group">
        <header><h2>Quick edits</h2><p>Jump straight to a section.</p></header>
        <div className="a-quick">
          {TABS.slice(1).map(t => (
            <button key={t.name} onClick={() => go(t.name)}>
              <Icon name={t.icon} /><span><strong>{t.name}</strong><small>{t.desc}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  </>;
}

/* ---------- Tabs (one per section / page) ---------- */

type Tab = { name: string; icon: string; desc: string; anchor?: string; count?: (s: Site) => number; body: () => React.ReactNode };

const TABS: Tab[] = [
  { name: 'Dashboard', icon: 'dashboard', desc: 'Overview of your website', body: Dashboard },
  { name: 'General', icon: 'general', desc: 'Name, logo, menu and social links', anchor: '/', body: () => <>
    <Group title="Site" note="Shown in the browser tab, search results and footer.">
      <Text label="Site name" path={['meta', 'title']} />
      <Text label="Footer copyright name" path={['footer', 'copyright']} />
      <Text label="Search description" path={['meta', 'description']} multiline />
      <Media label="Logo" path={['logo']} />
    </Group>
    <Group title="Menu labels" note="The links in the top bar and the mobile menu.">
      <Text label="About" path={['nav', 'about']} />
      <Text label="Videos" path={['nav', 'videos']} />
      <Text label="Feedback" path={['nav', 'feedback']} />
      <Text label="Gallery" path={['nav', 'gallery']} />
      <Text label="Inquiry" path={['nav', 'inquiry']} />
    </Group>
    <Group title="Social links" note="Shown as icons in the menu and footer. Leave one empty to hide it.">
      <Text label="Facebook" path={['socials', 'facebook']} wide />
      <Text label="Instagram" path={['socials', 'instagram']} wide />
      <Text label="TikTok" path={['socials', 'tiktok']} wide />
    </Group>
  </> },
  { name: 'Cover', icon: 'cover', desc: 'The first screen visitors see', anchor: '/#top', body: () => <>
    <Group title="Photo">
      <Choice label="Layout" path={['cover', 'layout']} options={[['split', 'One-sided photo'], ['full', 'Whole-page photo']]} />
      <Media label="Cover photo" path={['cover', 'photo']} />
      <Choice label="Photo focus (which part stays in view)" path={['cover', 'focus']} options={[['center 0%', 'Top'], ['center 20%', 'Upper'], ['center 50%', 'Middle'], ['center 100%', 'Bottom']]} />
      <p className="a-note a-wide">Tip: “Whole-page photo” looks best with a wide (landscape) photo. A tall portrait gets cropped close.</p>
    </Group>
    <Group title="Text">
      <Text label="Small label" path={['cover', 'eyebrow']} />
      <Text label="Name / title" path={['cover', 'title']} />
      <Text label="Tagline" path={['cover', 'lead']} wide />
    </Group>
  </> },
  { name: 'About', icon: 'about', desc: 'Your bio, photo and partner suppliers', anchor: '/#about', count: s => s.about.partners.length, body: () => <>
    <Group title="About Me">
      <Text label="Small label" path={['about', 'eyebrow']} />
      <Text label="Heading" path={['about', 'heading']} />
      <Text label="Bio" path={['about', 'body']} multiline hint="Leave a blank line between paragraphs." />
      <Media label="Photo" path={['about', 'photo']} />
    </Group>
    <Group title="Partner suppliers" note="Shown at the end of the About section. The name shows when there is no logo.">
      <Text label="Section label" path={['about', 'partnersLabel']} wide />
      <List path={['about', 'partners']} label="partner" blank={{ name: '', logo: '' }} title={p => p.name} thumb={p => p.logo}>
        {b => <><Text label="Name" path={[...b, 'name']} wide /><Media label="Logo (optional)" path={[...b, 'logo']} /></>}
      </List>
    </Group>
  </> },
  { name: 'Videos', icon: 'videos', desc: 'Featured videos and the videos page', anchor: '/#videos', count: s => s.videos.items.length, body: () => <>
    <Group title="Videos" note="The first 4 are featured on the home page. All of them appear on the videos page.">
      <List path={['videos', 'items']} label="video" blank={{ title: '', place: '', src: '', poster: '', facebook: '' }} title={v => v.title} thumb={v => v.poster || v.src}>
        {b => <>
          <Text label="Title" path={[...b, 'title']} />
          <Text label="Venue / place" path={[...b, 'place']} />
          <Media label="Video file" path={[...b, 'src']} kind="video" />
          <Media label="Cover image" path={[...b, 'poster']} />
          <Text label="Facebook link" path={[...b, 'facebook']} wide />
        </>}
      </List>
    </Group>
    <Group title="Home page section">
      <Text label="Small label" path={['videos', 'eyebrow']} />
      <Text label="Heading" path={['videos', 'heading']} />
      <Text label="Facebook link text" path={['videos', 'facebookLabel']} />
      <Text label="See more button" path={['videos', 'moreLabel']} />
    </Group>
    <Group title="Videos page">
      <Text label="Small label" path={['videos', 'pageEyebrow']} />
      <Text label="Heading" path={['videos', 'pageHeading']} />
    </Group>
  </> },
  { name: 'Feedback', icon: 'feedback', desc: 'Client feedback and the highlight', anchor: '/#feedback', count: s => s.feedback.items.length, body: () => <>
    <Group title="Client feedback" note="Feedback longer than 100 characters shows “Read more”.">
      <List path={['feedback', 'items']} label="feedback" blank={{ name: '', event: '', photo: '', text: '' }} title={f => f.name} thumb={f => f.photo}>
        {b => <>
          <Text label="Client name" path={[...b, 'name']} />
          <Text label="Event" path={[...b, 'event']} />
          <Text label="Feedback" path={[...b, 'text']} multiline />
          <Media label="Photo" path={[...b, 'photo']} />
        </>}
      </List>
    </Group>
    <Group title="Section and highlight">
      <Text label="Small label" path={['feedback', 'eyebrow']} />
      <Text label="Heading" path={['feedback', 'heading']} />
      <Text label="Highlight number" path={['feedback', 'percent']} />
      <Text label="Highlight text" path={['feedback', 'statLabel']} />
      <Text label="Facebook reviews link" path={['feedback', 'url']} wide />
    </Group>
  </> },
  { name: 'Gallery', icon: 'gallery', desc: 'Photos by area and the gallery page', anchor: '/#gallery', count: s => s.gallery.items.length, body: () => <>
    <Group title="Photos" note="Photos with the same area are grouped. The first photo of each area is featured on the home page.">
      <List path={['gallery', 'items']} label="photo" blank={{ area: '', src: '', alt: '' }} title={p => `${p.area || 'No area'} · ${p.alt || 'Photo'}`} thumb={p => p.src}>
        {b => <>
          <Text label="Area" path={[...b, 'area']} hint="e.g. Tagaytay" />
          <Text label="Description" path={[...b, 'alt']} hint="Read aloud by screen readers" />
          <Media label="Photo" path={[...b, 'src']} />
        </>}
      </List>
    </Group>
    <Group title="Home page section">
      <Text label="Small label" path={['gallery', 'eyebrow']} />
      <Text label="Heading" path={['gallery', 'heading']} />
      <Text label="View more button" path={['gallery', 'moreLabel']} />
    </Group>
    <Group title="Gallery page">
      <Text label="Small label" path={['gallery', 'pageEyebrow']} />
      <Text label="Heading" path={['gallery', 'pageHeading']} />
    </Group>
  </> },
  { name: 'Inquiry', icon: 'inquiry', desc: 'Booking form and email', anchor: '/#inquire', body: () => <>
    <Group title="Where inquiries go">
      <Text label="Booking email" path={['inquiry', 'email']} wide hint="The form opens the visitor's email app addressed to this email." />
    </Group>
    <Group title="Form">
      <Text label="Small label" path={['inquiry', 'eyebrow']} />
      <Text label="Heading" path={['inquiry', 'heading']} />
      <StringList label="Types of event (“Wedding” asks for the ceremony start time)" path={['inquiry', 'eventTypes']} />
      <Text label="Button text" path={['inquiry', 'submitLabel']} />
    </Group>
  </> }
];

/* ---------- Confirm dialog (replaces the browser's confirm()) ---------- */

function ConfirmDialog({ ask, onDone }: { ask: Ask | null; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (ask && !ref.current?.open) ref.current?.showModal(); }, [ask]);
  const close = (ok: boolean) => { ref.current?.close(); onDone(ok); };
  return (
    <dialog ref={ref} className="a-dialog" aria-labelledby="a-dialog-title" aria-describedby="a-dialog-msg"
      onCancel={e => { e.preventDefault(); close(false); }}
      onClick={e => e.target === ref.current && close(false)}>
      {ask && <div className="a-dialog-box">
        <span className={`a-dialog-icon${ask.danger ? ' is-danger' : ''}`} aria-hidden="true">
          <Icon name={ask.danger ? 'trash' : 'restore'} />
        </span>
        <h2 id="a-dialog-title">{ask.title}</h2>
        <p id="a-dialog-msg">{ask.message}</p>
        <div className="a-dialog-actions">
          <button type="button" className="a-dialog-cancel" autoFocus onClick={() => close(false)}>Cancel</button>
          <button type="button" className={`a-dialog-ok${ask.danger ? ' is-danger' : ''}`} onClick={() => close(true)}>{ask.confirm}</button>
        </div>
      </div>}
    </dialog>
  );
}

/* ---------- Editor shell ---------- */

export default function AdminEditor({ initial }: { initial: Site }) {
  const [site, setSite] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState('Dashboard');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const leaving = useRef(false); // set when we reload on purpose, so the unsaved-changes warning doesn't fire
  const dirty = JSON.stringify(site) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { if (!leaving.current) e.preventDefault(); }; // don't lose unsaved edits on reload/close
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const ask = (a: Ask) => new Promise<boolean>(resolve => setDialog({ ...a, resolve }));

  const onSave = () => start(async () => {
    const res = await save(JSON.stringify(site));
    setMsg(res);
    if (res.ok) setSaved(site);
  });
  const onReset = async () => {
    if (!(await ask({ title: 'Restore demo content?', message: 'Everything on the site goes back to the original sample content. Your edits will be replaced and this can’t be undone.', confirm: 'Restore', danger: true }))) return;
    start(async () => {
      const res = await reset();
      setMsg(res);
      if (res.ok) { leaving.current = true; location.reload(); }
    });
  };
  const onLogout = async () => {
    if (dirty && !(await ask({ title: 'Log out without saving?', message: 'You have unsaved changes. They will be lost if you log out now.', confirm: 'Log out anyway', danger: true }))) return;
    await logout();
  };
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const go = (name: string) => { setTab(name); setNavOpen(false); scrollTo({ top: 0 }); };

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [navOpen]);

  const current = TABS.find(t => t.name === tab)!;
  const Body = current.body;
  const state = pending ? 'saving' : msg && !msg.ok ? 'error' : dirty ? 'dirty' : 'saved';

  return (
    <Editor.Provider value={{ site, go, ask, set:(path, value) => { setSite(s => setIn(s, path, value)); setMsg(null); } }}>
      <div className="admin">
        <div className="a-mtop">
          <button className="a-mtop-btn" aria-expanded={navOpen} aria-controls="a-side" aria-label="Open menu" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>
          <img src={site.logo} alt="" width={860} height={580} />
          <span className="a-mtop-title">{current.name}</span>
          <a className="a-mtop-btn" href={current.anchor ?? '/'} target="_blank" rel="noopener" aria-label="Preview on site"><Icon name="external" /></a>
        </div>
        {navOpen && <div className="a-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <aside className={`a-side${navOpen ? ' open' : ''}`} id="a-side">
          <button className="a-side-close" aria-label="Close menu" onClick={() => setNavOpen(false)}><Icon name="close" /></button>
          <div className="a-brand">
            <img src={site.logo} alt="" width={860} height={580} />
            <span>Admin <em>Demo</em></span>
          </div>
          <nav className="a-tabs" aria-label="Sections">
            <p className="a-side-label">Content</p>
            {TABS.map(t => (
              <button key={t.name} aria-current={t.name === tab} onClick={() => go(t.name)}>
                <Icon name={t.icon} /><span>{t.name}</span>
                {t.count && <b className="a-count">{t.count(site)}</b>}
              </button>
            ))}
          </nav>
          <div className="a-side-foot">
            <a className="a-side-btn" href="/" target="_blank" rel="noopener"><Icon name="external" /> View site</a>
            <button className="a-side-btn" onClick={onReset}><Icon name="restore" /> Restore demo content</button>
            <button className="a-side-btn" onClick={onLogout}><Icon name="logout" /> Log out</button>
            <div className="a-user"><span className="a-avatar">L</span><span><strong>Sir Lester</strong><small>Site owner</small></span></div>
          </div>
        </aside>

        <div className="a-main">
          <header className="a-bar">
            <div>
              <p className="a-crumb">Admin / {current.name}</p>
              <h1>{current.name === 'Dashboard' ? 'Welcome back, Sir Lester' : current.name}</h1>
              <p className="a-desc">{current.desc}</p>
            </div>
            <div className="a-bar-actions">
              <span className={`a-status a-status--${state}`} role="status">
                <i aria-hidden="true" />{pending ? 'Saving…' : msg ? msg.message : dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              {current.anchor && <a className="a-ghost" href={current.anchor} target="_blank" rel="noopener"><Icon name="external" /> Preview on site</a>}
              <button className="btn" onClick={onSave} disabled={!dirty || pending}>Save changes</button>
            </div>
          </header>
          <div className="a-panel"><Body /></div>
        </div>
      </div>
      <ConfirmDialog ask={dialog} onDone={ok => { dialog?.resolve(ok); setDialog(null); }} />
    </Editor.Provider>
  );
}
