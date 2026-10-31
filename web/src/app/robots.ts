import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hostles.vercel.app';
  return { rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/bookings', '/records', '/events', '/clients', '/website', '/outbox', '/settings', '/payments', '/contracts', '/login', '/c/', '/p/'] }, sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl };
}
