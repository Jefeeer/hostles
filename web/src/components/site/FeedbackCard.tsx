'use client';
import { useState } from 'react';
import type { Feedback } from '@/lib/site';

const LIMIT = 100; // client brief: feedback over 100 characters gets "Read more"

export default function FeedbackCard({ item }: { item: Feedback }) {
  const [open, setOpen] = useState(false);
  const long = item.text.length > LIMIT;
  return (
    <figure className="card">
      {item.photo && <img src={item.photo} alt="" loading="lazy" />}
      <blockquote>{long && !open ? item.text.slice(0, LIMIT).trimEnd() + '…' : item.text}</blockquote>
      {long && <button className="read-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Read less' : 'Read more'}</button>}
      <figcaption><strong>{item.name}</strong><span>{item.event}</span></figcaption>
    </figure>
  );
}
