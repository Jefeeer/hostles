'use client';
import { useEffect, useState } from 'react';

const HOLD = 1350; // ms on screen before the curtain wipes up

// "Mic check · One, two." intro. The head script in layout.tsx adds .no-curtain to skip it.
export default function Loader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (document.documentElement.classList.contains('no-curtain')) return setDone(true);
    try { sessionStorage.setItem('lester-curtain', '1'); } catch {}
    const timer = setTimeout(() => setDone(true), HOLD); // counted from when the curtain is on screen, so "two." always lands
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={`loader${done ? ' done' : ''}`} aria-hidden="true" onClick={() => setDone(true)}>
      <div className="loader-inner">
        <span className="loader-rec"><i />Mic check</span>
        <span className="loader-line">One,</span>
        <span className="loader-line">two.</span>
      </div>
    </div>
  );
}
