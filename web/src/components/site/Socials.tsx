import type { Site } from '@/lib/site';

const ICONS = {
  facebook: <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v9h4v-9h3l1-4h-4V9c0-.6.4-1 1-1z" />,
  instagram: <>
    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
  </>,
  tiktok: <path fill="currentColor" d="M16.5 3c.3 2.3 1.8 3.9 4 4.1v3.2c-1.5 0-2.9-.4-4-1.2v6.4a5.5 5.5 0 1 1-5.5-5.5l.9.1v3.3a2.3 2.3 0 1 0 1.4 2.1V3h3.2z" />
};
const LABELS = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };

export default function Socials({ socials }: { socials: Site['socials'] }) {
  const keys = (Object.keys(ICONS) as (keyof typeof ICONS)[]).filter(k => socials[k]);
  return (
    <ul className="socials">
      {keys.map(k => (
        <li key={k}>
          <a href={socials[k]} target="_blank" rel="noopener noreferrer" aria-label={LABELS[k]}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k]}</svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
