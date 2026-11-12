'use client';
import { useRef, useState } from 'react';
import type { Photo } from '@/lib/site';

// Coverflow carousel for one gallery area: centre photo large, neighbours stacked behind; loops.
export default function GalleryCarousel({ label, photos }: { label: string; photos: Photo[] }) {
  const [current, setCurrent] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = photos.length;
  const go = (i: number) => setCurrent((i + n) % n);

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label={label}
      onKeyDown={e => { if (e.key === 'ArrowLeft') go(current - 1); if (e.key === 'ArrowRight') go(current + 1); }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}>
      <div className="carousel-stage">
        {photos.map((p, i) => {
          // Shortest way round the loop, so the last photo sits left of the first.
          let d = i - current;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const off = Math.abs(d);
          return (
            <img key={i} src={p.src} alt={p.alt} loading="lazy" aria-hidden={d !== 0}
              className={d === 0 ? 'is-current' : undefined}
              onClick={() => d !== 0 && go(i)}
              style={{
                transform: `translateX(calc(-50% + ${d * 34}%)) scale(${1 - Math.min(off, 3) * 0.16})`,
                zIndex: 10 - off,
                opacity: off > 2 ? 0 : 1,
                filter: off ? `brightness(${1 - off * 0.12})` : undefined,
              }} />
          );
        })}
        {n > 1 && <>
          <button type="button" className="carousel-arrow prev" aria-label="Previous photo" onClick={() => go(current - 1)}>‹</button>
          <button type="button" className="carousel-arrow next" aria-label="Next photo" onClick={() => go(current + 1)}>›</button>
        </>}
      </div>
      {n > 1 && (
        <div className="carousel-dots">
          {photos.map((_, i) => <button key={i} type="button" aria-label={`Photo ${i + 1} of ${n}`} aria-current={i === current} onClick={() => go(i)} />)}
        </div>
      )}
    </div>
  );
}
