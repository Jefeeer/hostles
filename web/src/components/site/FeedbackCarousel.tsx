'use client';
import { useRef } from 'react';
import type { Feedback } from '@/lib/site';
import FeedbackCard from './FeedbackCard';

// One row of feedback cards: swipe/scroll with snap on touch, arrows on desktop.
export default function FeedbackCarousel({ items, label }: { items: Feedback[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  return (
    <div className="feedback-carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="feedback-track" ref={track}>{items.map((f, i) => <FeedbackCard key={i} item={f} />)}</div>
      {items.length > 1 && <div className="feedback-nav">
        <button type="button" className="carousel-arrow" aria-label="Previous feedback" onClick={() => move(-1)}>‹</button>
        <button type="button" className="carousel-arrow" aria-label="Next feedback" onClick={() => move(1)}>›</button>
      </div>}
    </div>
  );
}
