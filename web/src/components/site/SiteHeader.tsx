'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Site } from '@/lib/site';
import Socials from './Socials';

// Home: inline nav on desktop, burger + full-screen menu on mobile. Sub-pages: logo + back link.
export default function SiteHeader({ site, home = false }: { site: Site; home?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const mq = matchMedia('(min-width: 761px)');
    const onWide = () => setOpen(false); // don't leave scroll locked when resizing to desktop
    addEventListener('keydown', onKey);
    mq.addEventListener('change', onWide);
    return () => { removeEventListener('keydown', onKey); mq.removeEventListener('change', onWide); };
  }, [open]);

  const { nav } = site;
  const links: [string, string][] = [['#about', nav.about], ['#videos', nav.videos], ['#feedback', nav.feedback], ['#gallery', nav.gallery], ['#inquire', nav.inquiry]];

  return (
    <header className="header">
      <Link className="brand" href={home ? '#top' : '/'} aria-label={`${site.meta.title}, home`}>
        <img src={site.logo} alt="" width={860} height={580} />
      </Link>
      {home ? <>
        <button className="burger" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
          <span className="burger-icon" aria-hidden="true" /><span>Menu</span>
        </button>
        <nav className={`menu${open ? ' open' : ''}`} id="menu" aria-label="Main" onClick={e => (e.target as HTMLElement).closest('a') && setOpen(false)}>
          <ol className="menu-links">{links.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}</ol>
          <Socials socials={site.socials} />
        </nav>
      </> : <Link className="back" href="/">&larr; Back to site</Link>}
    </header>
  );
}
