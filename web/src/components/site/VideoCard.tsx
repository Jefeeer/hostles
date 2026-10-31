import type { Video } from '@/lib/site';

export default function VideoCard({ v, facebookLabel }: { v: Video; facebookLabel: string }) {
  return (
    <figure className="video">
      <video controls preload="none" playsInline poster={v.poster || undefined}><source src={v.src} /></video>
      <figcaption>
        <strong>{v.title}</strong><span>{v.place}</span>
        {v.facebook && <a href={v.facebook} target="_blank" rel="noopener noreferrer">{facebookLabel}</a>}
      </figcaption>
    </figure>
  );
}
