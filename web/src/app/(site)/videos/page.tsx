import type { Metadata } from 'next';
import { getContent } from '@/lib/site';
import SiteHeader from '@/components/site/SiteHeader';
import VideoCard from '@/components/site/VideoCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getContent();
  return { title: `${site.videos.pageHeading} — ${site.meta.title}` };
}

export default async function VideosPage() {
  const site = await getContent();
  const { videos } = site;
  return <>
    <SiteHeader site={site} />
    <main className="section page">
      <div className="wrap">
        <p className="eyebrow">{videos.pageEyebrow}</p>
        <h1>{videos.pageHeading}</h1>
        <div className="video-grid">{videos.items.map((v, i) => <VideoCard key={i} v={v} facebookLabel={videos.facebookLabel} />)}</div>
      </div>
    </main>
  </>;
}
