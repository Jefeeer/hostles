document.getElementById('year').textContent = new Date().getFullYear();
const bookingEmail = (window.PORTFOLIO_CONFIG?.inquiryEmail || '').trim();
const emailReady = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(bookingEmail) && !/[\r\n?&#]/.test(bookingEmail);
const form = document.getElementById('inquiry-form');
const submit = document.getElementById('inquiry-submit');
const status = document.getElementById('inquiry-status');
const helper = document.getElementById('inquiry-help');
submit.firstChild.textContent = emailReady ? 'Continue to email ' : 'Copy your inquiry ';
helper.textContent = emailReady ? 'Opens your email app. Review your message, then send it to Lester.' : 'Email booking is being set up. Copy your inquiry or connect on Instagram.';
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const name = String(fields.get('name')).trim();
  const type = String(fields.get('eventType'));
  const date = String(fields.get('eventDate')) || 'To be confirmed';
  const subject = `${type} inquiry — ${name}`;
  const body = `Hello Lester,\n\nI would like to ask about your availability.\n\nName: ${name}\nEmail: ${fields.get('email')}\nOccasion: ${type}\nEvent date: ${date}\n\n${String(fields.get('message')).trim()}\n\nThank you,\n${name}`;
  if (emailReady) {
    window.location.href = `mailto:${encodeURIComponent(bookingEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Your email app should open with your inquiry. The message has not been sent yet. If no app opens, copy the prepared message below.';
    document.getElementById('copy-fallback').hidden = false;
    document.getElementById('prepared-inquiry').value = `To: ${bookingEmail}\nSubject: ${subject}\n\n${body}`;
    return;
  }
  try {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    status.textContent = 'Inquiry copied. Nothing has been sent. You can paste your message into an Instagram conversation with Lester.';
  } catch {
    document.getElementById('copy-fallback').hidden = false;
    document.getElementById('prepared-inquiry').value = `Subject: ${subject}\n\n${body}`;
    status.textContent = 'Automatic copying is unavailable. Your prepared inquiry is below; select and copy it. Nothing has been sent.';
  }
});
