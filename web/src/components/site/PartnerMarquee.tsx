'use client';
import { useEffect, useRef } from 'react';
import type { Partner } from '@/lib/site';

const SPEED = 0.5; // px per frame, ~30px/s
const RESUME_MS = 1500; // wait after a swipe/drag before auto-scrolling again

// Logo strip of two rows drifting in opposite directions; each row loops endlessly and can be swiped/dragged on its own.
export default function PartnerMarquee({ partners, label }: { partners: Partner[]; label: string }) {
  const rows = [partners.filter((_, i) => i % 2 === 0), partners.filter((_, i) => i % 2 === 1)].filter((r) => r.length);
  return (
    <div className="partner-rows" role="region" aria-label={label}>
      {rows.map((r, i) => <Row key={i} partners={r} dir={i ? -1 : 1} />)}
    </div>
  );
}

// The row is rendered three times and kept scrolled inside the middle copy, so it never hits an edge in either direction.
function Row({ partners, dir }: { partners: Partner[]; dir: 1 | -1 }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Width of one copy + gap. Measured once and on resize: reading layout every frame forces a reflow per frame.
    let w = 0;
    const measure = () => { w = (el.children[1] as HTMLElement).offsetLeft; };
    measure();
    const wrap = (x: number) => (x >= 2 * w ? x - w : x < w ? x + w : x);
    let pos = w, paused = false, hovered = false, timer = 0, raf = 0;
    el.scrollLeft = pos;

    const pause = () => { paused = true; clearTimeout(timer); };
    const resume = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => { if (!hovered) { pos = wrap(el.scrollLeft); el.scrollLeft = pos; paused = false; } }, RESUME_MS);
    };
    const tick = () => {
      if (!paused) { pos = wrap(pos + dir * SPEED); el.scrollLeft = pos; }
      raf = requestAnimationFrame(tick);
    };

    // Mouse drag-to-scroll (touch and trackpads already scroll natively).
    let dragging = false;
    const down = (e: PointerEvent) => { pause(); if (e.pointerType === 'mouse') { dragging = true; el.classList.add('dragging'); } };
    const move = (e: PointerEvent) => { if (dragging) el.scrollLeft -= e.movementX; };
    const up = () => { dragging = false; el.classList.remove('dragging'); resume(); };
    // Hover-pause for real mice only; taps fire emulated mouse events that would freeze the row.
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse') { hovered = true; pause(); } };
    const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse') { hovered = false; up(); } };
    const nudge = () => { pause(); resume(); };

    const on = [
      ['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up],
      ['pointerenter', enter], ['pointerleave', leave], ['touchstart', pause], ['touchend', resume],
      ['wheel', nudge], ['focusin', pause], ['focusout', resume],
    ] as [string, EventListener][];
    on.forEach(([t, f]) => el.addEventListener(t, f, { passive: true }));

    // Animate only while the row is on screen, so it costs nothing during page load or once scrolled past.
    const resize = new ResizeObserver(() => { const old = w; measure(); pos = wrap(pos - old + w); });
    resize.observe(el);
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting && motion) { pos = wrap(el.scrollLeft); raf = requestAnimationFrame(tick); }
    });
    seen.observe(el);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timer); seen.disconnect(); resize.disconnect();
      on.forEach(([t, f]) => el.removeEventListener(t, f));
    };
  }, [dir]);

  return (
    <div className="partner-track" ref={ref} tabIndex={0}>
      {[0, 1, 2].map((copy) => (
        <ul key={copy} className="partner-list" aria-hidden={copy > 0 || undefined}>
          {partners.map((p, i) => (
            <li key={i}>{p.logo ? <img src={p.logo} alt={copy ? '' : p.name} loading="lazy" draggable={false} /> : p.name}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}
