'use client';
import { useEffect, useState } from 'react';
import type { Photo } from '@/lib/site';

// Full gallery page: filter by area; arriving from a home-page area link (#Area) preselects it.
export default function GalleryFilter({ areas }: { areas: [string, Photo[]][] }) {
  const [active, setActive] = useState('All');
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    // location.hash only exists in the browser, so this can't be the initial state (it would mismatch the server render).
    if (areas.some(([a]) => a === hash)) setActive(hash); // eslint-disable-line react-hooks/set-state-in-effect
  }, [areas]);

  return <>
    <div className="area-filter" role="group" aria-label="Filter by area">
      {['All', ...areas.map(([a]) => a)].map(a =>
        <button key={a} type="button" aria-pressed={active === a} onClick={() => setActive(a)}>{a}</button>)}
    </div>
    {areas.filter(([a]) => active === 'All' || a === active).map(([area, photos]) => (
      <section className="gallery-area" id={area} key={area}>
        <h2>{area}</h2>
        <div className="photo-grid">{photos.map((p, i) => <img key={i} src={p.src} alt={p.alt} loading="lazy" />)}</div>
      </section>
    ))}
  </>;
}
