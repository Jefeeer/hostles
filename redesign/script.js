const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const root = document.documentElement;

$('#year').textContent = new Date().getFullYear();

/* ---------- Curtain: "Mic check. One, two." ---------- */
const goLive = () => document.body.classList.add('is-live');
if (root.classList.contains('no-curtain')) {
  goLive();
} else {
  const curtain = $('#curtain');
  const timer = setTimeout(goLive, 1350);
  curtain.addEventListener('click', () => { clearTimeout(timer); goLive(); });
  try { sessionStorage.setItem('lester-curtain', '1'); } catch {}
}

/* ---------- Header theme + run-of-show ---------- */
const header = $('#header');
const themed = $$('[data-theme]');
const cues = $$('[data-cue]');
const cueTitles = ['The entrance', 'Introducing the host', 'A round of applause', 'Roll the films', 'That’s your cue'];
const rsNum = $('#rs-num'), rsTitle = $('#rs-title'), rsProgress = $('#rs-progress');
const navLinks = $$('.nav a'), rsLinks = $$('.rs-list a');
let currentCue = 0;

function onScroll() {
  const y = scrollY;
  header.classList.toggle('is-scrolled', y > 24);
  document.body.classList.toggle('show-rs', y > innerHeight * 0.4);
  const probe = header.offsetHeight / 2;
  const under = themed.find(el => { const r = el.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
  const theme = under?.dataset.theme;
  header.classList.toggle('is-light', theme === 'light');
  header.classList.toggle('is-orange', theme === 'orange');

  let active = 1;
  for (const el of cues) if (el.getBoundingClientRect().top <= innerHeight * 0.45) active = +el.dataset.cue;
  if (active !== currentCue) {
    currentCue = active;
    rsNum.textContent = String(active).padStart(2, '0');
    rsTitle.textContent = cueTitles[active - 1];
    rsLinks.forEach(a => a.classList.toggle('is-current', +a.dataset.go === active));
    const id = cues[active - 1].id;
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  rsProgress.style.strokeDashoffset = 94.25 * (1 - Math.min(1, y / Math.max(1, max)));

  // Portrait parallax inside the arch
  const arch = $('.arch');
  const r = arch.getBoundingClientRect();
  if (r.bottom > 0 && r.top < innerHeight) arch.style.setProperty('--p', ((innerHeight - r.top) / (innerHeight + r.height)).toFixed(3));
}
let scrollQueued = false;
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(() => { scrollQueued = false; onScroll(); }); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// Show clock: time since the doors opened
const clock = $('#rs-clock'), t0 = Date.now();
setInterval(() => {
  const s = Math.floor((Date.now() - t0) / 1000);
  clock.textContent = [s / 3600, (s / 60) % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
}, 1000);

const rsToggle = $('#rs-toggle'), rsList = $('#rs-list');
const setRunsheet = open => { rsList.hidden = !open; rsToggle.setAttribute('aria-expanded', String(open)); };
rsToggle.addEventListener('click', () => setRunsheet(rsList.hidden));
rsLinks.forEach(a => a.addEventListener('click', () => setRunsheet(false)));
document.addEventListener('click', e => { if (!e.target.closest('#runsheet')) setRunsheet(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !rsList.hidden) { setRunsheet(false); rsToggle.focus(); } });

/* ---------- Scroll reveals ---------- */
const revealer = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
$$('.reveal').forEach(el => revealer.observe(el));

/* ---------- Hero spotlight + live waveform ---------- */
const hero = $('.hero');
const lit = $('#spotlight');
const canvas = $('#wave');
const ctx = canvas.getContext('2d');
const db = $('#db');
const spot = { x: 0, y: 0, tx: 0, ty: 0, r: 340, tr: 340 };
let lastPointer = 0, energyBoost = 0, heroVisible = true, lastMove = { x: 0, y: 0 };

function homeSpot(t) {
  const r = lit.getBoundingClientRect();
  const mobile = innerWidth <= 860;
  const cx = r.width * (mobile ? 0.3 : 0.24), cy = r.height * (mobile ? 0.36 : 0.36);
  return { x: cx + Math.sin(t / 2100) * r.width * 0.07, y: cy + Math.cos(t / 2900) * r.height * 0.06 };
}

hero.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const r = lit.getBoundingClientRect();
  spot.tx = e.clientX - r.left; spot.ty = e.clientY - r.top;
  const speed = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y);
  energyBoost = Math.min(1, energyBoost + speed / 400);
  lastMove = { x: e.clientX, y: e.clientY };
  lastPointer = performance.now();
});

function sizeCanvas() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
addEventListener('resize', sizeCanvas);

// A voice-like envelope: syllables inside phrases, with breaths between phrases.
function voiceEnvelope(t) {
  const phrase = (Math.sin(t / 1700) + Math.sin(t / 1130 + 1.3)) * 0.25 + 0.5;
  const syll = Math.pow(Math.abs(Math.sin(t / 140) * Math.sin(t / 390 + 0.7)), 0.6);
  return Math.max(0.08, phrase * (0.35 + syll * 0.65));
}

function drawWave(t) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const env = Math.min(1, voiceEnvelope(t) + energyBoost * 0.6);
  const step = 5, mid = h / 2;
  for (let x = 0, i = 0; x < w; x += step, i++) {
    const p = x / w;
    const bell = Math.exp(-Math.pow((p - 0.5) / 0.3, 2));
    const n = Math.abs(Math.sin(i * 0.37 + t / 210) * Math.cos(i * 0.11 - t / 330) + Math.sin(i * 1.7 + t / 90) * 0.25);
    const a = Math.max(1, n * env * bell * (h * 0.48));
    const hot = bell * env;
    ctx.fillStyle = hot > 0.42 ? `rgba(255,102,0,${0.5 + hot * 0.5})` : `rgba(244,236,223,${0.16 + hot * 0.6})`;
    ctx.fillRect(x, mid - a, 2, a * 2);
  }
  db.textContent = `${Math.round(-34 + env * 30)} dB`;
}

function frame(t) {
  if (heroVisible) {
    const idle = t - lastPointer > 2600 || !finePointer;
    if (idle) { const h = homeSpot(t); spot.tx = h.x; spot.ty = h.y; }
    spot.tr = 300 + energyBoost * 140;
    spot.x += (spot.tx - spot.x) * 0.08;
    spot.y += (spot.ty - spot.y) * 0.08;
    spot.r += (spot.tr - spot.r) * 0.06;
    lit.style.setProperty('--x', `${spot.x.toFixed(1)}px`);
    lit.style.setProperty('--y', `${spot.y.toFixed(1)}px`);
    lit.style.setProperty('--r', `${spot.r.toFixed(1)}px`);
    energyBoost *= 0.95;
    drawWave(t);
  }
  requestAnimationFrame(frame);
}

if (reduceMotion) {
  const h = homeSpot(0);
  lit.style.setProperty('--x', `${h.x}px`); lit.style.setProperty('--y', `${h.y}px`); lit.style.setProperty('--r', '520px');
  drawWave(800);
} else {
  const h = homeSpot(0); spot.x = spot.tx = h.x; spot.y = spot.ty = h.y;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  requestAnimationFrame(frame);
}

/* ---------- Applause meter ---------- */
const vu = $('#vu'), pct = $('#pct'), count = $('#count');
const REVIEWS = 37;
for (let i = 0; i < REVIEWS; i++) {
  const bar = document.createElement('i');
  const p = i / (REVIEWS - 1);
  bar.style.height = `${26 + p * 74 - (i % 3) * 4}%`;
  bar.style.setProperty('--c', p < 0.55 ? '#e9c46a' : p < 0.8 ? '#ffa04a' : '#ff6600');
  vu.append(bar);
}
const bars = [...vu.children];
function lightUp(n) {
  bars.forEach((b, i) => b.classList.toggle('on', i < n));
  count.textContent = n;
  pct.textContent = Math.round((n / REVIEWS) * 100);
}
if (reduceMotion) {
  lightUp(REVIEWS);
} else {
  lightUp(0);
  const meterObs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    meterObs.disconnect();
    const start = performance.now(), dur = 1800;
    const tick = now => {
      const k = Math.min(1, (now - start) / dur);
      lightUp(Math.round((1 - Math.pow(1 - k, 3)) * REVIEWS));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.5 });
  meterObs.observe(vu);
}

/* ---------- Films: cursor play button, timecode, screening room ---------- */
const dialog = $('#screening'), iframe = $('#screening-iframe');
$$('.reel-screen').forEach(screen => {
  const play = $('.reel-play', screen), tc = $('.reel-tc', screen);
  const label = tc.textContent.split('·')[0].trim();
  let frames = 0, tcTimer = null;
  const renderTc = () => {
    const f = frames % 24, s = Math.floor(frames / 24);
    tc.textContent = `${label} · TC 00:00:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };
  screen.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = screen.getBoundingClientRect();
    play.style.setProperty('--mx', `${e.clientX - r.left}px`);
    play.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  screen.addEventListener('pointerenter', () => { if (!reduceMotion) tcTimer = setInterval(() => { frames++; renderTc(); }, 1000 / 24); });
  screen.addEventListener('pointerleave', () => {
    clearInterval(tcTimer);
    play.style.setProperty('--mx', '50%'); play.style.setProperty('--my', '50%');
  });
  screen.addEventListener('click', e => {
    if (typeof dialog.showModal !== 'function' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const id = screen.dataset.vimeo;
    $('#screening-title').textContent = `Now showing · ${screen.dataset.title}`;
    $('#screening-link').href = screen.href;
    iframe.src = `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0&color=ff6600`;
    dialog.showModal();
  });
});
const closeScreening = () => dialog.close();
$('#screening-close').addEventListener('click', closeScreening);
dialog.addEventListener('click', e => { if (e.target === dialog) closeScreening(); });
dialog.addEventListener('close', () => { iframe.src = 'about:blank'; });

/* ---------- Magnetic buttons ---------- */
if (finePointer && !reduceMotion) {
  $$('.magnetic').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

/* ---------- Inquiry form + live programme ---------- */
const bookingEmail = (window.PORTFOLIO_CONFIG?.inquiryEmail || '').trim();
const emailReady = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(bookingEmail) && !/[\r\n?&#]/.test(bookingEmail);
const form = $('#inquiry-form');
const submit = $('#inquiry-submit');
const status = $('#inquiry-status');
const helper = $('#inquiry-help');
submit.firstChild.textContent = emailReady ? 'Continue to email ' : 'Copy your inquiry ';
helper.textContent = emailReady ? 'Opens your email app. Review your message, then send it to Lester.' : 'Email booking is being set up. Copy your inquiry or connect on Instagram.';

const ORDERS = {
  'Wedding': ['The Wedding of', ['Guests arrive', 'Grand entrance', 'Welcome remarks', 'Dinner is served', 'Toasts & messages', 'First dance', 'Party till late']],
  'Corporate event': ['An Evening with', ['Registration', 'Opening remarks', 'Programme proper', 'Awards & recognition', 'Closing remarks']],
  'Private celebration': ['A Celebration for', ['Guests arrive', 'Welcome', 'Dinner', 'Tributes & games', 'Cake & toast']],
  'Voice-over inquiry': ['A Voice-over for', ['The brief', 'The script', 'In the booth', 'Review', 'Delivery']],
  'Other': ['An Occasion for', ['Arrival', 'Welcome', 'The main event', 'Celebration', 'Send-off']]
};
const DEFAULT_ORDER = ['Your occasion', ['Arrival', 'Welcome', 'The main event', 'Celebration', 'Send-off']];
const pg = { el: $('#programme'), kicker: $('#pg-kicker'), name: $('#pg-name'), when: $('#pg-when'), where: $('#pg-where'), order: $('#pg-order'), note: $('#pg-note'), no: $('#pg-no') };
let lastType = null;

function renderProgramme() {
  const f = new FormData(form);
  const name = String(f.get('name') || '').trim();
  const type = String(f.get('eventType') || '');
  const date = String(f.get('eventDate') || '');
  const venue = String(f.get('venue') || '').trim();
  const message = String(f.get('message') || '').trim();
  const [kicker, order] = ORDERS[type] || DEFAULT_ORDER;

  pg.kicker.textContent = kicker;
  pg.name.textContent = name || 'You & your favourite people';
  pg.no.textContent = `No. ${String((name.length * 37 + 1) % 1000).padStart(3, '0')}`;
  pg.when.textContent = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date to be announced';
  pg.where.textContent = venue || 'Venue to be revealed';
  pg.note.textContent = message ? `“${message.length > 120 ? `${message.slice(0, 117).trim()}…` : message}”` : '“Tell Lester what you’re imagining…”';

  if (type !== lastType) {
    lastType = type;
    pg.order.replaceChildren(...order.map((item, i) => {
      const li = document.createElement('li');
      li.style.animationDelay = `${i * 60}ms`;
      const b = document.createElement('b'); b.textContent = String(i + 1).padStart(2, '0');
      const s = document.createElement('span'); s.textContent = item;
      li.append(b, s);
      return li;
    }));
    pg.el.classList.remove('bump'); void pg.el.offsetWidth; pg.el.classList.add('bump');
  }
}
form.addEventListener('input', renderProgramme);
form.addEventListener('change', renderProgramme);
renderProgramme();

form.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = new FormData(form);
  const name = String(fields.get('name')).trim();
  const type = String(fields.get('eventType'));
  const date = String(fields.get('eventDate')) || 'To be confirmed';
  const venue = String(fields.get('venue') || '').trim() || 'To be confirmed';
  const subject = `${type} inquiry — ${name}`;
  const body = `Hello Lester,\n\nI would like to ask about your availability.\n\nName: ${name}\nEmail: ${fields.get('email')}\nOccasion: ${type}\nEvent date: ${date}\nVenue: ${venue}\n\n${String(fields.get('message')).trim()}\n\nThank you,\n${name}`;
  if (emailReady) {
    window.location.href = `mailto:${encodeURIComponent(bookingEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Your email app should open with your inquiry. The message has not been sent yet. If no app opens, copy the prepared message below.';
    $('#copy-fallback').hidden = false;
    $('#prepared-inquiry').value = `To: ${bookingEmail}\nSubject: ${subject}\n\n${body}`;
    return;
  }
  try {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    status.textContent = 'Inquiry copied. Nothing has been sent. You can paste your message into an Instagram conversation with Lester.';
  } catch {
    $('#copy-fallback').hidden = false;
    $('#prepared-inquiry').value = `Subject: ${subject}\n\n${body}`;
    status.textContent = 'Automatic copying is unavailable. Your prepared inquiry is below; select and copy it. Nothing has been sent.';
  }
});
