import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { getContent } from '@/lib/site';
import './site.css';

const manrope = localFont({ src: './fonts/manrope.woff2', weight: '200 800', variable: '--font-manrope' });
const anton = localFont({ src: './fonts/anton.woff2', variable: '--font-anton' });

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getContent();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hostles.vercel.app';
  return {
    metadataBase: new URL(siteUrl),
    title: `${meta.title} | Tagaytay Events Host & Voice-over`,
    description: meta.description,
    alternates: { canonical: '/' },
    icons: { icon: '/assets/favicon-32.png', apple: '/assets/apple-touch-icon.png' },
    openGraph: {
      type: 'website', locale: 'en_PH', siteName: 'Lester Events Host', url: '/',
      title: 'Lester Events Host | Tagaytay Events Host & Voice-over',
      description: 'A steady, professional voice for weddings, corporate occasions and private celebrations in Tagaytay, Cavite and beyond.',
      images: [{ url: '/assets/lester-events-host-social.jpg', width: 1200, height: 630, alt: 'Lester Events Host in formal attire at an elegant event' }],
    },
    twitter: { card: 'summary_large_image', title: 'Lester Events Host | Tagaytay Events Host', description: 'Weddings, corporate occasions, private celebrations and voice-over in Tagaytay, Cavite and beyond.', images: ['/assets/lester-events-host-social.jpg'] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hostles.vercel.app';
  const structuredData = { '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': `${siteUrl}/#business`, name: 'Lester Events Host', alternateName: 'Mark Lester S. Agellon', url: `${siteUrl}/`, image: `${siteUrl}/assets/lester-events-host-social.jpg`, description: 'Professional events host and voice-over talent for weddings, corporate occasions and private celebrations.', email: 'mailto:mlagellon@gmail.com', areaServed: [{ '@type': 'City', name: 'Tagaytay' }, { '@type': 'AdministrativeArea', name: 'Cavite' }, { '@type': 'AdministrativeArea', name: 'Batangas' }], knowsAbout: ['Wedding hosting', 'Corporate event hosting', 'Private event hosting', 'Voice-over'], sameAs: ['https://www.facebook.com/LesterEventsHost', 'https://www.instagram.com/hostlester/', 'https://www.tiktok.com/@hostlester'] };
  return (
    <html lang="en" className={`${manrope.variable} ${anton.variable}`} suppressHydrationWarning>
      <head>
        {/* "js" lets CSS show the intro curtain; "no-curtain" skips it after the first visit this session or for reduced motion */}
        <script dangerouslySetInnerHTML={{ __html: 'var d=document.documentElement;d.classList.add("js");try{if(sessionStorage.getItem("lester-curtain")||matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("no-curtain")}catch(e){}' }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
