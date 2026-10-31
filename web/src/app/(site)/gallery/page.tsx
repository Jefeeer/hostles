import type { Metadata } from 'next';
import { getContent, groupByArea } from '@/lib/site';
import SiteHeader from '@/components/site/SiteHeader';
import GalleryFilter from '@/components/site/GalleryFilter';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getContent();
  return { title: `${site.gallery.pageHeading} — ${site.meta.title}` };
}

export default async function GalleryPage() {
  const site = await getContent();
  const { gallery } = site;
  return <>
    <SiteHeader site={site} />
    <main className="section page">
      <div className="wrap">
        <p className="eyebrow">{gallery.pageEyebrow}</p>
        <h1>{gallery.pageHeading}</h1>
        <GalleryFilter areas={groupByArea(gallery.items)} />
      </div>
    </main>
  </>;
}
