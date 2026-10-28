const S = window.SITE;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const ext = 'target="_blank" rel="noopener noreferrer"';
const LIMIT = 100; // feedback longer than this gets "Read more"

// Menu (burger on every screen size)
const burger = $('#burger'), menu = $('#menu');
const setMenu = open => { menu.hidden = !open; burger.setAttribute('aria-expanded', open); document.body.classList.toggle('menu-open', open); };
if (burger) {
  burger.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 761px)').addEventListener('change', () => setMenu(false)); // don't leave scroll locked when resizing to desktop
}

const ICONS = {
  Facebook: '<path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v9h4v-9h3l1-4h-4V9c0-.6.4-1 1-1z"/>',
  Instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>',
  TikTok: '<path fill="currentColor" d="M16.5 3c.3 2.3 1.8 3.9 4 4.1v3.2c-1.5 0-2.9-.4-4-1.2v6.4a5.5 5.5 0 1 1-5.5-5.5l.9.1v3.3a2.3 2.3 0 1 0 1.4 2.1V3h3.2z"/>'
};
$$('[data-socials]').forEach(el => el.innerHTML = S.socials.map(s =>
  `<li><a href="${esc(s.url)}" ${ext} aria-label="${esc(s.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.label] || ''}</svg></a></li>`).join(''));

$$('[data-partners]').forEach(el => el.innerHTML = S.partners.map(p =>
  `<li>${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name)}</li>`).join(''));

$$('[data-videos]').forEach(el => {
  const list = el.dataset.videos ? S.videos.slice(0, +el.dataset.videos) : S.videos;
  el.innerHTML = list.map(v => `<figure class="video">
    <video controls preload="none" playsinline poster="${esc(v.poster)}"><source src="${esc(v.src)}" type="video/mp4"></video>
    <figcaption><strong>${esc(v.title)}</strong><span>${esc(v.place)}</span><a href="${esc(v.facebook)}" ${ext}>Watch this in Facebook</a></figcaption>
  </figure>`).join('');
});

const stat = $('[data-stat]');
if (stat) {
  const f = S.feedbackStats;
  stat.href = f.url;
  stat.querySelector('.stat-num').textContent = `${f.percent}%`;
  stat.querySelector('.stat-label').textContent = `recommend Lester · ${f.reviews} Facebook reviews →`;
}

$$('[data-feedback]').forEach(el => {
  el.innerHTML = S.feedback.map(f => {
    const long = f.text.length > LIMIT;
    return `<figure class="card">
      <img src="${esc(f.photo)}" alt="" loading="lazy">
      <blockquote data-full="${esc(f.text)}">${esc(long ? f.text.slice(0, LIMIT).trimEnd() + '…' : f.text)}</blockquote>
      ${long ? '<button class="read-more" aria-expanded="false">Read more</button>' : ''}
      <figcaption><strong>${esc(f.name)}</strong><span>${esc(f.event)}</span></figcaption>
    </figure>`;
  }).join('');
  el.addEventListener('click', e => {
    const btn = e.target.closest('.read-more');
    if (!btn) return;
    const q = btn.previousElementSibling, open = btn.getAttribute('aria-expanded') !== 'true';
    [q.textContent, q.dataset.short] = open ? [q.dataset.full, q.textContent] : [q.dataset.short, q.textContent];
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? 'Read less' : 'Read more';
  });
});

// Gallery: group photos by area, keeping first-seen order
const areas = S.gallery.reduce((m, p) => m.set(p.area, [...(m.get(p.area) || []), p]), new Map());
const img = p => `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy">`;
$$('[data-areas]').forEach(el => el.innerHTML = [...areas].map(([area, photos]) =>
  `<a class="area" href="gallery.html#${encodeURIComponent(area)}" ${ext}>${img(photos[0])}<span>${esc(area)}</span></a>`).join(''));
$$('[data-gallery]').forEach(el => el.innerHTML = [...areas].map(([area, photos]) =>
  `<section class="gallery-area" id="${esc(area)}"><h2>${esc(area)}</h2><div class="photo-grid">${photos.map(img).join('')}</div></section>`).join(''));

// Gallery page: filter by area; arriving from a home-page area link (#Area) preselects it
const filter = $('[data-area-filter]');
if (filter) {
  const show = area => {
    $$('.gallery-area').forEach(s => s.hidden = area !== 'All' && s.id !== area);
    filter.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.value === area));
  };
  filter.innerHTML = ['All', ...areas.keys()].map(a => `<button type="button" value="${esc(a)}">${esc(a)}</button>`).join('');
  filter.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.value); });
  const fromHash = decodeURIComponent(location.hash.slice(1));
  show(areas.has(fromHash) ? fromHash : 'All');
}

// Loading screen: keep it up at least 700ms so it reads as intentional, then fade out
const loader = $('#loader');
if (loader) addEventListener('load', () => setTimeout(() => loader.classList.add('done'), Math.max(0, 700 - performance.now())));

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();

// Inquiry: opens the visitor's email app with a prepared message (no server)
const form = $('#inquiry-form');
if (form) {
  const email = (window.PORTFOLIO_CONFIG?.inquiryEmail || '').trim();
  const emailOk = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && !/[\r\n?&#]/.test(email);
  const timeLabel = $('#time-label');
  form.eventType.addEventListener('change', () =>
    timeLabel.textContent = form.eventType.value === 'Wedding' ? 'Start time of ceremony' : 'Target start time of program');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const subject = `${d.eventType} inquiry — ${d.name}`;
    const body = `Hello Lester,\n\nName: ${d.name}\nEmail: ${d.email}\nType of event: ${d.eventType}\nDate: ${d.date}\nVenue: ${d.venue}\n${timeLabel.textContent}: ${d.time}\n\nThank you!`;
    const out = $('#prepared-inquiry'), status = $('#inquiry-status');
    out.value = `${emailOk ? `To: ${email}\n` : ''}Subject: ${subject}\n\n${body}`;
    out.hidden = false;
    if (emailOk) {
      location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Your email app should open with this message ready to send. If it does not, copy the message below.';
    } else {
      try { await navigator.clipboard.writeText(out.value); status.textContent = 'Inquiry copied. Paste it into a message to Lester on Facebook or Instagram.'; }
      catch { status.textContent = 'Copy the message below and send it to Lester on Facebook or Instagram.'; }
    }
  });
}
