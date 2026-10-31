import { getContent, groupByArea } from '@/lib/site';
import SiteHeader from '@/components/site/SiteHeader';
import VideoCard from '@/components/site/VideoCard';
import Socials from '@/components/site/Socials';
import Loader from '@/components/site/Loader';
import FeedbackCard from '@/components/site/FeedbackCard';
import InquiryForm from '@/components/site/InquiryForm';

// Cached; saving in the /website editor refreshes it right away (revalidatePath). Hourly refresh as a backstop.
export const revalidate = 3600;

const FEATURED = 4; // client brief: 4 featured videos on the home page

export default async function Home() {
  const site = await getContent();
  const { cover, about, videos, feedback, gallery, inquiry } = site;

  return <>
    <Loader />
    <a className="skip-link" href="#main">Skip to content</a>
    <SiteHeader site={site} home />

    <main id="main">
      <section className={`cover cover--${cover.layout}`} id="top" aria-label={site.meta.title}>
        <img className="cover-photo" src={cover.photo} alt="" style={{ objectPosition: cover.focus || "center 20%" }} />
        <div className="cover-text">
          <p className="eyebrow">{cover.eyebrow}</p>
          <h1>{cover.title}</h1>
          <p className="lead">{cover.lead}</p>
        </div>
      </section>

      <section className="section" id="about" aria-labelledby="about-title">
        <div className="wrap about">
          <img src={about.photo} alt="" loading="lazy" />
          <div>
            <p className="eyebrow">{about.eyebrow}</p>
            <h2 id="about-title">{about.heading}</h2>
            {about.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
        {about.partners.length > 0 && (
          <div className="wrap partners">
            <p className="eyebrow">{about.partnersLabel}</p>
            <ul className="partner-list">
              {about.partners.map((p, i) => <li key={i}>{p.logo ? <img src={p.logo} alt={p.name} loading="lazy" /> : p.name}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="section section--alt" id="videos" aria-labelledby="videos-title">
        <div className="wrap">
          <p className="eyebrow">{videos.eyebrow}</p>
          <h2 id="videos-title">{videos.heading}</h2>
          <div className="video-grid">{videos.items.slice(0, FEATURED).map((v, i) => <VideoCard key={i} v={v} facebookLabel={videos.facebookLabel} />)}</div>
          <a className="more" href="/videos" target="_blank" rel="noopener">{videos.moreLabel}</a>
        </div>
      </section>

      <section className="section" id="feedback" aria-labelledby="feedback-title">
        <div className="wrap">
          <p className="eyebrow">{feedback.eyebrow}</p>
          <h2 id="feedback-title">{feedback.heading}</h2>
          <a className="stat" href={feedback.url} target="_blank" rel="noopener noreferrer">
            <span className="stat-quote" aria-hidden="true">&ldquo;</span>
            <span className="stat-bars" aria-hidden="true">
              {[25, 50, 75, 100].map((t) => <span key={t} className={(parseFloat(feedback.percent) || 0) >= t ? 'on' : ''} style={{ height: `${t}%` }} />)}
            </span>
            <span className="stat-num">{feedback.percent}</span>
            <span className="stat-label">{feedback.statLabel}</span>
          </a>
          <div className="feedback-grid">{feedback.items.map((f, i) => <FeedbackCard key={i} item={f} />)}</div>
        </div>
      </section>

      <section className="section section--alt" id="gallery" aria-labelledby="gallery-title">
        <div className="wrap">
          <p className="eyebrow">{gallery.eyebrow}</p>
          <h2 id="gallery-title">{gallery.heading}</h2>
          <div className="area-grid">
            {groupByArea(gallery.items).map(([area, photos]) => (
              <a className="area" key={area} href={`/gallery#${encodeURIComponent(area)}`} target="_blank" rel="noopener">
                <img src={photos[0].src} alt={photos[0].alt} loading="lazy" /><span>{area}</span>
              </a>
            ))}
          </div>
          <a className="more" href="/gallery" target="_blank" rel="noopener">{gallery.moreLabel}</a>
        </div>
      </section>

      <section className="section" id="inquire" aria-labelledby="inquire-title">
        <div className="wrap narrow">
          <p className="eyebrow">{inquiry.eyebrow}</p>
          <h2 id="inquire-title">{inquiry.heading}</h2>
          <InquiryForm inquiry={inquiry} />
        </div>
      </section>
    </main>

    <footer className="footer">
      <Socials socials={site.socials} />
      <p>&copy; {new Date().getFullYear()} {site.footer.copyright}</p>
    </footer>
  </>;
}
